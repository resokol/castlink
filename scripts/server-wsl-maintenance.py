#!/usr/bin/python3
"""Stopped-guest transfer v1 and fail-closed candidate admission (stdlib only)."""
import argparse
import contextlib
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

runtime_path = Path(__file__).with_name('server-wsl-runtime.py')
if not runtime_path.exists(): runtime_path = Path('/usr/local/bin/castlink-server')
from importlib.machinery import SourceFileLoader
spec = importlib.util.spec_from_loader('castlink_runtime', SourceFileLoader('castlink_runtime', str(runtime_path)))
runtime = importlib.util.module_from_spec(spec); spec.loader.exec_module(runtime)
ACCOUNTS = ('root', 'postgres', 'castlink', 'castlink-caddy', 'castlink-livekit', 'castlink-converter', 'castlink-turn')
CONTRACT = 'castlink-wsl-pg16-v1'
SUPPORTED_SOURCES = frozenset(('server-wsl-v1.0.5-rc.1-085b087a2458',
                               'server-wsl-v1.0.5-rc.2-af3e309d0926',
                               'server-wsl-v1.0.5-rc.3-95ec46463c82',
                               'server-wsl-v1.0.6-rc.1-dad063393b53'))
MAX_MANIFEST = 16 * 1024 * 1024
MAX_ENTRIES = 100000
MAX_BYTES = 1024 ** 4
CGROUP_ROOT = Path('/sys/fs/cgroup')
CGROUP_MOUNTINFO = Path('/proc/self/mountinfo')


class TransferTarInfo(tarfile.TarInfo):
    def _proc_member(self, archive):
        # This hook runs after the fixed 512-byte header is parsed, BEFORE
        # tarfile dispatches to PAX/GNU/sparse processors that read whole bodies.
        if self.type not in (tarfile.REGTYPE,tarfile.AREGTYPE,tarfile.DIRTYPE):
            raise ValueError('Archive extensions and special entries are unsupported')
        if self.size<0 or self.size>MAX_BYTES:
            raise ValueError('Archive member exceeds transfer bound')
        return super()._proc_member(archive)


def bounded_json(path, limit=65536):
    with open(path, 'rb') as source: data = source.read(limit + 1)
    if len(data) > limit: raise ValueError('Metadata exceeds bound')
    value = json.loads(data)
    if not isinstance(value, dict): raise ValueError('Invalid metadata')
    return value


def bounded_text(path,limit=65536):
    with open(path,'rb') as source:data=source.read(limit+1)
    if len(data)>limit:raise ValueError('Metadata exceeds bound')
    return data.decode('utf-8')


def load_state(folder):
    for name in ('state.json','secrets.json'):bounded_json(folder/name)
    return runtime.load_state(folder)


def gate_rules(installation_id):
    # Table metadata must be part of exclusive creation: nft 1.0.9 ignores
    # a comment in a subsequent declaration of an already-created table.
    return ('create table inet castlink_maintenance {\n comment "castlink:' + installation_id + '";\n'
            ' chain input { type filter hook input priority -20; policy accept;\n'
            '  ip saddr 127.0.0.1 ip daddr 127.0.0.1 accept\n'
            '  ip6 saddr ::1 ip6 daddr ::1 accept\n'
            '  tcp dport { 7881 } drop\n'
            '  udp dport { 3478, 7882, 30000-30031 } drop\n }\n}\n')


def cgroup_v2_available():
    try:
        if CGROUP_ROOT.is_symlink() or not CGROUP_ROOT.is_dir(): return False
        controllers=CGROUP_ROOT/'cgroup.controllers'
        if controllers.is_symlink(): return False
        bounded_text(controllers,4096)
        for line in bounded_text(CGROUP_MOUNTINFO,1024*1024).splitlines():
            fields=line.split()
            if len(fields)>6 and fields[3]=='/' and fields[4]==str(CGROUP_ROOT):
                separator=fields.index('-')
                return fields[separator+1]=='cgroup2'
    except (OSError,ValueError,IndexError,UnicodeError):
        return False
    return False


def unit_cgroup_empty(unit,control_group):
    expected='/system.slice/'+unit
    if control_group not in ('',expected): return False
    parent=CGROUP_ROOT/'system.slice'
    group=parent/unit
    try:
        if parent.is_symlink() or not parent.is_dir(): return False
        try: info=group.lstat()
        except FileNotFoundError:
            # systemd clears ControlGroup after removing an empty unit cgroup.
            # Check its exact default path too, rather than trusting an empty field.
            return True
        if not stat.S_ISDIR(info.st_mode): return False
        events=group/'cgroup.events';processes=group/'cgroup.procs'
        if events.is_symlink() or processes.is_symlink(): return False
        def unpopulated():
            values={}
            for line in bounded_text(events,4096).splitlines():
                key,value=line.split()
                if key in values: return False
                values[key]=value
            # cgroup v2 populated covers this cgroup AND every descendant.
            return values.get('populated')=='0'
        return unpopulated() and not bounded_text(processes,65536).strip() and unpopulated()
    except (OSError,ValueError,UnicodeError):
        return False


def stopped_services():
    if not cgroup_v2_available(): return False
    properties=('Id','LoadState','ActiveState','MainPID','ControlPID','ControlGroup','Slice')
    for service in runtime.SERVICES:
        unit=service+'.service'
        result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--property='+','.join(properties)],
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
        if result.returncode or len(result.stdout)>16384: return False
        values={}
        for line in result.stdout.splitlines():
            key,separator,value=line.partition('=')
            if not separator or key in values: return False
            values[key]=value
        if set(values)!=set(properties): return False
        # Preserve failed diagnostics, but require exact unit binding and zero
        # process IDs plus recursive kernel cgroup evidence for every owned unit.
        if values['Id']!=unit or values['LoadState']!='loaded' or values['Slice']!='system.slice': return False
        if values['ActiveState'] not in ('inactive','failed') or values['MainPID']!='0' or values['ControlPID']!='0': return False
        if not unit_cgroup_empty(unit,values['ControlGroup']): return False
    # A dead service receipt does not prove there are no surviving processes.
    for process in Path('/proc').glob('[0-9]*/comm'):
        try: name = process.read_text().strip()
        except FileNotFoundError: continue
        if name in ('postgres', 'livekit-server', 'haproxy', 'caddy'): return False
    result = subprocess.run(['/usr/bin/ss', '-H', '-lntu'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
    if result.returncode: return False
    ports = {80,443,3000,5432,5348,5349,7880,7881,7882,8443,3478,*range(30000,30032)}
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) < 6: return False
        try: port = int(fields[4].rsplit(':',1)[1])
        except (IndexError,ValueError): return False
        if port in ports: return False
    return True


class Maintenance:
    def __init__(self, root=Path('/'), *, stopped=stopped_services, accounts=None):
        self.root = Path(root)
        self.state = self.root/'var/lib/castlink-server'
        self.config = self.root/'etc/castlink-server'
        self.release = self.root/'opt/castlink/release.json'
        self.marker = self.root/'var/lib/castlink-server-wsl-installation-id'
        self.gate_path = self.config/'maintenance.json'
        self.stopped = stopped
        self.accounts = accounts if accounts is not None else {n:(pwd.getpwnam(n).pw_uid,pwd.getpwnam(n).pw_gid) for n in ACCOUNTS}

    def physical(self, path):
        for item in (path, *path.parents):
            if item.is_symlink(): raise ValueError('Linked installation paths are unsupported')
            if item == self.root: break

    def owned(self, installation_id):
        if not re.fullmatch('[a-f0-9]{32}', installation_id): raise ValueError('Invalid host installation ID')
        for p in (self.marker,self.state,self.config,self.release): self.physical(p)
        info = self.marker.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != self.accounts['root'][0] or info.st_size>128:
            raise ValueError('Guest ownership marker is invalid')
        if self.marker.read_text().strip() != installation_id: raise ValueError('Guest ownership mismatch')

    def require_stopped(self):
        if not self.stopped() or (self.state/'postgres/postmaster.pid').exists():
            raise ValueError('All guest services and PostgreSQL must be stopped')

    def gate(self):
        if not self.gate_path.exists() and not self.gate_path.is_symlink(): return None
        self.physical(self.gate_path)
        info = self.gate_path.stat()
        if info.st_uid != self.accounts['root'][0] or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise ValueError('Maintenance gate is not private')
        gate = bounded_json(self.gate_path)
        if gate.get('schemaVersion') != 1 or gate.get('phase') not in ('closed','committed') or not re.fullmatch('[a-f0-9]{64}',gate.get('probeToken','')):
            raise ValueError('Invalid maintenance gate')
        if not re.fullmatch('[A-Za-z0-9-]{1,80}',gate.get('transactionId','')): raise ValueError('Invalid maintenance transaction')
        if not re.fullmatch('[a-f0-9]{32}',gate.get('hostInstallationId','')) or self.marker.read_text().strip()!=gate['hostInstallationId']:
            raise ValueError('Maintenance gate ownership mismatch')
        return gate

    def inspect(self, installation_id):
        self.owned(installation_id)
        release = bounded_json(self.release); runtime.validate_release(release)
        result = {'schemaVersion':1,'hostInstallationId':installation_id,'initialized':False,'release':release,
                  'postgresMajor':None,'dataBytes':0,'stopped':self.stopped(),
                  'gate':(self.gate() or {}).get('phase'),'gateTransactionId':(self.gate() or {}).get('transactionId')}
        # A fresh imported distro has no guest application UUID yet.
        if not self.state.exists() or not any(self.state.iterdir()): return result
        state = load_state(self.state)
        pg = self.state/'postgres/PG_VERSION'
        major = int(bounded_text(pg,16).strip()) if pg.is_file() else None
        entries = self.inventory()
        result.update(initialized=True,guestInstallationId=state['installationId'],nodeId=state['nodeId'],
                      release=state['release'],postgresMajor=major,dataBytes=sum(e['size'] for e in entries),
                      stopped=result['stopped'] and not (self.state/'postgres/postmaster.pid').exists(),
                      complete=state.get('completed') is True and state.get('databasePhase')=='seed',
                      gate=(self.gate() or {}).get('phase'))
        if len(json.dumps(result))>65536:raise ValueError('Inspection output exceeds bound')
        return result

    def account_for(self,path,info):
        preferred = 'root'
        if path.startswith('state/postgres'): preferred='postgres'
        elif path.startswith('state/caddy') or path=='config/Caddyfile': preferred='castlink-caddy'
        elif path.startswith('state/data'): preferred='castlink'
        elif path=='config/livekit.json': preferred='castlink-livekit'
        if (info.st_uid,info.st_gid)==self.accounts[preferred]:return preferred
        for name,identity in self.accounts.items():
            if identity==(info.st_uid,info.st_gid):return name
        raise ValueError('Unknown file account ownership')

    def inventory(self):
        entries=[];total=0
        for label,folder in (('state',self.state),('config',self.config)):
            if not folder.exists(): raise ValueError('Incomplete source tree')
            self.physical(folder)
            paths=[folder,*sorted(folder.rglob('*'))]
            for path in paths:
                name=label+('/'+path.relative_to(folder).as_posix() if path!=folder else '')
                if name=='config/maintenance.json':continue
                if label=='config' and path!=folder and path.name not in ('web.env','livekit.json','Caddyfile'):
                    raise ValueError('Unknown custom configuration')
                if label=='state' and path.parent==folder and path.name not in ('state.json','secrets.json','postgres','data','caddy') and not re.fullmatch(r'owner-access-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{16}\.txt',path.name):
                    raise ValueError('Unknown top-level guest state; preserve for manual recovery')
                info=path.lstat()
                if not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)) or (stat.S_ISREG(info.st_mode) and info.st_nlink!=1):
                    raise ValueError('Links and special files cannot be transferred')
                mode=stat.S_IMODE(info.st_mode)
                if mode&0o7000 or mode&0o002:raise ValueError('Unsupported file permissions')
                size=info.st_size if path.is_file() else 0;total+=size
                if len(entries)>=MAX_ENTRIES or total>MAX_BYTES:raise ValueError('Transfer exceeds bound')
                digest=None
                if path.is_file():
                    with path.open('rb') as source:digest=hashlib.file_digest(source,'sha256').hexdigest()
                entries.append({'path':name,'type':'file' if path.is_file() else 'directory','size':size,'mode':mode,
                                'account':self.account_for(name,info),'sha256':digest})
        return entries

    def generated(self,state,credentials,gate=None):
        return runtime.configs(state,credentials,runtime.local_ipv4_addresses(),gate=gate)

    def validate_config(self,state,credentials,folder,gate=None):
        # The only environment-dependent generated setting is the media IP bind.
        options=[runtime.configs(state,credentials,ips,gate=gate) for ips in (set(),{state['mediaIp']})]
        for name in ('web.env','livekit.json','Caddyfile'):
            if not any(bounded_text(folder/name)==values[name] for values in options):
                raise ValueError('Custom runtime configuration is incompatible')

    def export(self,installation_id,output):
        result=self.inspect(installation_id);self.require_stopped()
        if not result['initialized'] or not result.get('complete') or result['postgresMajor']!=16:
            raise ValueError('Only complete PostgreSQL 16 sources can be transferred')
        if 'server-wsl-v'+result['release']['buildId'] not in SUPPORTED_SOURCES:raise ValueError('Unsupported source release')
        state=load_state(self.state);credentials=bounded_json(self.state/'secrets.json')
        if bounded_json(self.release)!=state['release']:raise ValueError('Source runtime release differs from saved state')
        if bounded_text(self.state/'postgres/castlink-installation-id',128).strip()!=state['installationId']:
            raise ValueError('PostgreSQL identity mismatch')
        if (self.gate() or {}).get('phase')=='closed':raise ValueError('Export requires a stopped source without a closed candidate gate')
        self.validate_config(state,credentials,self.config,self.gate())
        entries=self.inventory()
        manifest={'schemaVersion':1,'runtimeContract':CONTRACT,'postgresMajor':16,'sourceRelease':state['release'],
                  'guestInstallationId':state['installationId'],'nodeId':state['nodeId'],'entries':entries}
        raw=json.dumps(manifest,separators=(',',':')).encode()
        if len(raw)>MAX_MANIFEST:raise ValueError('Manifest exceeds bound')
        with tarfile.open(fileobj=output,mode='w|',format=tarfile.USTAR_FORMAT) as archive:
            info=tarfile.TarInfo('manifest.json');info.size=len(raw);info.mode=0o600;archive.addfile(info,io.BytesIO(raw))
            for item in entries:
                label,_,relative=item['path'].partition('/');path=({'state':self.state,'config':self.config}[label])/relative
                info=tarfile.TarInfo(item['path']);info.mode=item['mode'];info.uname=info.gname=item['account'];info.size=item['size']
                info.type=tarfile.REGTYPE if item['type']=='file' else tarfile.DIRTYPE
                with path.open('rb') if item['type']=='file' else contextlib.nullcontext(None) as source:archive.addfile(info,source)
        self.require_stopped()

    def validate_manifest(self,manifest):
        if not isinstance(manifest,dict):raise ValueError('Invalid transfer manifest')
        if manifest.get('schemaVersion')!=1 or manifest.get('runtimeContract')!=CONTRACT or manifest.get('postgresMajor')!=16:
            raise ValueError('Incompatible transfer contract')
        if not isinstance(manifest.get('sourceRelease'),dict):raise ValueError('Invalid source release')
        runtime.validate_release(manifest['sourceRelease'])
        source_tag='server-wsl-v'+manifest['sourceRelease']['buildId']
        if source_tag not in SUPPORTED_SOURCES:raise ValueError('Unsupported transfer source')
        target=bounded_json(self.release);runtime.validate_release(target);compat=target.get('lifecycle',{})
        if compat.get('schemaVersion')!=1 or compat.get('runtimeContract')!=CONTRACT or compat.get('postgresMajor')!=16 or not isinstance(compat.get('supportedSources'),list) or source_tag not in compat['supportedSources']:
            raise ValueError('Target does not explicitly support this source')
        entries=manifest.get('entries')
        if not isinstance(entries,list) or len(entries)>MAX_ENTRIES:raise ValueError('Invalid inventory')
        seen={};total=0
        for item in entries:
            if not isinstance(item,dict) or not isinstance(item.get('path'),str):raise ValueError('Invalid inventory entry')
            name=item['path'];p=PurePosixPath(name)
            if p.is_absolute() or p.as_posix()!=name or '..' in p.parts or not p.parts or p.parts[0] not in ('state','config') or '\\' in name:
                raise ValueError('Unsafe archive path')
            if p.parts[0]=='config' and len(p.parts)>1 and (len(p.parts)!=2 or p.name not in ('web.env','livekit.json','Caddyfile')):raise ValueError('Unknown transferred configuration')
            if p.parts[0]=='state' and len(p.parts)>1 and p.parts[1] not in ('state.json','secrets.json','postgres','data','caddy') and not re.fullmatch(r'owner-access-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{16}\.txt',p.parts[1]):raise ValueError('Unknown transferred state')
            if name in seen or item.get('type') not in ('file','directory') or item.get('account') not in ACCOUNTS:
                raise ValueError('Invalid inventory member')
            if type(item.get('size')) is not int or item['size']<0 or type(item.get('mode')) is not int or item['mode']<0 or item['mode']>0o777 or item['mode']&0o002:
                raise ValueError('Invalid member permissions or size')
            if item['type']=='file' and not re.fullmatch('[a-f0-9]{64}',item.get('sha256') or ''):raise ValueError('Invalid file hash')
            if item['type']=='directory' and (item['size'] or item.get('sha256') is not None):raise ValueError('Invalid directory')
            if len(p.parts)>1 and seen.get(str(p.parent),{}).get('type')!='directory':raise ValueError('Inventory parent must precede child')
            seen[name]=item;total+=item['size']
        if total>MAX_BYTES or any(seen.get(n,{}).get('type')!='directory' for n in ('state','config')):raise ValueError('Invalid transfer size or roots')
        return target,seen

    def import_(self,installation_id,source):
        self.owned(installation_id);self.require_stopped()
        if self.state.exists() and any(self.state.iterdir()):raise ValueError('Candidate state must be empty')
        if any(p.name!='maintenance.json' for p in self.config.iterdir()):raise ValueError('Candidate configuration must be empty')
        staging=Path(tempfile.mkdtemp(prefix='.castlink-transfer-',dir=self.state.parent))
        try:
            with tarfile.open(fileobj=source,mode='r|',tarinfo=TransferTarInfo,bufsize=512) as archive:
                iterator=iter(archive)
                first=next(iterator,None)
                if first is None or first.name!='manifest.json' or not first.isfile() or first.size<0 or first.size>MAX_MANIFEST or first.pax_headers or first.type not in (tarfile.REGTYPE,tarfile.AREGTYPE):raise ValueError('Transfer manifest must be first')
                manifest=json.loads(archive.extractfile(first).read());target,inventory=self.validate_manifest(manifest)
                seen=set()
                for member in iterator:
                    item=inventory.get(member.name)
                    if member.name in seen or item is None:raise ValueError('Unexpected or duplicate archive member')
                    seen.add(member.name)
                    if member.pax_headers or member.type not in (tarfile.REGTYPE,tarfile.AREGTYPE,tarfile.DIRTYPE):raise ValueError('Unsafe archive member type')
                    if (member.isfile()!=(item['type']=='file') or member.size!=item['size'] or member.mode!=item['mode'] or member.uname!=item['account'] or member.gname!=item['account']):raise ValueError('Archive inventory mismatch')
                    path=staging/member.name
                    if member.isdir():path.mkdir(mode=0o700)
                    else:
                        digest=hashlib.sha256()
                        with path.open('xb') as output:
                            content=archive.extractfile(member)
                            while True:
                                chunk=content.read(1024*1024)
                                if not chunk:break
                                digest.update(chunk);output.write(chunk)
                            output.flush();os.fsync(output.fileno())
                        if digest.hexdigest()!=item['sha256']:raise ValueError('Transfer checksum mismatch')
                if seen!=set(inventory):raise ValueError('Missing archive members')
                # tarfile stops at its first zero record. Refuse hidden trailing archives.
                trailer=archive.fileobj.buf
                padding=len(trailer)
                if any(trailer):raise ValueError('Nonzero archive trailer')
                while True:
                    trailer=source.read(10240)
                    if not trailer:break
                    padding+=len(trailer)
                    if any(trailer) or padding>10240:raise ValueError('Invalid archive trailer')
                if padding<512:raise ValueError('Truncated archive terminator')
            staged_state=staging/'state';state=load_state(staged_state)
            if state['release']!=manifest['sourceRelease'] or state['installationId']!=manifest['guestInstallationId'] or state['nodeId']!=manifest['nodeId']:
                raise ValueError('Transferred identity mismatch')
            if bounded_text(staged_state/'postgres/PG_VERSION',16).strip()!='16' or (staged_state/'postgres/postmaster.pid').exists() or bounded_text(staged_state/'postgres/castlink-installation-id',128).strip()!=state['installationId']:
                raise ValueError('Transferred PostgreSQL is incompatible')
            if state.get('completed') is not True or state.get('databasePhase')!='seed' or state.get('postgresRoleCreated') is not True:raise ValueError('Incomplete transfer source')
            credentials=bounded_json(staged_state/'secrets.json');self.validate_config(state,credentials,staging/'config')
            state['release']=target;state['completed']=False;state.pop('readiness',None)
            runtime.write_private(staged_state/'state.json',state)
            # The gate is persisted before any restored state is made visible.
            if not self.gate():self.gate_close(installation_id,'import-'+secrets.token_hex(16))
            if self.gate()['phase']!='closed':raise ValueError('Candidate gate must be closed')
            for name,value in self.generated(state,credentials,self.gate()).items():runtime.write_private(staging/'config'/name,value)
            for name,item in reversed(list(inventory.items())):
                path=staging/name;os.chown(path,*self.accounts[item['account']]);os.chmod(path,item['mode'])
            # Generated secrets/configs have their target account and private modes.
            for name,account in (('web.env','root'),('livekit.json','castlink-livekit'),('Caddyfile','castlink-caddy')):
                p=staging/'config'/name;os.chown(p,*self.accounts[account]);os.chmod(p,0o600)
            self.require_stopped()
            for directory in sorted((p for p in staging.rglob('*') if p.is_dir()), key=lambda p:len(p.parts), reverse=True):self.sync(directory)
            self.sync(staging)
            for path in (staging/'config').iterdir():os.replace(path,self.config/path.name)
            if self.state.exists():self.state.rmdir()
            os.replace(staged_state,self.state)
            self.sync(self.state.parent);self.sync(self.config)
        except (tarfile.TarError,KeyError,TypeError,AttributeError,json.JSONDecodeError,UnicodeError):
            raise ValueError('Invalid transfer archive') from None
        finally:shutil.rmtree(staging)

    @staticmethod
    def sync(directory):
        fd=os.open(directory,os.O_RDONLY|os.O_DIRECTORY)
        try:os.fsync(fd)
        finally:os.close(fd)

    def persist_gate(self,gate):
        self.config.mkdir(parents=True,exist_ok=True)
        runtime.write_private(self.gate_path,gate);self.sync(self.config)

    def gate_close(self,installation_id,transaction_id,*,release_stopped_firewall=False):
        self.owned(installation_id);self.require_stopped()
        if not re.fullmatch('[A-Za-z0-9-]{1,80}',transaction_id):raise ValueError('Invalid maintenance transaction')
        current=self.gate()
        if current:
            if current['transactionId']!=transaction_id or current['phase']!='closed':raise ValueError('Another or committed transaction owns gate')
            self.reconcile_config()
            self.firewall(installation_id,closed=not release_stopped_firewall)
            return
        if release_stopped_firewall:raise ValueError('Existing closed transaction required for stopped firewall release')
        self.persist_gate({'schemaVersion':1,'phase':'closed','transactionId':transaction_id,
                           'hostInstallationId':installation_id,'probeToken':secrets.token_hex(32)})
        # Apply only while stopped. Runtime preflight restores this owned table at reboot.
        self.firewall(installation_id,closed=True)
        self.reconcile_config()

    def firewall(self,installation_id,*,closed):
        result=subprocess.run(['/usr/sbin/nft','-j','list','tables'],text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10)
        if result.returncode:raise ValueError('Cannot inspect guest gate firewall')
        tables=json.loads(result.stdout)['nftables']
        matches=[t['table'] for t in tables if t.get('table',{}).get('family')=='inet' and t['table'].get('name')=='castlink_maintenance']
        if len(matches)>1:raise ValueError('Ambiguous gate table ownership')
        if matches:
            table=json.loads(runtime.run(['/usr/sbin/nft','-j','list','table','inet','castlink_maintenance']))
            owners=[v['table'].get('comment') for v in table['nftables'] if 'table' in v]
            if owners!=['castlink:'+installation_id]:raise ValueError('Foreign gate firewall table')
        if closed and not matches:runtime.run(['/usr/sbin/nft','-f','-'],data=gate_rules(installation_id))
        elif not closed and matches:runtime.run(['/usr/sbin/nft','delete','table','inet','castlink_maintenance'])

    def reconcile_config(self):
        if not (self.state/'state.json').exists():return
        gate=self.gate();state=load_state(self.state);credentials=bounded_json(self.state/'secrets.json')
        try:self.validate_config(state,credentials,self.config,gate)
        except ValueError:self.reconfigure(None if gate['phase']=='closed' else {**gate,'phase':'closed'},gate,running=False)

    def reconfigure(self,old_gate,new_gate,*,running):
        state=load_state(self.state);credentials=bounded_json(self.state/'secrets.json')
        self.validate_config(state,credentials,self.config,old_gate)
        for name,value in runtime.configs(state,credentials,runtime.local_ipv4_addresses(),gate=new_gate).items():
            account={'web.env':'root','livekit.json':'castlink-livekit','Caddyfile':'castlink-caddy'}[name]
            runtime.write_private(self.config/name,value);os.chown(self.config/name,*self.accounts[account])
        if running:runtime.run(['/usr/bin/systemctl','restart','castlink-caddy','castlink-turn-tls'],timeout=120)

    def gate_open(self,installation_id,committed_transaction):
        self.owned(installation_id);gate=self.gate()
        if not gate or gate['transactionId']!=committed_transaction or gate['hostInstallationId']!=installation_id:
            raise ValueError('Durable committed transaction acknowledgement required')
        if gate['phase']=='closed':
            # After this write recovery MUST resume candidate, never restore old data.
            committed={**gate,'phase':'committed'};self.persist_gate(committed)
        else:committed=gate
        # Accept either configuration on retry after interruption.
        if (self.config/'Caddyfile').exists():
            state=load_state(self.state);credentials=bounded_json(self.state/'secrets.json')
            try:self.validate_config(state,credentials,self.config,committed)
            except ValueError:self.reconfigure({**gate,'phase':'closed'},committed,running=not self.stopped())
        if not self.stopped():runtime.run(['/usr/bin/systemctl','restart','castlink-caddy','castlink-turn-tls'],timeout=120)
        self.firewall(installation_id,closed=False)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=('inspect','export','import','gate-close','gate-open'))
    parser.add_argument('--installation-id',required=True)
    parser.add_argument('--transaction-id')
    parser.add_argument('--committed-transaction')
    parser.add_argument('--release-stopped-firewall',action='store_true')
    args=parser.parse_args(argv)
    if os.geteuid()!=0:raise ValueError('Run maintenance as guest root')
    if args.command=='gate-close' and not args.transaction_id:parser.error('--transaction-id is required')
    if args.command=='gate-open' and not args.committed_transaction:parser.error('--committed-transaction is required')
    if args.command!='gate-close' and (args.transaction_id or args.release_stopped_firewall):parser.error('Gate-close options require gate-close')
    if args.command!='gate-open' and args.committed_transaction:parser.error('--committed-transaction requires gate-open')
    with open('/run/castlink-server.lock','a') as lock:
        os.chmod(lock.name,0o600);fcntl.flock(lock,fcntl.LOCK_EX)
        helper=Maintenance()
        if args.command=='inspect':
            encoded=json.dumps(helper.inspect(args.installation_id),separators=(',',':'))
            if len(encoded)>65536:raise ValueError('Inspection exceeds bound')
            print(encoded)
        elif args.command=='export':helper.export(args.installation_id,sys.stdout.buffer)
        elif args.command=='import':helper.import_(args.installation_id,sys.stdin.buffer)
        elif args.command=='gate-close':helper.gate_close(args.installation_id,args.transaction_id,release_stopped_firewall=args.release_stopped_firewall)
        else:helper.gate_open(args.installation_id,args.committed_transaction)
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except (ValueError,OSError,EOFError,KeyError,TypeError,AttributeError,subprocess.SubprocessError):
        print('CastLink guest maintenance failed; preserve recovery data',file=sys.stderr);sys.exit(3)
