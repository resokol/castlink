"""Synthetic Linux trees only; never touches a real guest or service."""
import importlib.util
import contextlib
import io
import json
import os
import shlex
import shutil
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('maintenance', ROOT / 'scripts/server-wsl-maintenance.py')
HOST = 'a' * 32
SOURCE = {'schemaVersion': 1, 'version': '1.0.5-rc.1', 'commit': '085b087a2458' + 'a' * 28, 'buildId': '1.0.5-rc.1-085b087a2458'}
TARGET = {'schemaVersion': 1, 'version': '1.0.6', 'commit': 'b'*40, 'buildId': '1.0.6-'+'b'*12,
          'lifecycle': {'schemaVersion': 1, 'runtimeContract': 'castlink-wsl-pg16-v1', 'postgresMajor': 16, 'supportedSources': ['server-wsl-v'+SOURCE['buildId']]}}

RC2 = {'schemaVersion': 1, 'version': '1.0.5-rc.2', 'commit': 'af3e309d09265412d8d6c74e78cf8a181957ad07',
       'buildId': '1.0.5-rc.2-af3e309d0926', 'lifecycle': dict(TARGET['lifecycle'])}
RC3 = {**TARGET, 'version': '1.0.5-rc.3', 'buildId': '1.0.5-rc.3-'+'b'*12,
       'lifecycle': {**TARGET['lifecycle'], 'supportedSources': ['server-wsl-v'+r['buildId'] for r in (SOURCE, RC2)]}}

class TransferTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not Path(spec.origin).exists():
            raise AssertionError('Guest maintenance helper is not implemented')
        cls.m = importlib.util.module_from_spec(spec); spec.loader.exec_module(cls.m)
        cls.real_firewall=staticmethod(cls.m.Maintenance.firewall)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        addresses=patch.object(self.m.runtime,'local_ipv4_addresses',return_value=set());addresses.start();self.addCleanup(addresses.stop)
        firewall = patch.object(self.m.Maintenance, 'firewall');firewall.start();self.addCleanup(firewall.stop)
        self.source = self.fixture('source', SOURCE)
        self.target = self.fixture('target', TARGET, False)

    def fixture(self, name, release, populated=True):
        root=self.base/name
        for p in ('var/lib', 'etc/castlink-server', 'opt/castlink'):
            (root/p).mkdir(parents=True,exist_ok=True)
        (root/'var/lib/castlink-server-wsl-installation-id').write_text(HOST+'\n')
        (root/'opt/castlink/release.json').write_text(json.dumps(release))
        if populated:
            state=root/'var/lib/castlink-server'
            self.m.runtime.init_state(state,'studio.example.org','203.0.113.2',release,'c'*64,turn_host='turn.example.org')
            s=json.loads((state/'state.json').read_text());s.update(completed=True,databasePhase='seed',postgresRoleCreated=True)
            (state/'state.json').write_text(json.dumps(s))
            for p in ('postgres','data','caddy'):(state/p).mkdir(mode=0o700)
            (state/'postgres/PG_VERSION').write_text('16\n')
            (state/'postgres/castlink-installation-id').write_text(s['installationId']+'\n')
            (state/'data/rooms.json').write_bytes(b'room-history-and-uuid')
            (state/'caddy/private.key').write_bytes(b'TLS-private-key');(state/'caddy/private.key').chmod(0o600)
            self.write_configs(root)
        return root

    def write_configs(self,root):
        state=root/'var/lib/castlink-server';s=self.m.runtime.load_state(state)
        for n,v in self.m.runtime.configs(s,json.loads((state/'secrets.json').read_text()),set()).items():
            (root/'etc/castlink-server'/n).write_text(v)

    def helper(self,root,stopped=True):
        # All OS accounts map to fixture uid/gid. No production test switch exists.
        return self.m.Maintenance(root, stopped=lambda:stopped, accounts={n:(os.geteuid(),os.getegid()) for n in self.m.ACCOUNTS})

    def export(self):
        out=io.BytesIO();self.helper(self.source).export(HOST,out);return out.getvalue()

    def test_round_trip_preserves_uuid_credentials_rooms_tls_and_modes(self):
        before={str(p.relative_to(self.source/'var/lib/castlink-server')):p.read_bytes() for p in (self.source/'var/lib/castlink-server').rglob('*') if p.is_file()}
        target_host='e'*32
        (self.target/'var/lib/castlink-server-wsl-installation-id').write_text(target_host+'\n')
        self.helper(self.target).import_(target_host,io.BytesIO(self.export()))
        self.assertEqual((self.target/'var/lib/castlink-server-wsl-installation-id').read_text(),target_host+'\n')
        target=self.target/'var/lib/castlink-server'
        for name,data in before.items():
            if name!='state.json':self.assertEqual((target/name).read_bytes(),data)
            self.assertEqual((target/name).stat().st_mode&0o777,(self.source/'var/lib/castlink-server'/name).stat().st_mode&0o777)
        state=json.loads((target/'state.json').read_text());old=json.loads(before['state.json'])
        for key in ('installationId','nodeId','address','origin','mediaIp','turnHost','publicHttps','roomCreationPasswordHash'):self.assertEqual(state[key],old[key])
        self.assertEqual(state['release'],TARGET)
        self.assertEqual((target/'caddy/private.key').stat().st_mode&0o777,0o600)
        self.assertEqual((self.source/'var/lib/castlink-server/state.json').read_bytes(),before['state.json'])

    def test_rc2_export_and_rc3_import_preserve_data_and_source_identity(self):
        self.source=self.fixture('published-rc2',RC2)
        (self.target/'opt/castlink/release.json').write_text(json.dumps(RC3))
        state_path=self.source/'var/lib/castlink-server/state.json';before=state_path.read_bytes()
        data=self.export()
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as archive:
            self.assertEqual(json.load(archive.extractfile('manifest.json'))['sourceRelease'],RC2)
        self.helper(self.target).import_(HOST,io.BytesIO(data))
        source=self.source/'var/lib/castlink-server';target=self.target/'var/lib/castlink-server'
        old=json.loads(before);new=json.loads((target/'state.json').read_text())
        for key in ('installationId','nodeId','address','origin','mediaIp','turnHost','publicHttps','roomCreationPasswordHash'):
            self.assertEqual(new[key],old[key])
        for name in ('secrets.json','data/rooms.json','caddy/private.key'):
            self.assertEqual((target/name).read_bytes(),(source/name).read_bytes())
            self.assertEqual((target/name).stat().st_mode&0o777,(source/name).stat().st_mode&0o777)
        self.assertEqual(new['release'],RC3);self.assertEqual(state_path.read_bytes(),before)

    def test_target_must_explicitly_list_actual_transfer_source(self):
        for number,(source,allowed) in enumerate(((RC2,SOURCE),(SOURCE,RC2))):
            with self.subTest(source=source['buildId']):
                self.source=self.fixture('membership-source-'+str(number),source)
                target=self.fixture('membership-target-'+str(number),{**RC3,'lifecycle':{
                    **RC3['lifecycle'],'supportedSources':['server-wsl-v'+allowed['buildId']]}},False)
                with self.assertRaisesRegex(ValueError,'Target does not explicitly support this source'):
                    self.helper(target).import_(HOST,io.BytesIO(self.export()))
                self.assertFalse((target/'var/lib/castlink-server').exists())

    def test_unknown_transfer_sources_refused_even_when_target_lists_them(self):
        with tarfile.open(fileobj=io.BytesIO(self.export()),mode='r:') as archive:
            manifest=json.load(archive.extractfile('manifest.json'))
        for number,version in enumerate(('1.0.5-rc.2','1.0.7')):
            with self.subTest(version=version):
                unknown={'schemaVersion':1,'version':version,'commit':'d'*40,'buildId':version+'-'+'d'*12}
                source=self.fixture('unknown-source-'+str(number),unknown)
                with self.assertRaisesRegex(ValueError,'Unsupported source release'):
                    self.helper(source).export(HOST,io.BytesIO())
                (self.target/'opt/castlink/release.json').write_text(json.dumps({**RC3,'lifecycle':{
                    **RC3['lifecycle'],'supportedSources':['server-wsl-v'+unknown['buildId']]}}))
                with self.assertRaisesRegex(ValueError,'Unsupported transfer source'):
                    self.helper(self.target).validate_manifest({**manifest,'sourceRelease':unknown})

    def test_inspect_is_bounded_and_contains_no_secrets(self):
        result=self.helper(self.source).inspect(HOST)
        self.assertEqual(result['postgresMajor'],16);self.assertTrue(result['stopped']);self.assertGreater(result['dataBytes'],0)
        self.assertNotIn('secrets',json.dumps(result));self.assertLess(len(json.dumps(result)),4096)

    def test_foreign_running_pg_and_custom_config_refused(self):
        with self.assertRaises(ValueError):self.helper(self.source).inspect('f'*32)
        with self.assertRaises(ValueError):self.helper(self.source,False).export(HOST,io.BytesIO())
        (self.source/'var/lib/castlink-server/postgres/PG_VERSION').write_text('17')
        with self.assertRaises(ValueError):self.export()
        (self.source/'var/lib/castlink-server/postgres/PG_VERSION').write_text('16')
        (self.source/'etc/castlink-server/web.env').write_text('custom=value')
        with self.assertRaises(ValueError):self.export()

    def test_incompatible_target_and_nonempty_target_refused(self):
        data=self.export();release=dict(TARGET);release['lifecycle']={**TARGET['lifecycle'],'supportedSources':[]}
        (self.target/'opt/castlink/release.json').write_text(json.dumps(release))
        with self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(data))
        self.assertFalse((self.target/'var/lib/castlink-server').exists())
        (self.target/'opt/castlink/release.json').write_text(json.dumps(TARGET))
        (self.target/'var/lib/castlink-server').mkdir();(self.target/'var/lib/castlink-server/unknown').touch()
        with self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(data))

    def mutate(self,data,kind):
        out=io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as source,tarfile.open(fileobj=out,mode='w:') as dest:
            for entry in source:
                body=source.extractfile(entry).read() if entry.isfile() else None
                dest.addfile(entry,io.BytesIO(body) if body is not None else None)
            member=tarfile.TarInfo('state/data/evil')
            if kind=='traversal':member.name='../escape'
            elif kind=='duplicate':member.name='manifest.json'
            elif kind=='symlink':member.type=tarfile.SYMTYPE;member.linkname='/etc/passwd'
            elif kind=='hardlink':member.type=tarfile.LNKTYPE;member.linkname='state/secrets.json'
            elif kind=='device':member.type=tarfile.CHRTYPE
            dest.addfile(member)
        return out.getvalue()

    def test_hostile_archives_leave_candidate_empty(self):
        data=self.export()
        for kind in ('traversal','duplicate','symlink','hardlink','device'):
            with self.subTest(kind=kind),self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(self.mutate(data,kind)))
            self.assertFalse((self.target/'var/lib/castlink-server').exists())

    def test_export_rejects_links_unknown_owners_and_pid(self):
        state=self.source/'var/lib/castlink-server'
        (state/'data/link').symlink_to('/etc/passwd')
        with self.assertRaises(ValueError):self.export()
        (state/'data/link').unlink();os.link(state/'secrets.json',state/'data/link')
        with self.assertRaises(ValueError):self.export()
        (state/'data/link').unlink();(state/'postgres/postmaster.pid').write_text('123')
        with self.assertRaises(ValueError):self.export()

    def test_gate_refuses_running_and_requires_durable_commit_token(self):
        with self.assertRaises(ValueError):self.helper(self.source,False).gate_close(HOST,'test-transaction')
        with patch.object(self.m.runtime,'run',return_value='') as run:
            self.helper(self.source).gate_close(HOST,'test-transaction')
            gate=self.helper(self.source).gate();self.assertEqual(gate['phase'],'closed')
            self.assertGreaterEqual(len(gate['probeToken']),64)
            self.assertEqual((self.source/'etc/castlink-server/maintenance.json').stat().st_mode&0o777,0o600)
            with self.assertRaises(ValueError):self.helper(self.source).gate_open(HOST,'other-transaction')
            self.helper(self.source).gate_open(HOST,'test-transaction')
            self.helper(self.source).gate_open(HOST,'test-transaction')
            self.assertEqual(self.helper(self.source).gate()['phase'],'committed')

    def test_import_rejects_corrupt_payload_and_truncated_archive(self):
        data=self.export()
        self.assertIn(b'room-history-and-uuid',data)
        for changed in (data.replace(b'room-history-and-uuid',b'evil-history-and-uuid'),data[:len(data)//2]):
            with self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(changed))
            self.assertFalse((self.target/'var/lib/castlink-server').exists())

    def test_uninitialized_inspection_distinguishes_incomplete_state(self):
        result=self.helper(self.target).inspect(HOST)
        self.assertFalse(result['initialized']);self.assertTrue(result['stopped'])
        with self.assertRaises(ValueError):self.helper(self.target).export(HOST,io.BytesIO())
        state=self.source/'var/lib/castlink-server/state.json'
        value=json.loads(state.read_text());value['completed']=False;state.write_text(json.dumps(value))
        self.assertFalse(self.helper(self.source).inspect(HOST)['complete'])
        with self.assertRaises(ValueError):self.export()

    def test_archive_rejects_trailing_nonzero_bytes(self):
        with self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(self.export()+b'UNTRUSTED TRAILER'))

    def test_account_mapping_refuses_foreign_uid_gid(self):
        helper=self.helper(self.source)
        info=os.stat(self.source/'var/lib/castlink-server/secrets.json')
        helper.accounts={n:(99999,99999) for n in self.m.ACCOUNTS}
        with self.assertRaises(ValueError):helper.account_for('state/secrets.json',info)

    def test_gate_close_recovers_after_marker_write_interruption(self):
        helper=self.helper(self.source)
        with patch.object(helper,'reconcile_config',side_effect=OSError('interruption')):
            with self.assertRaises(OSError):helper.gate_close(HOST,'interrupted')
        self.assertEqual(helper.gate()['phase'],'closed')
        helper.gate_close(HOST,'interrupted')
        self.assertIn('Maintenance', (self.source/'etc/castlink-server/Caddyfile').read_text())
        self.assertEqual(helper.gate()['phase'],'closed')

    def test_gate_open_interruption_records_irreversible_commit_first(self):
        helper=self.helper(self.source);helper.gate_close(HOST,'interrupted')
        with patch.object(helper,'reconfigure',side_effect=OSError('interruption')):
            with self.assertRaises(OSError):helper.gate_open(HOST,'interrupted')
        self.assertEqual(helper.gate()['phase'],'committed')
        helper.gate_open(HOST,'interrupted')
        self.assertNotIn('Maintenance', (self.source/'etc/castlink-server/Caddyfile').read_text())

    def test_firewall_rejects_foreign_table_and_changes_only_its_owned_table(self):
        class Result:
            returncode=0
            stdout=json.dumps({'nftables':[]})
        helper=self.helper(self.source)
        with patch.object(self.m.subprocess,'run',return_value=Result()),patch.object(self.m.runtime,'run',return_value='') as command:
            self.real_firewall(helper,HOST,closed=True)
            self.assertEqual(command.call_args.args[0],['/usr/sbin/nft','-f','-'])
            self.assertIn('castlink:'+HOST,command.call_args.kwargs['data'])
        Result.stdout=json.dumps({'nftables':[{'table':{'family':'inet','name':'unrelated'}}]})
        with patch.object(self.m.subprocess,'run',return_value=Result()),patch.object(self.m.runtime,'run') as command:
            self.real_firewall(helper,HOST,closed=False)
            command.assert_not_called()
        Result.stdout=json.dumps({'nftables':[{'table':{'family':'inet','name':'castlink_maintenance'}}]})
        for comment in ('foreign','castlink:'+HOST):
            with patch.object(self.m.subprocess,'run',return_value=Result()),patch.object(self.m.runtime,'run',return_value=json.dumps({'nftables':[{'table':{'comment':comment}}]})) as command:
                if comment=='foreign':
                    with self.assertRaises(ValueError):self.real_firewall(helper,HOST,closed=False)
                    self.assertEqual(command.call_count,1)
                else:
                    self.real_firewall(helper,HOST,closed=False)
                    self.assertEqual(command.call_args.args[0],['/usr/sbin/nft','delete','table','inet','castlink_maintenance'])

    def test_created_gate_keeps_owner_comment_through_preflight_and_release(self):
        # nft 1.0.9 sets table metadata on creation; a later `table NAME {}`
        # declaration adds chains/rules but does not retrofit its table comment.
        # Derive the JSON receipt from emitted commands, never from HOST itself.
        tables={'unrelated':{'family':'inet','name':'unrelated','comment':'foreign'}}
        batches=[]
        def execute_batch(text):
            lexer=shlex.shlex(text,posix=True,punctuation_chars='{};');lexer.whitespace_split=True
            tokens=list(lexer);index=0
            while index<len(tokens):
                exclusive=tokens[index]=='create'
                if exclusive:index+=1
                self.assertEqual(tokens[index],'table');index+=1
                family,name=tokens[index:index+2];index+=2
                metadata={'family':family,'name':name}
                if index<len(tokens) and tokens[index]=='{':
                    index+=1;depth=1
                    while depth:
                        token=tokens[index];index+=1
                        if token=='{':depth+=1
                        elif token=='}':depth-=1
                        elif token=='comment' and depth==1:
                            metadata['comment']=tokens[index];index+=1
                if name in tables:
                    if exclusive:raise ValueError('Table already exists')
                else:tables[name]=metadata
        def command(args,**kwargs):
            if args==['/usr/sbin/nft','-j','list','tables']:
                return json.dumps({'nftables':[{'table':value} for value in tables.values()]})
            if args==['/usr/sbin/nft','-j','list','table','inet','castlink_maintenance']:
                return json.dumps({'nftables':[{'metainfo':{'version':'1.0.9'}},{'table':tables['castlink_maintenance']}]})
            if args==['/usr/sbin/nft','-f','-']:
                batches.append(kwargs['data']);execute_batch(kwargs['data']);return ''
            if args==['/usr/sbin/nft','delete','table','inet','castlink_maintenance']:
                del tables['castlink_maintenance'];return ''
            self.fail('Unexpected fixture command: '+repr(args))
        def process(args,**kwargs):
            from types import SimpleNamespace
            return SimpleNamespace(returncode=0,stdout=command(args,**kwargs))
        helper=self.helper(self.source)
        helper.firewall=lambda installation_id,**kwargs:self.real_firewall(helper,installation_id,**kwargs)
        with patch.object(self.m.subprocess,'run',side_effect=process),patch.object(self.m.runtime,'run',side_effect=command):
            helper.gate_close(HOST,'create-restart-release')
            self.assertEqual(tables['castlink_maintenance'].get('comment'),'castlink:'+HOST)
            with patch.object(self.m.runtime,'prepare_maintenance_gate',return_value=(helper,helper.gate())), \
                 patch.object(self.m.runtime.socket,'socket'):
                self.m.runtime.preflight_ports()
            self.assertEqual(len(batches),1)
            helper.gate_close(HOST,'create-restart-release',release_stopped_firewall=True)
            self.assertNotIn('castlink_maintenance',tables)
            self.assertEqual(tables['unrelated'],{'family':'inet','name':'unrelated','comment':'foreign'})

    def test_wrong_host_cannot_reuse_existing_gate(self):
        helper=self.helper(self.source);helper.gate_close(HOST,'one')
        path=self.source/'etc/castlink-server/maintenance.json'
        gate=json.loads(path.read_text());gate['hostInstallationId']='f'*32;path.write_text(json.dumps(gate));path.chmod(0o600)
        with self.assertRaises(ValueError):helper.gate_close(HOST,'one')

    def test_import_cannot_restore_uncompleted_or_unknown_source_state(self):
        # Export provenance does not replace import validation of the stopped state.
        data=self.export();out=io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as source,tarfile.open(fileobj=out,mode='w:') as dest:
            manifest=None;records=[]
            for entry in source:
                body=source.extractfile(entry).read() if entry.isfile() else None
                if entry.name=='manifest.json':manifest=json.loads(body);continue
                if entry.name=='state/state.json':
                    state=json.loads(body);state['completed']=False;body=json.dumps(state).encode();entry.size=len(body)
                    for item in manifest['entries']:
                        if item['path']==entry.name:
                            item['size']=len(body);item['sha256']=__import__('hashlib').sha256(body).hexdigest()
                records.append((entry,body))
            body=json.dumps(manifest).encode();entry=tarfile.TarInfo('manifest.json');entry.size=len(body);entry.mode=0o600;dest.addfile(entry,io.BytesIO(body))
            for entry,body in records:dest.addfile(entry,io.BytesIO(body) if body is not None else None)
        with self.assertRaises(ValueError):self.helper(self.target).import_(HOST,io.BytesIO(out.getvalue()))

    def test_stopped_proof_refuses_surviving_public_or_private_listener(self):
        with self.stopped_environment() as (cgroups,evidence):
            evidence['state']='inactive'
            evidence['sockets']='tcp LISTEN 0 128 0.0.0.0:3000 0.0.0.0:*\n'
            self.assertFalse(self.m.stopped_services())

    def test_source_runtime_release_must_match_saved_state(self):
        (self.source/'opt/castlink/release.json').write_text(json.dumps(TARGET))
        with self.assertRaises(ValueError):self.export()

    def test_rollback_releases_only_stopped_candidate_firewall_and_keeps_gate_closed(self):
        helper=self.helper(self.source);helper.gate_close(HOST,'rollback')
        helper.firewall.reset_mock()
        helper.gate_close(HOST,'rollback',release_stopped_firewall=True)
        helper.firewall.assert_called_once_with(HOST,closed=False)
        self.assertEqual(helper.gate()['phase'],'closed')
        self.assertIn('Maintenance',(self.source/'etc/castlink-server/Caddyfile').read_text())
        with self.assertRaises(ValueError):self.helper(self.source,False).gate_close(HOST,'rollback',release_stopped_firewall=True)

    @contextlib.contextmanager
    def stopped_environment(self):
        from types import SimpleNamespace
        cgroups=self.base/'cgroups';(cgroups/'system.slice').mkdir(parents=True)
        (cgroups/'cgroup.controllers').write_text('cpu memory pids\n')
        mountinfo=self.base/'mountinfo'
        mountinfo.write_text('36 25 0:32 / '+str(cgroups)+' rw - cgroup2 cgroup rw\n')
        evidence={'state':'failed','properties':{},'unitProperties':{},'omit':set(),'extra':'','sockets':'','processes':[]}
        def command(args,**kwargs):
            if args[0]=='/usr/bin/ss':return SimpleNamespace(returncode=0,stdout=evidence['sockets'])
            unit=args[2].removesuffix('.service')+'.service'
            fields={'Id':unit,'LoadState':'loaded','ActiveState':evidence['state'],
                    'MainPID':'0','ControlPID':'0','Slice':'system.slice','ControlGroup':''}
            fields.update(evidence['properties']);fields.update(evidence['unitProperties'].get(unit,{}))
            return SimpleNamespace(returncode=0,stdout=''.join(key+'='+value+'\n' for key,value in fields.items() if key not in evidence['omit'])+evidence['extra'])
        with patch.object(self.m,'CGROUP_ROOT',cgroups,create=True),patch.object(self.m,'CGROUP_MOUNTINFO',mountinfo,create=True), \
             patch.object(self.m.subprocess,'run',side_effect=command), \
             patch.object(Path,'glob',side_effect=lambda *args,**kwargs:evidence['processes']):
            yield cgroups,evidence

    def test_failed_units_are_stopped_only_without_processes_listeners_or_pid(self):
        from types import SimpleNamespace
        helper=self.helper(self.source);helper.stopped=self.m.stopped_services
        with self.stopped_environment() as (cgroups,evidence):
            self.assertTrue(self.m.stopped_services())
            helper.require_stopped()
            pid=self.source/'var/lib/castlink-server/postgres/postmaster.pid';pid.write_text('123')
            with self.assertRaises(ValueError):helper.require_stopped()
            pid.unlink()
            evidence['sockets']='tcp LISTEN 0 128 0.0.0.0:7881 0.0.0.0:*\n'
            self.assertFalse(self.m.stopped_services())
            evidence['sockets']=''
            evidence['processes']=[SimpleNamespace(read_text=lambda:'postgres\n')]
            self.assertFalse(self.m.stopped_services())
            evidence['processes']=[]
            for state in ('active','activating','deactivating','reloading','unknown'):
                evidence['state']=state
                self.assertFalse(self.m.stopped_services())

    def test_failed_owned_node_python_descendants_without_listeners_are_not_stopped(self):
        from types import SimpleNamespace
        with self.stopped_environment() as (cgroups,evidence):
            for service,comm in (('castlink-web','node'),('castlink-converter','python3')):
                group=cgroups/'system.slice'/(service+'.service');(group/'worker').mkdir(parents=True)
                (group/'cgroup.events').write_text('populated 1\nfrozen 0\n')
                (group/'cgroup.procs').write_text('')
                (group/'worker/cgroup.procs').write_text('123\n')
                evidence['processes']=[SimpleNamespace(read_text=lambda:comm+'\n')]
                with self.subTest(service=service):self.assertFalse(self.m.stopped_services())
                shutil.rmtree(group)
                self.assertTrue(self.m.stopped_services())  # Unrelated Node/Python names confer no unit ownership.

    def test_unit_pid_binding_and_cgroup_evidence_must_be_unambiguous(self):
        with self.stopped_environment() as (cgroups,evidence):
            self.assertTrue(self.m.stopped_services())
            for properties in ({'MainPID':'123'},{'ControlPID':'123'},{'MainPID':''},
                               {'Id':'foreign.service'},{'LoadState':'not-found'},{'Slice':'foreign.slice'},
                               {'ControlGroup':'/system.slice/foreign.service'}):
                evidence['properties']=properties
                with self.subTest(properties=properties):self.assertFalse(self.m.stopped_services())
            evidence['properties']={}
            evidence['omit']={'MainPID'}
            self.assertFalse(self.m.stopped_services())
            evidence['omit']=set();evidence['extra']='MainPID=0\n'
            self.assertFalse(self.m.stopped_services())
            evidence['extra']=''
            group=cgroups/'system.slice/castlink-web.service';group.mkdir()
            self.assertFalse(self.m.stopped_services())  # Existing group without readable kernel evidence.
            (group/'cgroup.events').write_text('populated 0\nfrozen 0\n');(group/'cgroup.procs').write_text('')
            self.assertTrue(self.m.stopped_services())
            evidence['unitProperties']={'castlink-web.service':{'ControlGroup':'/system.slice/castlink-web.service'}}
            self.assertTrue(self.m.stopped_services())
            evidence['unitProperties']={}
            (group/'cgroup.procs').write_text('123\n')
            self.assertFalse(self.m.stopped_services())
            (group/'cgroup.procs').write_text('')
            (group/'cgroup.events').write_text('frozen 0\n')
            self.assertFalse(self.m.stopped_services())
            (group/'cgroup.events').write_text('populated 0\npopulated 0\n')
            self.assertFalse(self.m.stopped_services())
            (group/'cgroup.events').write_text('populated 0\nfrozen 0\n')
            self.assertTrue(self.m.stopped_services())
            (cgroups/'cgroup.controllers').unlink()
            self.assertFalse(self.m.stopped_services())
            (cgroups/'cgroup.controllers').write_text('cpu memory pids\n')
            self.m.CGROUP_MOUNTINFO.write_text('36 25 0:32 / '+str(cgroups)+' rw - cgroup cgroup rw\n')
            self.assertFalse(self.m.stopped_services())

    def test_raw_archive_extensions_are_rejected_before_publication(self):
        data=self.export()
        for kind,body in ((tarfile.XHDTYPE,b''),(tarfile.XGLTYPE,b''),
                          (tarfile.GNUTYPE_LONGNAME,b'manifest.json\0'),
                          (tarfile.GNUTYPE_LONGLINK,b'state/secrets.json\0')):
            header=tarfile.TarInfo('extension');header.type=kind;header.size=len(body)
            prefix=header.tobuf(format=tarfile.USTAR_FORMAT)+body+b'\0'*((-len(body))%512)
            for position in ('first','after-manifest'):
                if position=='first':changed=prefix+data
                else:
                    first=tarfile.TarInfo.frombuf(data[:512],'utf-8','strict')
                    offset=512+((first.size+511)//512)*512
                    changed=data[:offset]+prefix+data[offset:]
                with self.subTest(type=kind,position=position),self.assertRaises(ValueError):
                    self.helper(self.target).import_(HOST,io.BytesIO(changed))
                self.assertFalse((self.target/'var/lib/castlink-server').exists())
                self.assertEqual(list((self.target/'etc/castlink-server').iterdir()),[])

    def test_oversized_extension_is_refused_after_only_its_header(self):
        for kind in (tarfile.XHDTYPE,tarfile.XGLTYPE,tarfile.GNUTYPE_LONGNAME,tarfile.GNUTYPE_LONGLINK):
            header=tarfile.TarInfo('extension');header.type=kind;header.size=4*1024**3
            raw=header.tobuf(format=tarfile.USTAR_FORMAT)
            class HeaderOnly(io.BytesIO):
                def read(self,size=-1):
                    if size<0 or self.tell()+size>512:
                        raise AssertionError('Extension body read before rejection')
                    return super().read(size)
            source=HeaderOnly(raw)
            with self.subTest(type=kind),self.assertRaises(ValueError):self.helper(self.target).import_(HOST,source)
            self.assertEqual(source.tell(),512)
            self.assertFalse((self.target/'var/lib/castlink-server').exists())
            self.assertEqual(list((self.target/'etc/castlink-server').iterdir()),[])

    def test_gate_render_blocks_writes_and_existing_media_tokens(self):
        state=self.m.runtime.load_state(self.source/'var/lib/castlink-server')
        secrets=json.loads((self.source/'var/lib/castlink-server/secrets.json').read_text())
        cfg=self.m.runtime.configs(state,secrets,set(),gate={'phase':'closed','probeToken':'d'*64})
        caddy=cfg['Caddyfile']
        self.assertIn('method GET',caddy);self.assertIn('path /api/version',caddy)
        self.assertIn('X-CastLink-Maintenance-Probe',caddy);self.assertIn('respond "Maintenance" 503',caddy)
        self.assertNotIn('forward_auth',caddy)
        haproxy=self.m.runtime.haproxy_config(state,'/fake/cert.pem',gated=True)
        self.assertNotIn('server livekit ',haproxy);self.assertIn('acme-tls/1',haproxy)
        rules=self.m.gate_rules(HOST)
        for port in ('3478','7881','7882','30000-30031'):self.assertIn(port,rules)
        self.assertNotIn('443',rules)

if __name__=='__main__':unittest.main()
