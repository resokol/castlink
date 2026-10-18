const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const packageRequire = require('node:module').createRequire(path.resolve(__dirname, '../package.json'));
exports.load = (entry, overrides = {}) => {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      let target = name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
      if (!target) return packageRequire(name);
      for (const candidate of [target, target + '.ts', target + '.tsx', target + '.js', path.join(target, 'index.ts')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return /\.tsx?$/.test(candidate) ? load(candidate) : packageRequire(candidate);
      }
      return packageRequire(target);
    };
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {fileName:file,compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
    vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${output}\n})`, {filename: file})(localRequire, module, module.exports, file, path.dirname(file));
    return module.exports;
  }
  return load(path.resolve(__dirname, entry));
};
