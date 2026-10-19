'use strict';
const { isTrustedFrame } = require('./server-policy.cjs');

function installDisplayCapture({ session, mainWindow, trustedOrigins, chooseSource }) {
  let epoch = 0, busy = false, disposed = false;
  session.setDisplayMediaRequestHandler(async (request, callback) => {
    const frame = request.frame, ticket = epoch;
    const current = () => !disposed && !mainWindow.isDestroyed() && request.frame === mainWindow.webContents.mainFrame &&
      ticket === epoch && isTrustedFrame({ frameUrl: frame?.url, isMainFrame: true, trustedOrigins });
    if (!request.videoRequested || !request.userGesture || !current() || busy) { callback({}); return; }
    busy = true;
    try {
      const choice = await chooseSource();
      // System loopback is deliberately absent until own/private audio exclusion is verified.
      callback(choice?.source?.id && current() ? { video: choice.source } : {});
    } catch { callback({}); }
    finally { busy = false; }
  });
  return () => { epoch++; disposed = true; session.setDisplayMediaRequestHandler(null); };
}
module.exports = { installDisplayCapture };
