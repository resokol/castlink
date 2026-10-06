// Fixed common helpers only; callers supply data, never executable source.
// Windows privacy is enforced by the approved SID/DACL/native identity bridge.
export const nodeTargetPrivateFiles=String.raw`
function leaseReadProtected(p,limit=1048576){
 const native=process.platform==='win32'?winInspect(p,false):null,before=leasePrivate(p,false);if(before.size>limit)leaseFail();
 const fd=leaseFs.openSync(p,leaseFs.constants.O_RDONLY|(leaseFs.constants.O_NOFOLLOW||0));
 try{const held=leaseFs.fstatSync(fd);if(!held.isFile()||held.nlink!==1||held.dev!==before.dev||held.ino!==before.ino||held.size!==before.size)leaseFail();const chunks=[];let size=0;while(size<=limit){const b=Buffer.alloc(Math.min(65536,limit+1-size)),n=leaseFs.readSync(fd,b,0,b.length,size);if(!n)break;size+=n;chunks.push(b.subarray(0,n))}const after=leaseFs.fstatSync(fd),named=leasePrivate(p,false);if(size>limit||size!==held.size||after.size!==held.size||after.mtimeMs!==held.mtimeMs||after.ctimeMs!==held.ctimeMs||named.dev!==held.dev||named.ino!==held.ino||named.size!==held.size||named.mtimeMs!==held.mtimeMs||named.ctimeMs!==held.ctimeMs||native&&!winSame(winInspect(p,false),native))leaseFail();return Buffer.concat(chunks,size)}finally{leaseFs.closeSync(fd)}
}
function leaseWriteProtected(p,bytes){
 if(process.platform==='win32'){if(bytes.length>8192)throw Error('windows-private-receipt-size-unverified');const i=winIdentity(),created=winBridge({action:'write',principal:i.principal,scope:i.scope,path:p,bytes:bytes.toString('base64')});if(!winSame(winInspect(p,false,i),created)||!leaseReadProtected(p,8192).equals(bytes))leaseFail();return}
 const fd=leaseFs.openSync(p,'wx',384);try{leaseFs.writeFileSync(fd,bytes);leaseFs.fsyncSync(fd)}finally{leaseFs.closeSync(fd)}leaseSync(leasePath.dirname(p));
}
function leaseEndpoint(endpoint){return typeof endpoint==='string'&&!( /[\x00-\x1f\x7f]/.test(endpoint))&&(process.platform==='win32'?/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(endpoint):/^unix:\/\/\/[^/]/.test(endpoint))}
function leaseComposePath(root){return leasePath.join(root,'compose.yaml')}
function leaseBindSource(actual,expected){
 if(actual===expected)return true;
 if(process.platform==='win32')throw Error('windows-desktop-bind-mapping-unverified');
 return false;
}
`;
