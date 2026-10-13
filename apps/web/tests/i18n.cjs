const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../node_modules/typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = [...Module._nodeModulePaths(path.dirname(filename)), ...Module._nodeModulePaths(root)];
  const normalRequire = mod.require.bind(mod);
  mod.require = name => {
    let candidate = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
    if (candidate) {
      for (const ext of ['', '.ts', '.tsx']) if (fs.existsSync(candidate + ext) && fs.statSync(candidate + ext).isFile()) return load(candidate + ext);
    }
    return normalRequire(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { translate, normalizeLocale, messages } = load(path.join(root, 'lib/i18n.ts'));
assert.equal(normalizeLocale(undefined), 'ru');
for (const invalid of ['zh', 'fr', 'EN', '', null, {}, '<script>']) assert.equal(normalizeLocale(invalid), 'ru');
for (const locale of ['ru', 'en', 'zh-CN']) assert.equal(normalizeLocale(locale), locale);
const placeholders = source => [...new Set(source.match(/\{\w+\}/g) || [])].sort();
for (const [source, entry] of Object.entries(messages)) {
  assert.ok(entry[0].trim() && entry[1].trim(), 'Both translations are required: ' + source);
  for (const translation of entry) if (translation !== undefined) assert.deepEqual(placeholders(translation), placeholders(source), 'Interpolation placeholders must match: ' + source);
}
assert.equal(translate('ru', 'Страница не найдена'), 'Страница не найдена');
assert.equal(translate('en', 'Страница не найдена'), 'Page not found');
assert.equal(translate('zh-CN', 'Страница не найдена'), '页面未找到');
assert.equal(translate('en', 'Замер {age} назад{stale}', { age: '2 min', stale: '' }), 'Measured 2 min ago');
assert.equal(translate('zh-CN', '{count} сек', {count: 0}), '0 秒');
const raw = 'My room <>& Привет {unknown}';
for (const locale of ['ru', 'en', 'zh-CN']) assert.equal(translate(locale, raw), raw, 'Unknown user content/errors must remain verbatim');
const userName = 'Страница не найдена $& <>&';
assert.equal(translate('en', 'Состояние {name}', {name: userName}), 'State of ' + userName, 'User values are never recursively translated');
const missing = [];
function scan(directory) {
  for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
    if (item.name === 'api') continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) scan(file);
    else if (file.endsWith('.tsx')) {
      const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && ts.isStringLiteral(node.arguments[0]) && !(node.arguments[0].text in messages)) missing.push(path.relative(root, file) + ': ' + node.arguments[0].text);
        ts.forEachChild(node, visit);
      }
      visit(sf);
    }
  }
}
scan(path.join(root, 'app')); scan(path.join(root, 'components'));
assert.deepEqual(missing, [], 'Every explicit UI source key must have EN and ZH translations');
const React = require('../node_modules/react');
const {renderToString} = require('../node_modules/react-dom/server');
const {I18nProvider, useI18n} = load(path.join(root, 'components/I18nProvider.tsx'));
function Probe() { const {locale,t} = useI18n(); return React.createElement('p', {'data-language': locale}, t('Страница не найдена')); }
assert.match(renderToString(React.createElement(I18nProvider, null, React.createElement(Probe))), /data-language="ru">Страница не найдена/);
console.log('I18n catalog coverage, interpolation, raw content, validation and Russian SSR passed (' + Object.keys(messages).length + ' messages)');
module.exports = { load, root };
