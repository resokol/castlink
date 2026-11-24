const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./load-typescript.cjs');
const { slideControlsId } = load('../lib/co-presentation-controls.ts');
const source = ts.createSourceFile('panel.tsx', fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map();
(function visit(node) {
    if (ts.isVariableDeclaration(node) && ['remotePresentationReady', 'releaseRecipient'].includes(node.name.getText(source))) {
        callbacks.set(node.name.getText(source), ts.transpileModule('(' + node.initializer.getText(source) + ')', {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText);
    }
    ts.forEachChild(node, visit);
})(source);

function fixture() {
    const session = { id: 'deck', generation: 'generation', controlRevision: 1, controller: { identity: 'guest', sid: 'sid' } };
    const calls = [];
    let finish;
    const context = {
        room: { localParticipant: { ...session.controller } }, connected: true, sessions: [session],
        slideControlsId, recipientScreenReady: () => true, releasedGrants: { current: new Set() },
        recipientScope: { current: {} }, mounted: { current: true }, setReleaseRevision() {},
        binding: ({id, generation, controlRevision}) => ({id, generation, controlRevision}),
        setSessions: update => { context.sessions = update(context.sessions); },
        request: body => { calls.push(body); return new Promise(resolve => { finish = resolve; }); },
    };
    return { session, context, calls, finish: response => finish(response),
        ready: vm.runInNewContext(callbacks.get('remotePresentationReady'), context),
        release: vm.runInNewContext(callbacks.get('releaseRecipient'), context) };
}

(async () => {
    const { session, context, calls, finish, ready, release } = fixture();
    assert.equal(ready(session), true, 'exact grant is immediately ready');
    assert.equal(calls.length, 0);
    for (const controller of [{ identity: 'other', sid: 'sid' }, { identity: 'guest', sid: 'reconnected' }]) {
        const other = { ...session, controller };
        assert.equal(ready(other), false);
        await release(other);
    }
    assert.equal(calls.length, 0);
    context.recipientScreenReady = () => false;
    assert.equal(ready(session), false, 'a live bound screen is required');
    context.recipientScreenReady = () => true;
    const pending = release(session);
    assert.equal(calls[0].action, 'release-control');
    assert.equal(ready(session), false);
    const next = { ...session, controlRevision: 2 };
    assert.equal(ready(next), true);
    context.sessions = [next];
    finish({ session: { ...session, controller: undefined } });
    await pending;
    assert.equal(context.sessions[0], next, 'late release cannot clear a newer grant');
    const other = fixture();
    const previousScope = other.release(other.session);
    other.context.recipientScope.current = {};
    other.finish({session: {...other.session, controller: undefined}});
    await previousScope;
    assert.equal(other.context.sessions[0], other.session, 'late release cannot reach a new connection');
    console.log('PASS immediate bound grant, voluntary release, late response after regrant or reconnect');
})().catch(error => { console.error(error); process.exitCode = 1; });
