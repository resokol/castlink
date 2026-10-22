"""Build a private Windows web candidate from the already-built Next standalone output."""
import pathlib,shutil,hashlib,json,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'apps/web/.next/standalone'
if not (source/'apps/web/server.js').is_file(): raise SystemExit('Build web first')
build=(root/'apps/web/.next/BUILD_ID').read_text().strip()
dest=root/'artifacts/pptx-private-web'/build
if dest.exists(): raise SystemExit('Candidate exists; preserve it before rebuilding')
dest.mkdir(parents=True)
shutil.copytree(source,dest,dirs_exist_ok=True)
# Dereferenced Windows links lose pnpm sibling resolution. Hoist the traced runtime closure.
for package in sorted((source/'node_modules/.pnpm').glob('*/node_modules/*')):
 if package.name.startswith('.') or not package.is_dir(): continue
 if package.name.startswith('@'):
  entries=list(package.iterdir())
 else: entries=[package]
 for entry in entries:
  relative=entry.relative_to(package.parent) if not package.name.startswith('@') else pathlib.Path(package.name)/entry.name
  target=dest/'node_modules'/relative
  if not target.exists(): shutil.copytree(entry,target,dirs_exist_ok=True)

shutil.copytree(root/'apps/web/.next/static',dest/'apps/web/.next/static',dirs_exist_ok=True)
shutil.copytree(root/'apps/web/public',dest/'apps/web/public',dirs_exist_ok=True)
shutil.copy2(shutil.which('node'),dest/'node.exe')
for file in dest.rglob('*'):
 if file.is_file() and (file.name.startswith('.env') or file.name=='web.env'): raise SystemExit('Refuse environment files in candidate')
launch='@echo off\r\ncd /d "%~dp0"\r\nset HOSTNAME=127.0.0.1\r\nset PORT=4318\r\nset CASTLINK_HELPER_ALLOW_LOOPBACK_TEST=1\r\nset STUDIOLINK_DATA_DIR=%~dp0test-data\r\nif not exist test.env (echo Copy test.env.example to test.env and configure isolated LiveKit first. & pause & exit /b 1)\r\nnode.exe --env-file=test.env apps\\web\\server.js\r\npause\r\n'
(dest/'Run Test Web.cmd').write_bytes(launch.encode('ascii'))
env='''NODE_ENV=production
CASTLINK_DEPLOYMENT_MODEL=self-hosted
CASTLINK_STORAGE_BACKEND=json
CASTLINK_LICENSE_ENFORCE=0
STUDIOLINK_DEFAULT_STUDIO_ID=studio-default
# Configure a SEPARATE test LiveKit. Do not copy production data or credentials.
LIVEKIT_SERVER_URL=http://127.0.0.1:17880
LIVEKIT_API_KEY=CHANGE_ME_TEST_ONLY
LIVEKIT_API_SECRET=CHANGE_ME_TEST_ONLY
CASTLINK_SESSION_SECRET=CHANGE_ME_RANDOM_TEST_SECRET
CASTLINK_DATA_ENCRYPTION_KEY=CHANGE_ME_RANDOM_TEST_KEY
STUDIOLINK_STUDIO_PASSWORD_HASH=CHANGE_ME_SHA256_OF_TEST_PASSWORD
ROOM_CREATION_PASSWORD=CHANGE_ME_TEST_PASSWORD
CASTLINK_SETUP_TOKEN=CHANGE_ME_RANDOM_TEST_TOKEN
'''
(dest/'test.env.example').write_text(env,encoding='utf8')
readme='''PRIVATE PPTX TEST — Windows web bundle
Use this with the matching CastLink PPTX Test client/helper. Production is unchanged.
1. Configure an isolated LiveKit instance; copy test.env.example to test.env and set test-only values.
2. Run Run Test Web.cmd. It binds 127.0.0.1:4318 and stores new data only in this folder/test-data.
3. Open http://127.0.0.1:4318 in Chrome/Edge or the test client.
4. For the browser on this same Windows machine, launch the test EXE with:
   "CastLink PPTX Test.exe" --presentation-helper --presentation-helper-allow-loopback-test
5. Click Load PPTX, enter the code and server address in the helper, then choose the file.
6. Show presentation starts real installed PowerPoint. The next explicit click Select slideshow window starts capture.
7. Co-presentation opens the participant dropdown. Owner keyboard/mouse remain available.
Only Windows presenter is implemented. Other platforms can use the browser to receive/control a Windows show.
For other computers use an isolated HTTPS test server and properly configured LiveKit, not this loopback listener.
Original PPTX is never converted or uploaded by this mode. Actual Office animations/media/audio/physical input still require a real Office test.
The bundle contains no production credentials, data, account relay, installer, or LiveKit service.
'''
(dest/'README.txt').write_text(readme,encoding='utf8')
files=[{'file':str(p.relative_to(dest)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dest.rglob('*')) if p.is_file()]
(dest/'manifest.json').write_text(json.dumps({'buildId':build,'testOnly':True,'files':files},indent=2),encoding='utf8')
archive=dest.parent/(dest.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in dest.rglob('*'):
  if p.is_file(): z.write(p,p.relative_to(dest))
with zipfile.ZipFile(archive) as z:
 if z.testzip(): raise SystemExit('ZIP CRC failed')
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(sha+'  '+archive.name+'\n')
print(json.dumps({'directory':str(dest),'archive':str(archive),'sha256':sha,'files':len(files)}))
