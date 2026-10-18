const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");

Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const originalLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === "next/server") {
    return {
      NextResponse: {
        json(body, init = {}) {
          return { body, status: init.status || 200, headers: init.headers || {} };
        },
      },
    };
  }
  if (name === "node:fs/promises") {
    return { readFile: async () => "build-abc123\n" };
  }
  return originalLoad.call(this, name, ...rest);
};

const previousNodeEnv = process.env.NODE_ENV;
const previousBuild = process.env.NEXT_PUBLIC_BUILD_ID;
const previousLegacyBuild = process.env.NEXT_PUBLIC_APP_VERSION;
const previousProduct = process.env.NEXT_PUBLIC_PRODUCT_VERSION;
const previousBuildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER;

process.env.NODE_ENV = "production";
const productVersion = require("../../../package.json").version;
assert.match(productVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
assert.equal(require("../package.json").version, undefined, "apps/web must not duplicate the product version");
process.env.NEXT_PUBLIC_PRODUCT_VERSION = productVersion;
process.env.NEXT_PUBLIC_BUILD_NUMBER = "776AF9";
delete process.env.NEXT_PUBLIC_BUILD_ID;
delete process.env.NEXT_PUBLIC_APP_VERSION;

const { GET } = require("../app/api/version/route.ts");
Module._load = originalLoad;

(async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    version: "build-abc123",
    buildId: "build-abc123",
    productVersion,
    buildNumber: "776AF9",
  });
  assert.match(response.headers["Cache-Control"], /no-store/);
  assert.match(response.headers["CDN-Cache-Control"], /no-store/);

  console.log("PASS: version API exposes semantic product version and compatible build identifier");
})().finally(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  if (previousBuild === undefined) delete process.env.NEXT_PUBLIC_BUILD_ID; else process.env.NEXT_PUBLIC_BUILD_ID = previousBuild;
  if (previousLegacyBuild === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION; else process.env.NEXT_PUBLIC_APP_VERSION = previousLegacyBuild;
  if (previousProduct === undefined) delete process.env.NEXT_PUBLIC_PRODUCT_VERSION; else process.env.NEXT_PUBLIC_PRODUCT_VERSION = previousProduct;
  if (previousBuildNumber === undefined) delete process.env.NEXT_PUBLIC_BUILD_NUMBER; else process.env.NEXT_PUBLIC_BUILD_NUMBER = previousBuildNumber;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
