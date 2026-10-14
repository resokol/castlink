// Non-localization component fixtures mock React hooks. Supply the default
// Russian context without adding hooks to those fixtures' simulated lifecycle.
// The real provider and all locales are tested separately in i18n.cjs/browser QA.
const Module = require('node:module');
const path = require('node:path');
const original = Module._load;
const fs = require('node:fs');
const ts = require('typescript');
const cache = new Map();
function loadTs(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename)); cache.set(filename, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText, filename);
  return mod.exports;
}
const t = (source, params) => !params ? source : source.replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
const fixture = { useI18n: () => ({ locale: 'ru', t, setLocale() {} }) };
Module._load = function(name, ...args) {
  if (name === '@/components/I18nProvider' || name === './I18nProvider' || name === '../components/I18nProvider') return fixture;
  if (name === '@/components/LanguageSwitcher') return loadTs(path.join(__dirname, '../components/LanguageSwitcher.tsx'));
  if (name === './BrandIcon' || name === '@/components/BrandIcon') return loadTs(path.join(__dirname, '../components/BrandIcon.tsx'));
  if (name === '@/lib/i18n' || name.startsWith('@/lib/i18n/')) return loadTs(path.join(__dirname, '..', name.slice(2)) + '.ts');
  if (name === '@/lib/app-update') return loadTs(path.join(__dirname, '../lib/app-update.ts'));
  return original.call(this, name, ...args);
};
module.exports = fixture;
