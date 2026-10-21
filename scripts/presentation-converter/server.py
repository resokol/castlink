"""PPTX-to-PDF worker. Run only in the isolated converter service, never in web."""
import io
import json
import os
import select
import resource
import shutil
import signal
import socket
import socketserver
import stat
import struct
import subprocess
import tempfile
import threading
import time
import zipfile
import zlib
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from xml.etree import ElementTree
from xml.parsers import expat

MAX_UPLOAD = 1_500_000_000
MAX_PDF = MAX_UPLOAD
MAX_EXPANDED = 3_000_000_000
MIN_DISK_FREE = 8_000_000_000
MAX_JOB_DISK = 6_000_000_000
DISK_MARGIN = 256 * 1024 * 1024
MAX_ENTRIES = 4096
MAX_DIRECTORY = 16 * 1024 * 1024
MAX_IDENTITY_XML = 4 * 1024 * 1024
UPLOAD_TIMEOUT = 15 * 60
CONVERSION_TIMEOUT = 5 * 60
SOCKET_PATH = '/run/castlink-converter/converter.sock'
TYPE_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/content-types'
MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
PRESENTATION_NAMESPACES = {
    'http://schemas.openxmlformats.org/presentationml/2006/main',
    'http://purl.oclc.org/ooxml/presentationml/main',
}


class ConversionError(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


def safe_xml(data):
    """Parse identity XML, with DTDs rejected before any entity expansion."""
    if len(data) > MAX_IDENTITY_XML:
        raise ConversionError(413, 'presentation-expanded-limit')
    parser = expat.ParserCreate()
    def reject(*_):
        raise ConversionError(422, 'presentation-invalid-package')
    parser.StartDoctypeDeclHandler = reject
    parser.EntityDeclHandler = reject
    parser.ExternalEntityRefHandler = reject
    try:
        parser.Parse(data, True)
        return ElementTree.fromstring(data)
    except (expat.ExpatError, ElementTree.ParseError, ValueError):
        raise ConversionError(422, 'presentation-invalid-package') from None


def entry_chunks(archive, info):
    """Inflate the entire compressed span with bounded reads, including forged size prefixes."""
    with archive.open(info):
        pass  # stdlib checks local filename encoding and overlapping entries.
    source = archive.fp
    offset = info.header_offset
    if offset < 0 or offset + 30 > archive.start_dir:
        raise ConversionError(422, 'presentation-invalid-package')
    source.seek(offset)
    header = source.read(30)
    if len(header) != 30 or header[:4] != b'PK\x03\x04':
        raise ConversionError(422, 'presentation-invalid-package')
    flags, method = struct.unpack_from('<HH', header, 6)
    name_size, extra_size = struct.unpack_from('<HH', header, 26)
    start = offset + 30 + name_size + extra_size
    end = start + info.compress_size
    if flags != info.flag_bits or method != info.compress_type or start > archive.start_dir or end > archive.start_dir:
        raise ConversionError(422, 'presentation-invalid-package')
    source.seek(start)
    remaining = info.compress_size
    if method == zipfile.ZIP_STORED:
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                raise ConversionError(422, 'presentation-invalid-package')
            remaining -= len(chunk)
            yield chunk
        return
    inflater = zlib.decompressobj(-15)
    pending = b''
    while not inflater.eof:
        if not pending and remaining:
            pending = source.read(min(64 * 1024, remaining))
            if not pending:
                raise ConversionError(422, 'presentation-invalid-package')
            remaining -= len(pending)
        chunk = inflater.decompress(pending, 64 * 1024)
        pending = inflater.unconsumed_tail
        if chunk:
            yield chunk
        if not chunk and not pending and not remaining and not inflater.eof:
            raise ConversionError(422, 'presentation-invalid-package')
    if inflater.unused_data or pending or remaining:
        raise ConversionError(422, 'presentation-invalid-package')


def bounded_directory(source):
    """Prove directory byte/count bounds before ZipFile allocates its directory and ZipInfo list."""
    # Use the same bounded EOCD/ZIP64 parser as ZipFile. It reads <=65,557 tail
    # bytes plus fixed ZIP64 records, including overrides without EOCD sentinels.
    record = zipfile._EndRecData(source)
    if record is None:
        raise ConversionError(422, 'presentation-invalid-package')
    count = record[zipfile._ECD_ENTRIES_TOTAL]
    count_disk = record[zipfile._ECD_ENTRIES_THIS_DISK]
    directory_size = record[zipfile._ECD_SIZE]
    offset = record[zipfile._ECD_OFFSET]
    end = record[zipfile._ECD_LOCATION]
    if record[zipfile._ECD_DISK_NUMBER] or record[zipfile._ECD_DISK_START]:
        raise ConversionError(422, 'presentation-invalid-package')
    if record[zipfile._ECD_SIGNATURE] == zipfile.stringEndArchive64:
        source.seek(end)
        signature = source.read(4)
        # Python3.11 keeps the ordinary EOCD location; newer versions use ZIP64.
        if signature == zipfile.stringEndArchive:
            end -= zipfile.sizeEndCentDir64 + zipfile.sizeEndCentDir64Locator
        elif signature != zipfile.stringEndArchive64:
            raise ConversionError(422, 'presentation-invalid-package')
    if count > MAX_ENTRIES or directory_size > MAX_DIRECTORY:
        raise ConversionError(413, 'presentation-entries-limit')
    if not count or count != count_disk or offset + directory_size != end:
        raise ConversionError(422, 'presentation-invalid-package')
    cursor = offset
    actual = 0
    while cursor < end:
        source.seek(cursor)
        record = source.read(46)
        if len(record) != 46 or record[:4] != b'PK\x01\x02':
            raise ConversionError(422, 'presentation-invalid-package')
        actual += 1
        if actual > MAX_ENTRIES:
            raise ConversionError(413, 'presentation-entries-limit')
        name, extra, comment = struct.unpack_from('<HHH', record, 28)
        cursor += 46 + name + extra + comment
    if cursor != end or actual != count:
        raise ConversionError(422, 'presentation-invalid-package')


def validate_pptx(data, cancelled=lambda: False):
    """Verify ZIP integrity and PPTX identity; leave rendering semantics to Impress."""
    if (len(data) if isinstance(data, (bytes, bytearray)) else Path(data).stat().st_size) > MAX_UPLOAD:
        raise ConversionError(413, 'presentation-upload-limit')
    identity = {}
    try:
        with (io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else Path(data).open('rb')) as source:
            bounded_directory(source)
        with zipfile.ZipFile(io.BytesIO(data) if isinstance(data, (bytes, bytearray)) else data) as archive:
            infos = archive.infolist()
            if not infos or len(infos) > MAX_ENTRIES:
                raise ConversionError(413, 'presentation-entries-limit')
            names = set()
            total = 0
            for info in infos:
                name = info.orig_filename
                parts = name.rstrip('/').split('/')
                if (not name or '\x00' in name or '\\' in name or ':' in name
                        or name.startswith('/') or any(part in ('', '.', '..') for part in parts)
                        or name.casefold() in names or stat.S_ISLNK(info.external_attr >> 16)):
                    raise ConversionError(422, 'presentation-invalid-package')
                names.add(name.casefold())
                if info.flag_bits & 1:
                    raise ConversionError(422, 'presentation-encrypted')
                if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    raise ConversionError(422, 'presentation-invalid-package')
                if info.file_size > MAX_EXPANDED - total:
                    raise ConversionError(413, 'presentation-expanded-limit')
                retain = name in ('[Content_Types].xml', 'ppt/presentation.xml')
                chunks = []
                actual = 0
                crc = 0
                for chunk in entry_chunks(archive, info):
                    if cancelled():
                        raise ConversionError(408, 'presentation-upload-cancelled')
                    actual += len(chunk)
                    total += len(chunk)
                    if total > MAX_EXPANDED or (retain and actual > MAX_IDENTITY_XML):
                        raise ConversionError(413, 'presentation-expanded-limit')
                    crc = zlib.crc32(chunk, crc)
                    if retain:
                        chunks.append(chunk)
                if actual != info.file_size or crc != info.CRC:
                    raise ConversionError(422, 'presentation-invalid-package')
                if retain:
                    identity[name] = b''.join(chunks)
            if not {'[content_types].xml', 'ppt/presentation.xml', '_rels/.rels'} <= names:
                raise ConversionError(422, 'presentation-invalid-package')
            if not {'[Content_Types].xml', 'ppt/presentation.xml'} <= identity.keys():
                raise ConversionError(422, 'presentation-invalid-package')
        types = safe_xml(identity['[Content_Types].xml'])
        main = safe_xml(identity['ppt/presentation.xml'])
        if types.tag != '{' + TYPE_NAMESPACE + '}Types' or not any(
                child.tag == '{' + TYPE_NAMESPACE + '}Override'
                and child.get('PartName') == '/ppt/presentation.xml'
                and child.get('ContentType') == MAIN_TYPE for child in types):
            raise ConversionError(422, 'presentation-invalid-package')
        if main.tag not in {'{' + namespace + '}presentation' for namespace in PRESENTATION_NAMESPACES}:
            raise ConversionError(422, 'presentation-invalid-package')
    except ConversionError:
        raise
    except (zipfile.BadZipFile, zipfile.LargeZipFile, zlib.error, struct.error, RuntimeError, NotImplementedError, EOFError, ValueError, OSError):
        raise ConversionError(422, 'presentation-invalid-package') from None


def job_disk_usage(directory):
    """Count regular job files while Office may remove temporary entries concurrently."""
    total = 0
    pending = [directory]
    while pending:
        current = pending.pop()
        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    try:
                        info = entry.stat(follow_symlinks=False)
                    except FileNotFoundError:
                        continue
                    if stat.S_ISDIR(info.st_mode):
                        pending.append(entry.path)
                    elif stat.S_ISREG(info.st_mode):
                        total += info.st_size
        except FileNotFoundError:
            continue
    return total


def convert(source, directory, cancelled=lambda: False):
    validate_pptx(source, cancelled)
    temporary = str(directory)
    profile = directory / 'profile'
    (profile / 'user').mkdir(parents=True, mode=0o700)
    (profile / 'user/registrymodifications.xcu').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<oor:items xmlns:oor="http://openoffice.org/2001/registry">'
        '<item oor:path="/org.openoffice.Office.Common/Security/Scripting">'
        '<prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>'
        '</item><item oor:path="/org.openoffice.Office.Common/Load">'
        '<prop oor:name="UpdateMode" oor:op="fuse"><value>0</value></prop>'
        '</item></oor:items>', encoding='utf-8')
    process = None
    try:
        process = subprocess.Popen([
            '/usr/bin/soffice', '-env:UserInstallation=' + profile.as_uri(),
            '--headless', '--nologo', '--nodefault', '--norestore',
            '--infilter=Impress MS PowerPoint 2007 XML',
            '--convert-to', 'pdf:impress_pdf_Export', '--outdir', str(directory), str(source),
        ], cwd=directory, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, start_new_session=True,
            env={'HOME': temporary, 'TMPDIR': temporary, 'PATH': '/usr/bin:/bin',
                 'LANG': 'C.UTF-8', 'NO_AT_BRIDGE': '1'})
        try:
            deadline = time.monotonic() + CONVERSION_TIMEOUT
            while True:
                if cancelled():
                    raise ConversionError(408, 'presentation-upload-cancelled')
                if time.monotonic() >= deadline:
                    raise ConversionError(504, 'presentation-conversion-timeout')
                used = job_disk_usage(directory)
                if used > MAX_JOB_DISK or shutil.disk_usage(directory).free < DISK_MARGIN:
                    raise ConversionError(507, 'presentation-storage-limit')
                try:
                    status = process.wait(timeout=min(0.2, max(0.001, deadline - time.monotonic())))
                    break
                except subprocess.TimeoutExpired:
                    continue
        except subprocess.TimeoutExpired:
            raise ConversionError(504, 'presentation-conversion-timeout') from None
        if status in (-signal.SIGKILL, -signal.SIGXFSZ):
            raise ConversionError(422, 'presentation-conversion-resource-limit')
        if status != 0:
            raise ConversionError(422, 'presentation-conversion-failed')
        output = directory / 'slides.pdf'
        try:
            size = output.stat().st_size
            if size > MAX_PDF:
                raise ConversionError(413, 'presentation-output-limit')
            if size < 5 or output.is_symlink():
                raise ConversionError(422, 'presentation-invalid-output')
            with output.open('rb') as pdf:
                prefix = pdf.read(5)
            if prefix != b'%PDF-':
                raise ConversionError(422, 'presentation-invalid-output')
            return output
        except OSError:
            raise ConversionError(422, 'presentation-conversion-failed') from None
    except FileNotFoundError:
        raise ConversionError(503, 'presentation-converter-unavailable') from None
    finally:
        if process is not None:
            # Kill the complete session even if the soffice launcher already exited.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()

class ConverterHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'CastLinkConverter'

    def log_message(self, *_):
        # Never log document bytes, names, credentials or LibreOffice diagnostics.
        pass

    def respond(self, status, body, content_type='application/json'):
        self.close_connection = True
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, code):
        if getattr(self, 'output_started', False):
            self.close_connection = True
            return
        self.respond(status, json.dumps({'code': code}, separators=(',', ':')).encode())

    def do_POST(self):
        if self.path != '/convert':
            self.error(404, 'presentation-route-not-found')
            return
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
            self.error(400, 'presentation-upload-invalid')
            return
        length = int(lengths[0])
        if length > MAX_UPLOAD:
            self.error(413, 'presentation-upload-limit')
            return
        if not self.server.job.acquire(blocking=False):
            self.error(429, 'presentation-converter-busy')
            return
        try:
            if shutil.disk_usage(tempfile.gettempdir()).free < MIN_DISK_FREE:
                raise ConversionError(507, 'presentation-storage-limit')
            with tempfile.TemporaryDirectory(prefix='castlink-presentation-') as temporary:
                directory = Path(temporary)
                source = directory / 'slides.pptx'
                deadline = time.monotonic() + UPLOAD_TIMEOUT
                received = 0
                with source.open('xb') as target:
                    while received < length:
                        remaining = deadline - time.monotonic()
                        if remaining <= 0:
                            raise ConversionError(408, 'presentation-upload-timeout')
                        self.connection.settimeout(min(30, remaining))
                        chunk = self.rfile.read1(min(64 * 1024, length - received))
                        if not chunk:
                            raise ConversionError(400, 'presentation-upload-invalid')
                        target.write(chunk)
                        received += len(chunk)
                def cancelled():
                    readable, _, _ = select.select([self.connection], [], [], 0)
                    return bool(readable and self.connection.recv(1, socket.MSG_PEEK) == b'')
                self.connection.settimeout(30)
                output = convert(source, directory, cancelled)
                self.close_connection = True
                self.output_started = True
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Length', str(output.stat().st_size))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Connection', 'close')
                self.end_headers()
                deadline = time.monotonic() + 5 * 60
                with output.open('rb') as pdf:
                    while chunk := pdf.read(64 * 1024):
                        if time.monotonic() >= deadline:
                            raise BrokenPipeError()
                        self.wfile.write(chunk)
        except ConversionError as error:
            self.error(error.status, error.code)
        except (TimeoutError, socket.timeout):
            self.error(408, 'presentation-upload-timeout')
        except (BrokenPipeError, ConnectionResetError):
            pass
        except OSError as error:
            self.error(507 if error.errno in (28, 122) else 422, 'presentation-storage-limit' if error.errno in (28, 122) else 'presentation-conversion-failed')
        except Exception:
            self.error(422, 'presentation-conversion-failed')
        finally:
            self.server.job.release()

    def do_GET(self):
        self.error(405, 'presentation-method-not-allowed')


class ConverterServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, path=SOCKET_PATH):
        self.job = threading.Lock()
        self.connections = threading.BoundedSemaphore(8)
        super().__init__(path, ConverterHandler)
        os.chmod(path, 0o666)

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(UPLOAD_TIMEOUT)
        return connection, address

    def process_request(self, request, client_address):
        if not self.connections.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.connections.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connections.release()

    def handle_error(self, *_):
        pass


def main():
    # Inherited by Office, without unsafe preexec callbacks from threaded handlers.
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_EXPANDED, MAX_EXPANDED))
    # The private disk mount has no application data. Reap only our stale jobs after restart.
    work = Path('/tmp/castlink-converter')
    work.mkdir(mode=0o700, exist_ok=True)
    if work.is_symlink() or work.stat().st_uid != os.getuid():
        raise RuntimeError('Invalid converter work root')
    for stale in work.glob('castlink-presentation-*'):
        if stale.is_dir() and not stale.is_symlink() and stale.stat().st_uid == os.getuid():
            shutil.rmtree(stale)
    tempfile.tempdir = str(work)
    path = Path(SOCKET_PATH)
    # The socket directory is the sole shared volume and is owned by worker UID10001.
    if path.exists() or path.is_symlink():
        if not stat.S_ISSOCK(path.lstat().st_mode):
            raise RuntimeError('Converter socket path is not a socket')
        path.unlink()
    with ConverterServer(str(path)) as worker:
        try:
            worker.serve_forever()
        finally:
            path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
