"""PPTX-to-PDF worker. Run only in the isolated converter service, never in web."""
import io
import json
import os
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

MAX_UPLOAD = 25 * 1024 * 1024
MAX_PDF = 100 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024
MAX_ENTRIES = 4096
MAX_IDENTITY_XML = 4 * 1024 * 1024
UPLOAD_TIMEOUT = 15
CONVERSION_TIMEOUT = 30
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


def entry_chunks(data, archive, info):
    """Inflate the complete stream, not ZipExtFile's declared-size-limited prefix."""
    # Let stdlib check local filename encoding and overlapping ZIP entries.
    with archive.open(info):
        pass
    offset = info.header_offset
    if offset < 0 or offset + 30 > archive.start_dir or data[offset:offset + 4] != b'PK\x03\x04':
        raise ConversionError(422, 'presentation-invalid-package')
    flags, method = struct.unpack_from('<HH', data, offset + 6)
    name_size, extra_size = struct.unpack_from('<HH', data, offset + 26)
    start = offset + 30 + name_size + extra_size
    end = start + info.compress_size
    if flags != info.flag_bits or method != info.compress_type or start > archive.start_dir or end > archive.start_dir:
        raise ConversionError(422, 'presentation-invalid-package')
    compressed = memoryview(data)[start:end]
    if method == zipfile.ZIP_STORED:
        for cursor in range(0, len(compressed), 64 * 1024):
            yield bytes(compressed[cursor:cursor + 64 * 1024])
        return
    inflater = zlib.decompressobj(-15)
    cursor = 0
    pending = b''
    while not inflater.eof:
        if not pending and cursor < len(compressed):
            pending = bytes(compressed[cursor:cursor + 64 * 1024])
            cursor += len(pending)
        chunk = inflater.decompress(pending, 64 * 1024)
        pending = inflater.unconsumed_tail
        if chunk:
            yield chunk
        if not chunk and not pending and cursor == len(compressed) and not inflater.eof:
            raise ConversionError(422, 'presentation-invalid-package')
    if inflater.unused_data or pending or cursor != len(compressed):
        raise ConversionError(422, 'presentation-invalid-package')


def validate_pptx(data):
    """Verify ZIP integrity and PPTX identity; leave rendering semantics to Impress."""
    if len(data) > MAX_UPLOAD:
        raise ConversionError(413, 'presentation-upload-limit')
    identity = {}
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
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
                for chunk in entry_chunks(data, archive, info):
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


def convert(data):
    validate_pptx(data)
    with tempfile.TemporaryDirectory(prefix='castlink-presentation-') as temporary:
        directory = Path(temporary)
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
        source = directory / 'slides.pptx'
        source.write_bytes(data)
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
                status = process.wait(timeout=CONVERSION_TIMEOUT)
            except subprocess.TimeoutExpired:
                raise ConversionError(504, 'presentation-conversion-timeout') from None
            if status != 0:
                raise ConversionError(422, 'presentation-conversion-failed')
            output = directory / 'slides.pdf'
            try:
                size = output.stat().st_size
                if size < 5 or size > MAX_PDF or output.is_symlink():
                    raise ConversionError(422, 'presentation-invalid-output')
                with output.open('rb') as pdf:
                    result = pdf.read(MAX_PDF + 1)
                if len(result) != size or not result.startswith(b'%PDF-'):
                    raise ConversionError(422, 'presentation-invalid-output')
                return result
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
            deadline = time.monotonic() + UPLOAD_TIMEOUT
            data = bytearray()
            while len(data) < length:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ConversionError(408, 'presentation-upload-timeout')
                self.connection.settimeout(remaining)
                chunk = self.rfile.read1(min(64 * 1024, length - len(data)))
                if not chunk:
                    raise ConversionError(400, 'presentation-upload-invalid')
                data.extend(chunk)
            self.connection.settimeout(10)
            self.respond(200, convert(bytes(data)), 'application/pdf')
        except ConversionError as error:
            self.error(error.status, error.code)
        except (TimeoutError, socket.timeout):
            self.error(408, 'presentation-upload-timeout')
        except (BrokenPipeError, ConnectionResetError):
            pass
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
