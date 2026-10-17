// CastLink native PowerPoint helper. Run: osascript -l JavaScript CastLink-PowerPoint-macOS.js
// Uses built-in macOS automation only. Never runs code or paths received from the server.
ObjC.import('Foundation');
var host=Application.currentApplication();host.includeStandardAdditions=true;
function quoteShell(value){return "'"+String(value).replace(/'/g,"'\\''")+"'";}
var adapter=[
 'on run argv',
 'tell application "Microsoft PowerPoint"',
 'if (count of slide show windows) is not 1 then error "Keep exactly one PowerPoint slide show open."',
 'set showWindow to slide show window 1',
 'set deckIdentity to (full name of presentation of showWindow) as text',
 'if (count of argv) is 0 then return deckIdentity',
 'if deckIdentity is not (item 1 of argv) then error "The selected presentation changed."',
 'set slideView to slide show view of showWindow',
 'if (item 2 of argv) is "next" then',
 'go to next slide slideView',
 'else if (item 2 of argv) is "previous" then',
 'go to previous slide slideView',
 'else',
 'error "Unsupported presentation command."',
 'end if',
 'return deckIdentity',
 'end tell',
 'end run'
].join('\n');
function powerpoint(title,direction){
 if(direction!==undefined&&direction!=='next'&&direction!=='previous')throw Error('Unsupported command');
 return host.doShellScript('/usr/bin/osascript -e '+quoteShell(adapter)+(title===undefined?'':' '+quoteShell(title)+' '+quoteShell(direction)));
}
function endpointFor(value){
 var url=$.NSURL.URLWithString(value),parts=$.NSURLComponents.componentsWithURLResolvingAgainstBaseURL(url,false);
 if(!url||!parts||ObjC.unwrap(parts.scheme)!=='https'||parts.user.js||parts.password.js||parts.query.js||parts.fragment.js)throw Error('Use your CastLink HTTPS server address.');
 parts.path='/api/presentation-control';return ObjC.unwrap(parts.URL.absoluteString);
}
function post(endpoint,token,body){
 // curl -q ignores user configuration; no -L means redirects cannot receive the grant.
 var command='/usr/bin/curl -q --proto =https --max-time 4 --max-redirs 0 --fail --silent --show-error --request POST --header '+quoteShell('Content-Type: application/json')+' --header '+quoteShell('Authorization: Bearer '+token)+' --data-binary '+quoteShell(JSON.stringify(body))+' '+quoteShell(endpoint);
 return JSON.parse(host.doShellScript(command));
}
function accept(command,connection,lastSequence,now){
 return command&&/^[a-f0-9-]{36}$/.test(command.id)&&command.connectionId===connection&&Number.isSafeInteger(command.seq)&&command.seq>lastSequence&&(command.direction==='next'||command.direction==='previous')&&Number.isSafeInteger(command.issuedAt)&&Number.isSafeInteger(command.expiresAt)&&command.issuedAt<=now+1000&&command.expiresAt>now&&command.expiresAt<=command.issuedAt+3000;
}
function run(){
 var pairToken,sessionToken;
 try{
  var endpoint=endpointFor(host.displayDialog('CastLink HTTPS server address',{defaultAnswer:'https://',buttons:['Cancel','Continue'],defaultButton:'Continue'}).textReturned);
  pairToken=host.displayDialog('One-time presentation pairing code from your caster page',{defaultAnswer:'',hiddenAnswer:true,buttons:['Cancel','Continue'],defaultButton:'Continue'}).textReturned.trim();
  if(!/^cp_[A-Za-z0-9_-]{43}$/.test(pairToken))throw Error('Invalid pairing code.');
  var identity=powerpoint(),title=identity.split(/[:/]/).pop()||'PowerPoint';
  host.displayDialog('Allow next/previous navigation for '+title+'?\nUse Stop in CastLink or close this helper to revoke. Screen sharing stays separate.',{buttons:['Cancel','Allow'],defaultButton:'Cancel'});
  var connection=ObjC.unwrap($.NSUUID.UUID.UUIDString).toLowerCase(),linked=post(endpoint,pairToken,{action:'connect',connectionId:connection});pairToken=undefined;
  if(!linked.sessionToken||linked.connectionId!==connection)throw Error('Pairing was not confirmed.');
  sessionToken=linked.sessionToken;var lastSequence=0,result;
  while(true){
   if(powerpoint()!==identity)throw Error('The selected presentation changed.');
   var body={action:'poll',connectionId:connection,status:{title:title.slice(0,160),ready:true}};if(result)body.result=result;
   var response=post(endpoint,sessionToken,body);result=undefined;
   if(response.command){
    var command=response.command;if(!accept(command,connection,lastSequence,Date.now()))throw Error('Stale command; pair again.');
    lastSequence=command.seq;
    try{powerpoint(identity,command.direction);result={seq:lastSequence,ok:true};}catch(error){result={seq:lastSequence,ok:false,error:'PowerPoint could not navigate the selected slide show.'};}
   }
   host.delay(0.5);
  }
 }catch(error){host.displayDialog('Presentation control stopped. Check PowerPoint and your connection, then create a new pairing code in CastLink.',{buttons:['OK']});}
 finally{pairToken=undefined;sessionToken=undefined;}
}
