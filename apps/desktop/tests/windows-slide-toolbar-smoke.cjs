'use strict';
// Real Electron IPC/preload/UI + real web adapter, isolated local synthetic media.
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'artifacts', 'slide-toolbar-qa');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile-' + process.pid));
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
const ts = require(path.join(root, 'apps/web/node_modules/typescript'));
const report = { platform: process.platform, electron: process.versions.electron, syntheticMedia: true, productionAccess: false, checks: [] };
let client, controller, server;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) { for (let i = 0; i < 100; i++) { if (await fn()) return; await delay(80); } throw Error('Timeout: ' + label); }
function bundle() {
  const files = ['co-presentation-toolbar', 'co-presentation-controls'];
  const modules = files.map(name => {
    const source = fs.readFileSync(path.join(root, 'apps/web/lib', name + '.ts'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    return JSON.stringify('./' + name) + ':function(exports,require){' + js + '\n}';
  });
  return '(function(){const modules={' + modules.join(',') + '},cache={};function require(name){if(!modules[name])throw Error("Unknown QA module");if(!cache[name]){cache[name]={};modules[name](cache[name],require)}return cache[name]}window.slidesModule=require("./co-presentation-controls");})();';
}
const fixture = `
window.qa={actions:[],failStop:true};
window.qa.start=async()=>{
  qa.media=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').fillRect(0,0,640,360);qa.presentation=canvas.captureStream(5);
  qa.adapter=slidesModule.createCoPresentationControls({host:window,action:async event=>{qa.actions.push(event);if(event.action==='stop'){await new Promise(resolve=>{qa.releaseStop=resolve});if(qa.failStop)throw Error('QA stop failure');qa.presentation.getTracks().forEach(t=>t.stop());}}});
  qa.state={id:'qa-deck:generation:1',title:'QA slides',controller:'Вы управляете',page:2,pages:6,canNavigate:true,canReclaim:false,busy:false,locale:'ru',toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:[{identity:'qa-caster-2',name:'Кастер 2'}]}};
  await qa.adapter.update(qa.state);await qa.adapter.show();return true;
};
window.qa.update=async patch=>{qa.state={...qa.state,...patch};await qa.adapter.update(qa.state)};
`;
function ownPanel() { return BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.webContents.getURL() === pathToFileURL(path.join(root, 'apps/desktop/ui/slide-panel.html')).href); }
async function panelReady() { await until(() => ownPanel() && !ownPanel().webContents.isLoading(), 'panel renderer'); return ownPanel(); }
async function nativeClick(id) { await ownPanel().webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`, true); }
async function evaluate(js) { return client.webContents.executeJavaScript(js, true); }
function check(value, label) { assert(value, label); report.checks.push(label); }
const timer = setTimeout(() => { report.result = 'FAIL'; report.error = 'Native toolbar timeout'; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); app.exit(1); }, 60000);
timer.unref();
app.whenReady().then(async () => {
  try {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', req.url === '/adapter.js' || req.url === '/fixture.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
      res.end(req.url === '/adapter.js' ? bundle() : req.url === '/fixture.js' ? fixture : '<!doctype html><meta charset="utf-8"><title>CastLink toolbar QA</title><script src="/adapter.js"></script><script src="/fixture.js"></script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const preload = path.join(root, 'apps/desktop/src/preload.cjs');
    const preferences = role => ({ preload, additionalArguments: ['--castlink-role=' + role, '--castlink-locale=ru'], nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false });
    client = new BrowserWindow({ show: false, webPreferences: { ...preferences('client'), partition: 'castlink-toolbar-qa-' + process.pid } });
    client.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'media'));
    controller = require('../src/slide-panel.cjs').createSlideController({ client, ipcMain, BrowserWindow, getWorkArea: bounds => screen.getDisplayMatching(bounds).workArea, preferences, ui: name => path.join(root, 'apps/desktop/ui', name), trustedOrigins: new Set([origin]), isLocal: (event, panel, name) => !!panel && !panel.isDestroyed() && event.sender === panel.webContents && event.senderFrame === panel.webContents.mainFrame && event.senderFrame.url === pathToFileURL(path.join(root, 'apps/desktop/ui', name)).href });
    await client.loadURL(origin);
    check(await evaluate('castlinkDesktop.slides.version===2'), 'real preload advertises v2');
    await evaluate('qa.start()');
    let panel = await panelReady();
    check(panel.isAlwaysOnTop(), 'native panel always on top');
    await until(() => panel.webContents.executeJavaScript('document.getElementById("page").textContent.includes("2")'), 'paint initial slide');
    await nativeClick('control-toggle');
    await until(() => panel.webContents.executeJavaScript('!document.getElementById("menu-host").hidden'), 'expanded owner menu');
    await until(() => panel.getBounds().height > 200, 'expanded native window geometry');
    report.bounds = panel.getBounds();
    report.workArea = screen.getDisplayMatching(report.bounds).workArea;
    check(report.bounds.width <= report.workArea.width && report.bounds.height <= report.workArea.height, 'native bounds fit display work area');
    const geometry = await panel.webContents.executeJavaScript(`(()=>{const a=document.getElementById('control-menu').getBoundingClientRect(),b=document.getElementById('stop').getBoundingClientRect();return {overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),width:document.documentElement.scrollWidth,viewport:innerWidth}})()`);
    check(geometry.overlap === 0 && geometry.width <= geometry.viewport, 'native menu leaves STOP unobstructed without horizontal overflow');
    await panel.webContents.executeJavaScript(`document.querySelector('[data-identity="qa-caster-2"]').click()`, true);
    await until(() => evaluate('qa.actions.some(a=>a.action==="delegate"&&a.controllerIdentity==="qa-caster-2")'), 'native delegate through actual web adapter');
    check(true, 'native delegate reaches web adapter with selected identity');
    await evaluate('qa.update({busy:true})');
    await until(() => panel.webContents.executeJavaScript('document.getElementById("previous").disabled'), 'busy navigation');
    check(await panel.webContents.executeJavaScript('!document.getElementById("stop").disabled'), 'STOP remains enabled while slide navigation busy');
    await nativeClick('stop'); await nativeClick('stop');
    await until(() => evaluate('typeof qa.releaseStop==="function"'), 'pending STOP callback');
    check(await evaluate('qa.actions.filter(a=>a.action==="stop").length===1'), 'duplicate STOP suppressed independently');
    await evaluate('qa.releaseStop()');
    await until(() => panel.webContents.executeJavaScript('!document.getElementById("stop").disabled'), 'STOP retry after error ack');
    check(await panel.webContents.executeJavaScript('/Не удалось|Повторите/.test(document.body.textContent)'), 'failed STOP displayed with retry available');
    await evaluate('qa.failStop=false;qa.releaseStop=undefined');
    await nativeClick('stop'); await until(() => evaluate('typeof qa.releaseStop==="function"'), 'retry STOP callback'); await evaluate('qa.releaseStop()');
    await until(() => evaluate('qa.presentation.getTracks().every(t=>t.readyState==="ended")'), 'presentation tracks stopped');
    check(await evaluate('qa.media.getTracks().length===2&&qa.media.getTracks().every(t=>t.readyState==="live")'), 'synthetic camera and microphone remain live after presentation STOP');
    await evaluate('qa.update({busy:false,toolbar:{...qa.state.toolbar,sharing:false,canStop:false}})');
    await nativeClick('hide'); await until(() => !panel.isVisible(), 'native local hide');
    await evaluate('qa.update({page:3})'); check(!panel.isVisible(), 'polling does not reopen hidden panel');
    await evaluate('qa.adapter.show()'); check(panel.isVisible(), 'explicit reopen restores native panel');
    await evaluate('qa.adapter.dispose();qa.media.getTracks().forEach(t=>t.stop())');
    await until(() => !ownPanel(), 'dispose destroys owned panel');
    report.result = 'PASS';
  } catch (error) { report.result = 'FAIL'; report.error = error.stack || String(error); }
  finally {
    clearTimeout(timer); controller?.dispose(); if (client && !client.isDestroyed()) client.destroy(); server?.close();
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); app.exit(report.result === 'PASS' ? 0 : 1);
  }
});
