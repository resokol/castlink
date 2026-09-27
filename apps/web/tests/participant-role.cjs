const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { resolveParticipantRole } = require('../lib/participant-role.ts');
for (const [participant, expected] of [
 [{identity:'studio-panel-main'},'admin'],
 [{identity:'studio-moderator-one',metadata:JSON.stringify({role:'studio-moderator',accessRole:'admin'})},'admin'],
 [{identity:'studio-moderator-two',metadata:JSON.stringify({roomAdmin:true})},'admin'],
 [{identity:'studio-moderator-three',metadata:JSON.stringify({accessRole:'moderator'})},'moderator'],
 [{identity:'studio-moderator-legacy',metadata:'broken'},'moderator'],
 [{identity:'guest-one',metadata:JSON.stringify({role:'guest'})},'guest'],
 [{identity:'output-one',metadata:JSON.stringify({role:'output'})},undefined],
 [{identity:'monitor-one'},undefined],
 [{identity:'talkback-one',metadata:JSON.stringify({role:'admin',accessRole:'admin'})},undefined],
 [{identity:'stream-viewer-one',metadata:JSON.stringify({role:'moderator',accessRole:'moderator'})},undefined],
]) assert.equal(resolveParticipantRole(participant),expected);
console.log('PASS: admin/moderator/guest roles and technical participant exclusion');
