const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { toggleElementFullscreen } = require("../lib/fullscreen.ts");

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item),
  };
}

const html = { classList: classList() };
const body = { classList: classList() };
global.document = {
  fullscreenElement: null,
  documentElement: html,
  body,
  querySelector: selector => selector === ".castlink-css-fullscreen" && testElement.classList.contains("castlink-css-fullscreen") ? testElement : null,
  exitFullscreen: async () => {},
};

const testElement = { classList: classList() };

(async () => {
  await toggleElementFullscreen(testElement);
  assert.equal(testElement.classList.contains("castlink-css-fullscreen"), true);
  assert.equal(html.classList.contains("castlink-fullscreen-lock"), true);
  assert.equal(body.classList.contains("castlink-fullscreen-lock"), true);

  await toggleElementFullscreen(testElement);
  assert.equal(testElement.classList.contains("castlink-css-fullscreen"), false);
  assert.equal(html.classList.contains("castlink-fullscreen-lock"), false);
  assert.equal(body.classList.contains("castlink-fullscreen-lock"), false);

  const native = { classList: classList(), requestFullscreen: async () => { native.called = true; } };
  await toggleElementFullscreen(native);
  assert.equal(native.called, true);
  assert.equal(native.classList.contains("castlink-css-fullscreen"), false);

  console.log("PASS: native fullscreen with CSS fallback for iOS/WebKit limitations");
})().catch(error => { console.error(error); process.exit(1); });
