import io
import os
import socket
import socketserver
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import zipfile
import zlib
from pathlib import Path
from unittest.mock import patch

if not hasattr(socketserver, 'UnixStreamServer'):
    raise unittest.SkipTest('Linux converter tests run in Docker on Windows')

import server

CONTENT_TYPES = b'''<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>'''
MAIN = b'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'


def pptx(extra=(), content_types=CONTENT_TYPES):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, body in [('[Content_Types].xml', content_types), ('_rels/.rels', b'<Relationships/>'), ('ppt/presentation.xml', MAIN), *extra]:
            archive.writestr(name, body)
    return stream.getvalue()



def convert_fixture(data):
    with tempfile.TemporaryDirectory(prefix='castlink-fixture-') as temporary:
        directory = Path(temporary)
        source = directory / 'slides.pptx'
        source.write_bytes(data)
        return server.convert(source, directory).read_bytes()


def fake_convert(source, directory, cancelled=None):
    assert source.read_bytes() == pptx()
    output = directory / 'slides.pdf'
    output.write_bytes(b'%PDF-1.7\nfixture')
    return output


class DiskTests(unittest.TestCase):
    def test_validation_accepts_disk_source_without_whole_document_read(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'input.pptx'
            source.write_bytes(pptx([('ppt/media/data.bin', b'x' * 262144)]))
            server.validate_pptx(source)

    def test_forged_low_directory_count_rejected_before_zipfile_construction(self):
        data = bytearray(pptx([(f'ppt/media/{i}', b'x') for i in range(12)]))
        eocd = data.rindex(b'PK\x05\x06')
        struct.pack_into('<HH', data, eocd + 8, 1, 1)
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'forged.pptx'
            source.write_bytes(data)
            with patch.object(server.zipfile, 'ZipFile', side_effect=AssertionError('directory loaded before bounds')):
                with self.assertRaises(server.ConversionError) as caught:
                    server.validate_pptx(source)
                self.assertEqual(caught.exception.code, 'presentation-invalid-package')

    def test_directory_byte_budget_checked_before_zipfile_construction(self):
        data = pptx()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'directory.pptx'
            source.write_bytes(data)
            with patch.object(server, 'MAX_DIRECTORY', 1, create=True), patch.object(server.zipfile, 'ZipFile', side_effect=AssertionError('directory loaded before bounds')):
                with self.assertRaises(server.ConversionError) as caught:
                    server.validate_pptx(source)
                self.assertEqual(caught.exception.code, 'presentation-entries-limit')

    def test_nonsentinel_zip64_override_cannot_hide_oversized_directory(self):
        prefix = 16 * 1024 * 1024
        data = bytearray(prefix) + pptx()
        eocd = data.rindex(b'PK\x05\x06')
        last_record = data.rindex(b'PK\x01\x02', 0, eocd)
        size = struct.unpack_from('<L', data, eocd + 12)[0]
        offset = struct.unpack_from('<L', data, eocd + 16)[0]
        struct.pack_into('<L', data, eocd + 16, offset + prefix)
        # Hide ZIP64 metadata in the final central record comment. Python consumes it
        # even when the ordinary EOCD has no sentinel, so preflight must agree.
        struct.pack_into('<H', data, last_record + 32, 76)
        struct.pack_into('<L', data, eocd + 12, size + 76)
        hidden = struct.pack('<4sQ2H2L4Q', b'PK\x06\x06', 44, 45, 45, 0, 0, 3, 3, eocd, 0)
        hidden += struct.pack('<4sLQL', b'PK\x06\x07', 0, eocd, 1)
        data[eocd:eocd] = hidden
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / 'zip64.pptx'
            source.write_bytes(data)
            with patch.object(server.zipfile, 'ZipFile', side_effect=AssertionError('ZIP64 override bypassed preflight')):
                with self.assertRaises(server.ConversionError) as caught:
                    server.validate_pptx(source)
                self.assertEqual(caught.exception.code, 'presentation-entries-limit')

    def test_inclusive_decimal_limit(self):
        self.assertEqual(server.MAX_UPLOAD, 1_500_000_000)
        self.assertGreaterEqual(server.MAX_EXPANDED, server.MAX_UPLOAD)

class ArchiveTests(unittest.TestCase):
    def test_regular_office_parts_are_not_semantic_allowlisted(self):
        data = pptx([
            ('ppt/media/icon.svg', b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'),
            ('ppt/fonts/font.fntdata', b'embedded font'),
            ('ppt/charts/chart1.xml', b'<c:chart xmlns:c="urn:c"><c:f>Sheet1!A1</c:f></c:chart>'),
            ('ppt/slides/_rels/slide1.xml.rels', b'<r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><!-- Office comment --><r:Relationship Id="r1" Type="hyperlink" Target="https://example.com" TargetMode="External"/></r:Relationships>'),
            ('ppt/media/рисунок.png', b'not decoded by validation'),
        ])
        server.validate_pptx(data)

    def test_namespace_prefix_and_utf16_identity(self):
        types = CONTENT_TYPES.decode().replace('<?xml version="1.0"?>', '<?xml version="1.0" encoding="UTF-16"?>').replace('<Types ', '<ct:Types xmlns:ct="http://schemas.openxmlformats.org/package/2006/content-types" ').replace('<Override ', '<ct:Override ').replace('</Types>', '</ct:Types>')
        server.validate_pptx(pptx(content_types=types.encode('utf-16')))

    def assert_error(self, data, status):
        with self.assertRaises(server.ConversionError) as caught:
            server.validate_pptx(data)
        self.assertEqual(caught.exception.status, status)

    def test_non_presentation_zip_rejected(self):
        self.assert_error(pptx(content_types=CONTENT_TYPES.replace(b'presentationml.presentation.main+xml', b'wordprocessingml.document.main+xml')), 422)

    def test_corrupt_crc_rejected(self):
        data = bytearray(pptx())
        offset = data.index(b'PK\x01\x02')
        data[offset + 16] ^= 1
        self.assert_error(data, 422)

    def test_encrypted_archive_rejected(self):
        data = bytearray(pptx())
        for signature, flag_offset in [(b'PK\x03\x04', 6), (b'PK\x01\x02', 8)]:
            cursor = 0
            while True:
                cursor = data.find(signature, cursor)
                if cursor < 0:
                    break
                data[cursor + flag_offset] |= 1
                cursor += 4
        self.assert_error(data, 422)

    def test_dtd_and_entities_rejected_in_identity(self):
        for declaration in [b'<!DOCTYPE Types SYSTEM "file:///etc/passwd">', b'<!DOCTYPE Types [<!ENTITY x "x">]>']:
            self.assert_error(pptx(content_types=declaration + CONTENT_TYPES.split(b'?>')[1]), 422)

    def test_paths_duplicates_and_expansion_limit(self):
        for name in ['../outside', '/absolute', 'C:/outside', 'ppt/../outside', 'ppt\\outside']:
            self.assert_error(pptx([(name, b'x')]), 422)
        self.assert_error(pptx([('PPT/presentation.xml', MAIN)]), 422)
        with patch.object(server, 'MAX_EXPANDED', 1024):
            self.assert_error(pptx([('ppt/media/bomb', b'x' * 2048)]), 413)

    def test_uploaded_size_limit(self):
        with patch.object(server, 'MAX_UPLOAD', 1):
            self.assert_error(pptx(), 413)

    def test_understated_size_and_prefix_crc_cannot_hide_expansion(self):
        data = bytearray(pptx([('ppt/media/forged.bin', b'x' * 2_000_000)]))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            info = archive.getinfo('ppt/media/forged.bin')
            local = info.header_offset
        cursor = 0
        while True:
            cursor = data.index(b'PK\x01\x02', cursor)
            name_length = struct.unpack_from('<H', data, cursor + 28)[0]
            if data[cursor + 46:cursor + 46 + name_length] == b'ppt/media/forged.bin':
                break
            cursor += 4
        for offset, crc_offset, size_offset in [(local, 14, 22), (cursor, 16, 24)]:
            struct.pack_into('<I', data, offset + crc_offset, zlib.crc32(b'x'))
            struct.pack_into('<I', data, offset + size_offset, 1)
        # stdlib ZipExtFile accepts this forged prefix; the worker must prove the full stream.
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual(archive.read('ppt/media/forged.bin'), b'x')
        with patch.object(server, 'MAX_EXPANDED', 4096):
            self.assert_error(data, 413)


class SocketTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'converter.sock')
        self.server = server.ConverterServer(self.path)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, body, headers='', path='/convert'):
        with socket.socket(socket.AF_UNIX) as client:
            client.settimeout(3)
            client.connect(self.path)
            client.sendall(f'POST {path} HTTP/1.1\r\nHost: converter\r\nContent-Length: {len(body)}\r\n{headers}\r\n'.encode() + body)
            chunks = []
            while True:
                part = client.recv(65536)
                if not part:
                    break
                chunks.append(part)
        return b''.join(chunks)

    def test_real_socket_passes_bytes_and_returns_pdf(self):
        with patch.object(server, 'convert', side_effect=fake_convert) as convert:
            response = self.request(pptx())
        self.assertIn(b'200 OK', response)
        self.assertIn(b'Content-Type: application/pdf', response)
        self.assertTrue(response.endswith(b'%PDF-1.7\nfixture'))
        self.assertEqual(convert.call_count, 1)
        self.assertIsInstance(convert.call_args.args[0], Path)

    def test_insufficient_disk_rejected_before_converter_and_releases_job(self):
        from collections import namedtuple
        usage = namedtuple('usage', 'total used free')
        with patch.object(server.shutil, 'disk_usage', return_value=usage(100, 100, 0)), patch.object(server, 'convert') as convert:
            response = self.request(pptx())
            self.assertIn(b'507 Insufficient Storage', response)
            self.assertIn(b'presentation-storage-limit', response)
            convert.assert_not_called()
        while self.server.job.locked():
            time.sleep(0.001)
        with patch.object(server, 'convert', side_effect=fake_convert):
            self.assertIn(b'200 OK', self.request(pptx()))

    def test_second_job_is_rejected_without_queue(self):
        acquired = threading.Event()
        release = threading.Event()
        def hold(source, directory, cancelled):
            acquired.set()
            release.wait(3)
            return fake_convert(source, directory, cancelled)
        with patch.object(server, 'convert', side_effect=hold):
            first = threading.Thread(target=lambda: self.request(pptx()))
            first.start()
            self.assertTrue(acquired.wait(2))
            try:
                self.assertIn(b'429 Too Many Requests', self.request(pptx()))
            finally:
                release.set()
                first.join()

    def test_failure_releases_job(self):
        with patch.object(server, 'convert', side_effect=server.ConversionError(504, 'presentation-conversion-timeout')):
            self.assertIn(b'504 Gateway Timeout', self.request(pptx()))
        with patch.object(server, 'convert', side_effect=fake_convert):
            self.assertIn(b'200 OK', self.request(pptx()))

    def test_unknown_route_and_transfer_encoding_refused(self):
        self.assertIn(b'404 Not Found', self.request(b'', path='/anywhere'))
        self.assertIn(b'400 Bad Request', self.request(b'', headers='Transfer-Encoding: chunked\r\n'))

    def test_short_body_releases_job(self):
        with socket.socket(socket.AF_UNIX) as client:
            client.settimeout(3)
            client.connect(self.path)
            client.sendall(b'POST /convert HTTP/1.1\r\nHost: converter\r\nContent-Length: 100\r\n\r\nx')
            client.shutdown(socket.SHUT_WR)
            self.assertIn(b'400 Bad Request', client.recv(4096))
        with patch.object(server, 'convert', side_effect=fake_convert):
            self.assertIn(b'200 OK', self.request(pptx()))


class DiskUsageTests(unittest.TestCase):
    def test_counts_nested_regular_files_without_following_symlinks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            work = root / 'job'
            (work / 'nested').mkdir(parents=True)
            (work / 'first').write_bytes(b'abc')
            (work / 'nested/second').write_bytes(b'12345')
            outside = root / 'outside'
            outside.mkdir()
            (outside / 'private').write_bytes(b'excluded')
            (work / 'linked-directory').symlink_to(outside, target_is_directory=True)
            (work / 'linked-file').symlink_to(outside / 'private')
            self.assertEqual(server.job_disk_usage(work), 8)

    def test_file_removed_before_metadata_read_is_ignored(self):
        from unittest.mock import MagicMock
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            retained = directory / 'retained'
            retained.write_bytes(b'abc')
            fleeting = directory / 'fleeting'
            fleeting.write_bytes(b'12345')
            def vanish(**_):
                fleeting.unlink()
                return fleeting.lstat()
            missing = MagicMock()
            missing.stat.side_effect = vanish
            present = MagicMock()
            present.stat.return_value = retained.lstat()
            entries = MagicMock()
            entries.__enter__.return_value = iter([missing, present])
            with patch.object(server.os, 'scandir', return_value=entries):
                self.assertEqual(server.job_disk_usage(directory), 3)
            missing.stat.assert_called_once_with(follow_symlinks=False)
            self.assertFalse(fleeting.exists())

    def test_traversal_errors_other_than_missing_entries_are_not_ignored(self):
        with tempfile.TemporaryDirectory() as temporary:
            for error in [PermissionError(13, 'denied'), OSError(5, 'I/O error'), OSError(28, 'disk full')]:
                with self.subTest(error=error), patch.object(server.os, 'scandir', side_effect=error):
                    with self.assertRaises(type(error)) as caught:
                        server.job_disk_usage(Path(temporary))
                    self.assertIs(caught.exception, error)

    def test_directory_classification_errors_are_not_silently_skipped(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'blocked').mkdir()
            for error in [PermissionError(13, 'denied'), OSError(5, 'I/O error')]:
                class BrokenEntry:
                    name = 'blocked'
                    path = str(directory / 'blocked')
                    def is_dir(self, **_):
                        raise error
                    def stat(self, **_):
                        raise error
                class Entries:
                    def __init__(self):
                        self.entries = iter([BrokenEntry()])
                    def __iter__(self):
                        return self
                    def __next__(self):
                        return next(self.entries)
                    def __enter__(self):
                        return self
                    def __exit__(self, *_):
                        pass
                with self.subTest(error=error), patch.object(server.os, 'scandir', return_value=Entries()):
                    with self.assertRaises(type(error)) as caught:
                        server.job_disk_usage(directory)
                    self.assertIs(caught.exception, error)

    def test_metadata_errors_other_than_missing_entries_are_not_ignored(self):
        from unittest.mock import MagicMock
        with tempfile.TemporaryDirectory() as temporary:
            error = PermissionError(13, 'denied')
            entry = MagicMock()
            entry.stat.side_effect = error
            entries = MagicMock()
            entries.__enter__.return_value = iter([entry])
            with patch.object(server.os, 'scandir', return_value=entries):
                with self.assertRaises(PermissionError) as caught:
                    server.job_disk_usage(Path(temporary))
                self.assertIs(caught.exception, error)
            entry.stat.assert_called_once_with(follow_symlinks=False)


@unittest.skipUnless(os.name == 'posix', 'worker process isolation runs on Linux')
class ProcessTests(unittest.TestCase):
    def run_converter(self, program, expected=None, timeout=1):
        original = subprocess.Popen
        children = []
        def launch(arguments, **kwargs):
            self.assertIn('--infilter=Impress MS PowerPoint 2007 XML', arguments)
            self.assertNotIn('TEST_APPLICATION_SECRET', kwargs['env'])
            self.assertNotEqual(kwargs['env'].get('SAL_USE_VCLPLUGIN'), 'gen', 'headless worker must not require an X server')
            profile = Path(kwargs['cwd']) / 'profile/user/registrymodifications.xcu'
            self.assertIn('MacroSecurityLevel', profile.read_text())
            child = original([sys.executable, '-c', program], **kwargs)
            children.append(child)
            return child
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(server.tempfile, 'tempdir', temporary), patch.object(server.subprocess, 'Popen', side_effect=launch), patch.object(server, 'CONVERSION_TIMEOUT', timeout), patch.dict(os.environ, {'TEST_APPLICATION_SECRET': 'must-not-reach-child'}):
                if expected:
                    with self.assertRaises(server.ConversionError) as caught:
                        convert_fixture(pptx())
                    self.assertEqual(caught.exception.code, expected)
                else:
                    self.assertEqual(convert_fixture(pptx()), b'%PDF-1.7\nfixture')
            self.assertEqual(list(Path(temporary).iterdir()), [], 'every job directory is removed')
        for child in children:
            with self.assertRaises(ProcessLookupError):
                os.killpg(child.pid, 0)

    def test_success_has_fresh_profile_and_no_secret_environment(self):
        self.run_converter("from pathlib import Path;Path('slides.pdf').write_bytes(b'%PDF-1.7\\nfixture')")

    def test_converter_crash_is_reported_and_cleaned(self):
        self.run_converter('raise SystemExit(9)', 'presentation-conversion-failed')

    def test_missing_and_invalid_output_are_not_returned(self):
        self.run_converter('pass', 'presentation-conversion-failed')
        self.run_converter("from pathlib import Path;Path('slides.pdf').write_bytes(b'not a PDF')", 'presentation-invalid-output')

    def test_oversized_output_has_precise_error(self):
        self.run_converter("from pathlib import Path;p=Path('slides.pdf');p.write_bytes(b'%PDF-1.7');p.open('r+b').truncate(1_500_000_001)", 'presentation-output-limit')

    def test_client_cancel_kills_office_process_group(self):
        original = subprocess.Popen
        started = threading.Event()
        children = []
        def launch(_, **kwargs):
            child = original([sys.executable, '-c', 'import time;time.sleep(60)'], **kwargs)
            children.append(child)
            started.set()
            return child
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / 'slides.pptx'
            source.write_bytes(pptx())
            with patch.object(server.subprocess, 'Popen', side_effect=launch):
                with self.assertRaises(server.ConversionError) as caught:
                    server.convert(source, directory, started.is_set)
                self.assertEqual(caught.exception.code, 'presentation-upload-cancelled')
        self.assertEqual(len(children), 1)
        with self.assertRaises(ProcessLookupError):
            os.killpg(children[0].pid, 0)

    def test_office_directory_removed_during_disk_scan_does_not_cancel_conversion(self):
        original = os.scandir
        transient = None
        created = False
        vanished = False
        def racing_scandir(location):
            nonlocal transient, created, vanished
            if isinstance(location, (str, os.PathLike)):
                current = Path(location)
                if current.name.startswith('castlink-fixture-') and not created:
                    transient = current / 'transient-office.tmp'
                    transient.mkdir()
                    created = True
                if transient is not None and current == transient and not vanished:
                    transient.rmdir()
                    vanished = True
            return original(location)
        with patch.object(server.os, 'scandir', side_effect=racing_scandir):
            self.run_converter("from pathlib import Path;Path('slides.pdf').write_bytes(b'%PDF-1.7\\nfixture')")
        self.assertTrue(vanished, 'fixture must remove a discovered Office directory before traversal')

    def test_aggregate_job_disk_budget_is_still_enforced(self):
        with patch.object(server, 'MAX_JOB_DISK', 0):
            self.run_converter('import time;time.sleep(60)', 'presentation-storage-limit')

    def test_hung_process_group_is_killed(self):
        self.run_converter('import time;time.sleep(60)', 'presentation-conversion-timeout', timeout=0.05)

    @unittest.skipUnless(os.environ.get('CASTLINK_TEST_INIT') == '1', 'run this proof in Docker with --init')
    def test_init_reaps_timeout_descendants(self):
        original = subprocess.Popen
        with tempfile.TemporaryDirectory() as temporary:
            marker = Path(temporary) / 'child.pid'
            program = ("import subprocess,sys,time;from pathlib import Path;"
                       "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)']);"
                       f"Path({str(marker)!r}).write_text(str(child.pid));time.sleep(60)")
            def launch(_, **kwargs):
                return original([sys.executable, '-c', program], **kwargs)
            with patch.object(server.subprocess, 'Popen', side_effect=launch), patch.object(server, 'CONVERSION_TIMEOUT', 1):
                with self.assertRaises(server.ConversionError) as caught:
                    convert_fixture(pptx())
                self.assertEqual(caught.exception.code, 'presentation-conversion-timeout')
            pid = int(marker.read_text())
            for _ in range(100):
                if not Path(f'/proc/{pid}').exists():
                    break
                time.sleep(0.02)
            self.assertFalse(Path(f'/proc/{pid}').exists(), 'init must reap killed Office descendants')


if __name__ == '__main__':
    unittest.main()
