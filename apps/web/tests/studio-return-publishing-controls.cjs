const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const controls = fs.readFileSync(path.resolve(__dirname, "../components/StudioReturnPublishingControls.tsx"), "utf8");

for (const snippet of [
  "StudioReturnPublishingControls",
  "studioOnly={studioOnly}",
  "modeBusy={modeBusy}",
  "role={studioRole}",
  "hasSession={Boolean(sessionToken)}",
  "screenShare={<ScreenShareButton room={room} compact outputMuted={outputMuted} getOutputMuted={() => outputMutedRef.current} />}",
  "onTogglePreview={() => changePreview(!returnActive)}",
  "onToggleOnAir={() => requestOnAir(!onAir)}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "Гости могут видеть только студию",
  "Проверить Studio Return",
  "Остановить проверку",
  "Начать эфир",
  "Завершить эфир",
  'aria-pressed={onAir}',
  'onAir ? "air-toggle-live" : ""',
  'role === "connecting"',
]) assert.ok(controls.includes(snippet), `missing publishing control behavior: ${snippet}`);

assert.doesNotMatch(page, /className="studio-quick-controls"/);
const ts = require("typescript");
const vm = require("node:vm");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
require("./i18n-fixture.cjs");
Module._extensions[".tsx"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const { StudioReturnPublishingControls } = require("../components/StudioReturnPublishingControls.tsx");
const render = props => renderToStaticMarkup(React.createElement(StudioReturnPublishingControls, {
  studioOnly:false, modeBusy:false, role:"primary", hasSession:true, onAir:false, airBusy:false,
  returnActive:false, previewReady:false, screenShare:null, onToggleStudioOnly(){}, onTogglePreview(){}, onToggleOnAir(){}, ...props,
}));
const airButton = props => render(props).match(/<button[^>]*class="air-toggle[^>]*>/)[0];
assert.ok(!airButton({}).includes("disabled"), "primary can start ON AIR without preview");
assert.ok(!airButton({onAir:true,previewReady:false}).includes("disabled"), "OFF AIR always remains accessible");
for (const props of [{role:"connecting"},{hasSession:false},{airBusy:true}]) assert.ok(airButton(props).includes("disabled"));

console.log("PASS: Studio Return publishing extraction preserves enable/disable rules and callbacks");
