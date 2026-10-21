const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { getMiddlewareMatchers } = require('next/dist/build/analysis/get-page-static-info');
const { getMiddlewareRouteMatcher } = require('next/dist/shared/lib/router/utils/middleware-route-matcher');
const { NextResponse } = require('next/server');

(async () => {
  const middleware = load('../middleware.ts', { './lib/update-maintenance': { maintenanceResponse: () => null } });
  const match = getMiddlewareRouteMatcher(getMiddlewareMatchers(middleware.config.matcher, {}));
  for (const pathname of ['/api/presentation-file', '/api/presentation-file/']) {
    assert.equal(match(pathname, {}, {}), false, 'upload must avoid Next Node middleware body cloning: ' + pathname);
  }
  for (const pathname of ['/api', '/api/version', '/api/token', '/api/presentation-control', '/api/presentation-file-extra', '/api/presentation-file/child']) {
    assert.equal(match(pathname, {}, {}), true, 'other API paths retain maintenance middleware: ' + pathname);
  }

  let maintenance = null, admitted = false, authCalls = 0, conversions = 0, lastMaintenance;
  class PresentationFileError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
  let convertError;
  const route = load('../app/api/presentation-file/route.ts', {
    'next/server': { NextResponse },
    '@/lib/update-maintenance': { maintenanceResponse(method, pathname) { lastMaintenance = [method, pathname]; return maintenance; } },
    '@/lib/co-presentation-access': { async presentationGuest() { authCalls++; return admitted; } },
    '@/lib/presentation-file': { PresentationFileError, async convertPresentationFile() { conversions++; if (convertError) throw convertError; return { body: new ReadableStream({start(c){c.enqueue(Buffer.from('%PDF-1.7'));c.close()}}), size: 8 }; } },
    '@/lib/studio-scope': { defaultStudioId: () => 'studio-default' },
  });
  const request = pathname => ({ method: 'POST', nextUrl: new URL('http://localhost' + pathname), headers: new Headers({ 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware', 'x-middleware-skip': '1' }) });
  for (const pathname of ['/api/presentation-file?room=demo', '/api/presentation-file/?room=demo', '/api/%70resentation-file?room=demo']) {
    maintenance = new Response('updating', { status: 503, headers: { 'Retry-After': '10', 'Cache-Control': 'no-store' } });
    const response = await route.POST(request(pathname));
    assert.equal(response.status, 503); assert.equal(response.headers.get('Retry-After'), '10'); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(lastMaintenance, ['POST', new URL('http://localhost' + pathname).pathname]);
    assert.equal(authCalls, 0, 'maintenance precedes auth'); assert.equal(conversions, 0, 'maintenance precedes body');
  }
  maintenance = null;
  assert.equal((await route.POST(request('/api/presentation-file?room=demo'))).status, 403);
  assert.equal(authCalls, 1); assert.equal(conversions, 0, 'unauthenticated body remains untouched');
  admitted = true;
  assert.equal((await route.POST(request('/api/presentation-file?room=demo'))).status, 200);
  convertError = new PresentationFileError(400, 'upload framing invalid', 'presentation-upload-invalid');
  assert.deepEqual(await (await route.POST(request('/api/presentation-file?room=demo'))).json(), { error: 'upload framing invalid', code: 'presentation-upload-invalid' });
  convertError = new PresentationFileError(400, 'unsupported content');
  assert.deepEqual(await (await route.POST(request('/api/presentation-file?room=demo'))).json(), { error: 'unsupported content' });
  console.log('PASS: upload bypasses Node middleware cloning, retains route-level maintenance before auth/body, and exposes sanitized error codes');
})().catch(error => { console.error(error); process.exitCode = 1; });
