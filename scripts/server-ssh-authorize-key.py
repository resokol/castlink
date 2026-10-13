"""Add one generated public SSH key without replacing existing root access."""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import stat
import struct
import sys


def checked_public_key(value):
 if not isinstance(value,str) or len(value)>16384 or any(c in value for c in '\r\n\x00'):
  raise ValueError('Invalid public key')
 parts=value.split()
 if len(parts) not in (2,3) or parts[0] not in ('ssh-rsa','ssh-ed25519'):
  raise ValueError('Invalid public key')
 try:
  raw=base64.b64decode(parts[1],validate=True)
  fields=[];offset=0
  while offset<len(raw):
   size=struct.unpack('>I',raw[offset:offset+4])[0];offset+=4
   if size>len(raw)-offset:raise ValueError()
   fields.append(raw[offset:offset+size]);offset+=size
  if not fields or fields[0].decode('ascii')!=parts[0]:raise ValueError()
  if parts[0]=='ssh-ed25519':
   if len(fields)!=2 or len(fields[1])!=32:raise ValueError()
  else:
   if len(fields)!=3 or not fields[1] or not fields[2] or fields[1][0]&128 or fields[2][0]&128:raise ValueError()
   exponent=int.from_bytes(fields[1],'big');modulus=int.from_bytes(fields[2],'big')
   if exponent<3 or exponent%2!=1 or not 2048<=modulus.bit_length()<=8192:raise ValueError()
 except (ValueError,UnicodeError,struct.error):raise ValueError('Invalid public key') from None
 encoded=base64.b64encode(raw).decode('ascii')
 return parts[0]+' '+encoded, 'SHA256:'+base64.b64encode(hashlib.sha256(raw).digest()).decode('ascii').rstrip('=')


def authorize_key(home,public_key):
 key,fingerprint=checked_public_key(public_key)
 owner=os.geteuid()
 home=Path(home)
 info=home.lstat()
 if not stat.S_ISDIR(info.st_mode) or info.st_uid!=owner:raise ValueError('Unsafe SSH directory')
 directory=home/'.ssh'
 try:directory.mkdir(mode=0o700)
 except FileExistsError:pass
 # Open directory itself without following a symlink, then operate relative to it.
 directory_fd=os.open(directory,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:
  info=os.fstat(directory_fd)
  if info.st_uid!=owner:raise ValueError('Unsafe SSH directory')
  os.fchmod(directory_fd,0o700)
  lock_fd=os.open('.castlink-authorize.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600,dir_fd=directory_fd)
  try:
   info=os.fstat(lock_fd)
   if not stat.S_ISREG(info.st_mode) or info.st_uid!=owner or info.st_nlink!=1:raise ValueError('Unsafe SSH lock')
   fcntl.flock(lock_fd,fcntl.LOCK_EX)
   fd=os.open('authorized_keys',os.O_RDWR|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW,0o600,dir_fd=directory_fd)
   try:
    info=os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=owner or info.st_nlink!=1 or info.st_size>1024*1024:raise ValueError('Unsafe authorized keys file')
    os.fchmod(fd,0o600)
    existing=os.read(fd,1024*1024+1)
    if len(existing)>1024*1024:raise ValueError('Unsafe authorized keys file')
    identity=key.encode('ascii').split()
    present=any(line.split()[:2]==identity for line in existing.splitlines())
    if not present:
     addition=(b'\n' if existing and not existing.endswith(b'\n') else b'')+key.encode('ascii')+b' castlink-generated\n'
     remaining=memoryview(addition)
     while remaining:
      count=os.write(fd,remaining)
      if count<=0:raise OSError('Key write failed')
      remaining=remaining[count:]
     os.fsync(fd)
    return {'ok':True,'added':not present,'fingerprint':fingerprint}
   finally:os.close(fd)
  finally:os.close(lock_fd)
 finally:os.close(directory_fd)


def main(payload):
 if os.geteuid()!=0:raise ValueError('Root SSH login is required')
 if not isinstance(payload,dict) or set(payload)!= {'publicKey'}:raise ValueError('Invalid public key request')
 return authorize_key(pwd.getpwuid(0).pw_dir,payload['publicKey'])


if __name__=='__main__':
 try:
  payload=json.loads(sys.stdin.read(20001))
  print(json.dumps(main(payload)))
 except Exception:
  # Never include submitted keys, paths or OS exception text in the response.
  print(json.dumps({'ok':False,'error':'SSH public key registration refused'}))
  sys.exit(1)
