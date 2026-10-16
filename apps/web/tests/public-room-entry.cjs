require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);

let hooks = [], effects = [], cursor = 0;
const react = {
  useState(initial) {
    const state = hooks, index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  },
  useEffect(effect, deps) {
    const state = hooks, index = cursor++, previous = state[index];
    if (!previous || deps.some((value, index) => value !== previous.deps[index])) effects.push(() => {
      previous?.cleanup?.(); state[index] = { deps, cleanup: effect() };
    });
  },
};
const StudioWorkspace = () => null, GuestWorkspace = () => null, GuestAccessGate = () => null;
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/guest-entry-settings') return originalLoad.call(this, require.resolve('../lib/guest-entry-settings.ts'), ...args);
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
  if (name === './StudioEntry.module.css') return { default: {} };
  if (name === './StudioWorkspace') return { StudioWorkspace };
  if (name === './GuestWorkspace') return { GuestWorkspace };
  if (name === './GuestAccessGate') return { GuestAccessGate };
  if (name === './AppChrome') return { AppFooterSlot: () => null };
  if (name === '@/lib/client-transfer') return originalLoad.call(this, require.resolve('../lib/client-transfer.ts'), ...args);
  return originalLoad.call(this, name, ...args);
};
const { HomeLobby } = require('../components/HomeLobby.tsx');
const { RoomManagementPanel } = require('../components/RoomManagementPanel.tsx');
const { GuestParticipantsTable } = require('../components/GuestParticipantsTable.tsx');
const { roomEntryInviteUrl } = require('../components/room-entry-url.ts');
Module._load = originalLoad;

// Exercise the real mutation handler without starting unrelated WebRTC effects.
const workspacePath = require.resolve('../components/StudioWorkspace.tsx');
const source = ts.createSourceFile(workspacePath, fs.readFileSync(workspacePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const workspace = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'StudioContent');
const mutation = workspace.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'editRoom'));
assert.ok(mutation, 'production room mutation handler exists');
const mutationModule = new Module(workspacePath, module);
mutationModule._compile(ts.transpileModule(`exports.handler = (fetch, setRooms, studioId) => { ${mutation.getText(source)} return editRoom; };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, workspacePath);

const requests = [];
function setup(url = 'https://studio.example/') {
  for (const hook of hooks) hook?.cleanup?.();
  hooks = []; effects = []; requests.length = 0;
  global.window = {
    location: { href: url, origin: new URL(url).origin },
    history: { replaceState(_state, _title, next) { window.location.href = new URL(next, window.location.href).href; } },
    addEventListener() {}, removeEventListener() {},
  };
}
function render(options) {
  cursor = 0;
  const tree = HomeLobby(options);
  while (effects.length) effects.shift()();
  return tree;
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function field(tree, label) {
  const node = nodes(tree).find(node => node.type === 'label' && Array.isArray(node.props.children) && node.props.children[0] === label);
  assert.ok(node, `field ${label} exists`);
  return nodes(node).find(node => node.type === 'input');
}
function fill(tree, label, value) { field(tree, label).props.onChange({ target: { value } }); }
const response = (ok, data) => ({ ok, json: async () => data });
const settle = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  setup('https://studio.example/?name=alpha&mode=studio');
  let complete;
  global.fetch = (url, options) => {
    requests.push({ url, options });
    return new Promise(resolve => { complete = resolve; });
  };
  render(); let tree = render();
  assert.equal(nodes(tree).some(node => node.type === StudioWorkspace), false, 'URL mode never authorizes a studio');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /^\/api\/room-studio-access\?name=alpha&studioId=studio-default$/);
  complete(response(true, { allowed: false, exists: true })); await settle(); tree = render();
  assert.equal(nodes(tree).some(node => node.type === StudioWorkspace), false);
  assert.ok(nodes(tree).some(node => node.props?.role === 'alert'));
  assert.equal(field(tree, 'Пароль студии').props.autoComplete, 'current-password', 'denied restore opens own-room login');

  setup('https://studio.example/?name=alpha&mode=studio');
  global.fetch = async (url, options) => { requests.push({ url, options }); return response(true, { allowed: true, exists: true }); };
  render(); render(); await settle(); tree = render();
  const studio = nodes(tree).find(node => node.type === StudioWorkspace);
  assert.ok(studio, 'server-confirmed room session embeds studio');
  assert.equal(studio.props.entryPath, '/'); assert.equal(studio.props.simpleRoom, true);
  assert.equal(new URL(window.location.href).pathname, '/');
  await studio.props.onLeave(); await settle(); tree = render();
  assert.equal(requests.at(-1).options.method, 'DELETE');
  assert.equal(new URL(window.location.href).pathname, '/');
  assert.equal(new URL(window.location.href).search, '');

  setup();
  global.fetch = (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return new Promise(resolve => { complete = resolve; }); };
  render(); tree = render();
  assert.equal(nodes(tree).filter(node => node.type === 'form').length, 2, 'root contains create and join cards');
  fill(tree, 'Название комнаты', '  alpha  '); fill(tree, 'Пароль студии', 'studio-secret'); fill(tree, 'Пароль гостей (необязательно)', 'guest-secret');
  tree = render();
  const submitting = nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  tree = render();
  assert.equal(nodes(tree).some(node => node.type === StudioWorkspace), false, 'pending create cannot open studio');
  assert.deepEqual(requests[0].body, { action: 'create', name: 'alpha', studioPassword: 'studio-secret', password: 'guest-secret', studioId: 'studio-default' });
  complete(response(false, { allowed: false, error: 'Комната уже существует' })); await submitting; tree = render();
  assert.ok(nodes(tree).some(node => node.props?.role === 'alert'));
  assert.equal(nodes(tree).some(node => node.type === StudioWorkspace), false, 'duplicate does not grant studio');
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Войти в существующую').props.onClick();
  tree = render();
  const loggingIn = nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(requests.at(-1).body, { action: 'login', name: 'alpha', studioPassword: 'studio-secret', studioId: 'studio-default' });
  complete(response(true, { allowed: true, name: 'alpha', studioId: 'studio-default' })); await loggingIn; tree = render();
  assert.ok(nodes(tree).some(node => node.type === StudioWorkspace));
  assert.equal(new URL(window.location.href).pathname, '/', 'login stays on root');
  assert.equal(new URL(window.location.href).searchParams.get('mode'), 'studio');
  assert.ok(!window.location.href.includes('secret'), 'credentials never enter URL');

  setup('https://studio.example/?name=alpha&mode=studio#invite=guest-secret');
  global.fetch = async () => { throw new Error('root must delegate guest authorization to the normal gate'); };
  render(); tree = render();
  assert.equal(tree.type, GuestAccessGate, 'guest fragment selects guest gate even with a studio mode query');
  assert.equal(tree.props.invite, 'guest-secret'); assert.equal(tree.props.entryPath, '/');
  assert.equal(new URL(window.location.href).hash, '', 'captured invite removed from URL');
  assert.equal(tree.props.children('alpha').type, GuestWorkspace);
  assert.equal(tree.props.children('alpha').props.entryPath, '/');

  const legacy = '/room?studioId=studio-default&name=alpha#invite=credential';
  const invite = new URL(roomEntryInviteUrl(legacy, 'https://studio.example', '/'));
  assert.equal(invite.pathname, '/'); assert.equal(invite.hash, '#invite=credential');
  assert.equal(invite.searchParams.get('name'), 'alpha'); assert.equal(invite.searchParams.get('invite'), null);
  assert.equal(new URL(roomEntryInviteUrl(legacy, 'https://studio.example')).pathname, '/room', 'legacy links stay unchanged');

  const management = RoomManagementPanel({ simpleRoom: true, entryPath: '/', rooms: ['alpha'], roomName: 'alpha' });
  assert.ok(!nodes(management).some(node => node.props?.placeholder === 'Название новой комнаты'), 'simple management cannot create via legacy API');
  assert.equal(nodes(management).find(node => node.type === 'a').props.href, '/');
  const guests = GuestParticipantsTable({ canMove: false, guests: [{ identity: 'guest-one', name: 'Guest', moveTarget: '', outputUrl: '/output/guest-one' }], rooms: ['alpha', 'other'], roomName: 'alpha' });
  assert.equal(nodes(guests).filter(node => node.type === 'select').length, 0, 'simple UI never offers moves into another room');
  assert.ok(nodes(guests).some(node => node.type === 'button' && node.props.children === 'Отключить гостя'), 'scoped guest controls stay available');

  const mutationRequests = []; let catalog;
  const editRoom = mutationModule.exports.handler(async (url, options) => {
    mutationRequests.push({ url, options });
    return response(true, options?.method === 'POST' ? { ok: true } : { rooms: ['renamed-own-room'] });
  }, rooms => { catalog = rooms; }, 'studio-default');
  assert.deepEqual(await editRoom({ action: 'rename', name: 'alpha', newName: 'renamed-own-room' }), ['renamed-own-room']);
  assert.deepEqual(catalog, ['renamed-own-room'], 'creator mutation acknowledgement reloads own catalog');
  assert.equal(mutationRequests.length, 2);
  assert.equal(mutationRequests[1].url, '/api/rooms?studioId=studio-default');

  setup('https://studio.example/studio'); render({hosted:true});
  assert.equal(render({hosted:true}).type.name,'HostedAccessGate','hosted lobby is gated');
  setup('https://studio.example/?name=alpha&invite=guest-secret');render({hosted:true});
  const hostedGuest=render({hosted:true});assert.notEqual(hostedGuest.type.name,'HostedAccessGate','guest invites do not require a service token');
  assert.equal(hostedGuest.props.invite,'guest-secret');hostedGuest.props.onBack();
  assert.equal(render({hosted:true}).type.name,'HostedAccessGate','leaving guest flow rechecks hosted access');

  console.log('PASS: root studio authorization/create/login/logout, guest fragment boundary, root invitations, scoped simple controls and mutation catalogue refresh');
})().catch(error => { console.error(error); process.exitCode = 1; });
