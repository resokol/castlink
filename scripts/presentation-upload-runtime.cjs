// Loaded before the standalone Next server creates its HTTP listener.
// Keep Node's 60s header deadline; the authenticated route enforces 30s body idle.
const http = require('node:http');
const createServer = http.createServer;
http.createServer = function(options, listener) {
  if (typeof options === 'function' || options === undefined) {
    listener = options;
    options = {};
  }
  return createServer.call(this, { requestTimeout: 15 * 60_000 + 30_000, ...options }, listener);
};
