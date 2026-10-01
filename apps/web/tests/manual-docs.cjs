const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"../../..");
const entry="docs/MANUAL_RU.md";
const docs=[entry,"docs/VERIFIED_RUNBOOK_RU.md",...fs.readdirSync(path.join(root,"docs/manual")).filter(name=>name.endsWith(".md")).map(name=>"docs/manual/"+name)];
for(const file of docs){
 const source=fs.readFileSync(path.join(root,file),"utf8");
 for(const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
  const target=match[1];if(/^(?:https?:|mailto:|#)/.test(target))continue;
  const relative=decodeURIComponent(target.split("#")[0]);
  assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),relative)),`broken manual link: ${file} -> ${target}`);
 }
}
const check=spawnSync(process.execPath,["scripts/build-manual-index.mjs","--check"],{cwd:root,encoding:"utf8"});
assert.equal(check.status,0,check.stdout+check.stderr);
const guide=fs.readFileSync(path.join(root,entry),"utf8");
assert.match(guide,/не означает/);assert.match(guide,/FILE_MAP_RU/);
console.log("PASS: beginner manual links resolve and the full source-file catalog matches Git index");
