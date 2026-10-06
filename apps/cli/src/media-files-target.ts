import {nodeMediaCommon,pythonMediaCommon,nodeMediaEntry,pythonMediaEntry} from './media-target-common.js';
export const nodeMediaFilesTarget=nodeMediaCommon+nodeMediaEntry(String.raw`
mediaValidate(e,'action,name,content,association,authority');mediaAuthority(e);if(!['initialize','write','remove'].includes(e.action))fail();
if(e.action==='initialize'){if(e.authority.run!==null||e.authority.room!==null||Object.keys(e.authority.artifacts).length)fail();if(e.name!==null||e.content!==null||e.association!==null)fail()}else{if(!['report.json','browser-evidence.json','guest-entry.txt'].includes(e.name))fail();if(e.action==='write'&&(e.name==='guest-entry.txt'||typeof e.content!=='string'||Buffer.byteLength(e.content)>65536||e.association!==null))fail();if(e.action==='remove'&&e.content!==null)fail()}
const l=sqlGuard(e.guard,e.binding.installationId,e.binding.nodeId);mediaCheck(e,l);
if(e.action==='initialize'){
 const parent=path.dirname(path.dirname(mediaPath(e,'binding.json')));try{fs.lstatSync(parent);directory(parent,true)}catch(error){if(error.code!=='ENOENT')throw error;mediaCheck(e,l);fs.mkdirSync(parent,{mode:448});leaseSync(path.dirname(parent));mediaCheck(e,l)}
 mediaCheck(e,l);fs.mkdirSync(path.dirname(mediaPath(e,'binding.json')),{mode:448});leaseSync(parent);mediaCheck(e,l);const association=mediaWrite(e,l,'binding.json',Buffer.from(JSON.stringify(mediaStable(e))));
 mediaDone(l,{schemaVersion:1,contract:'castlink-media-files-v1',action:'initialize',runId:e.binding.runId,association});
}else{
 mediaRun(e);let a;if(e.action==='write')a=mediaWriteArtifact(e,l,e.name,Buffer.from(e.content));else mediaRemoveArtifact(e,l,e.name,e.association);mediaCheck(e,l);
 mediaDone(l,{schemaVersion:1,contract:'castlink-media-files-v1',action:e.action,runId:e.binding.runId,name:e.name,...(a??{})});
}
`);
export const pythonMediaFilesTarget=pythonMediaCommon+pythonMediaEntry(String.raw`
media_validate(e,('action','name','content','association','authority'));media_authority(e)
if e['action'] not in ('initialize','write','remove'): fail()
if e['action']=='initialize':
 if e['authority']['run'] is not None or e['authority']['room'] is not None or e['authority']['artifacts']: fail()
 if e['name'] is not None or e['content'] is not None or e['association'] is not None: fail()
else:
 if e['name'] not in ('report.json','browser-evidence.json','guest-entry.txt'): fail()
 if e['action']=='write' and (e['name']=='guest-entry.txt' or not isinstance(e['content'],str) or len(e['content'].encode())>65536 or e['association'] is not None): fail()
 if e['action']=='remove' and e['content'] is not None: fail()
l=sql_guard(e['guard'],e['binding']['installationId'],e['binding']['nodeId']);media_check(e,l)
if e['action']=='initialize':
 parent=os.path.dirname(os.path.dirname(media_path(e,'binding.json')))
 try:
  os.lstat(parent);directory(parent,True)
 except FileNotFoundError:
  media_check(e,l);os.mkdir(parent,0o700);lease_sync(os.path.dirname(parent));media_check(e,l)
 media_check(e,l);os.mkdir(os.path.dirname(media_path(e,'binding.json')),0o700);lease_sync(parent);media_check(e,l);a=media_write(e,l,'binding.json',json.dumps(media_stable(e),separators=(',',':')).encode())
 media_done(l,{'schemaVersion':1,'contract':'castlink-media-files-v1','action':'initialize','runId':e['binding']['runId'],'association':a})
else:
 media_run(e);v={'schemaVersion':1,'contract':'castlink-media-files-v1','action':e['action'],'runId':e['binding']['runId'],'name':e['name']}
 if e['action']=='write': v.update(media_write_artifact(e,l,e['name'],e['content'].encode()))
 else: media_remove_artifact(e,l,e['name'],e['association'])
 media_check(e,l);media_done(l,v)
`);
