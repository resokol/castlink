/** Map only visible, uncropped source pixels. Coordinates stay normalized until native mapping. */
export function remotePcVideoPoint(rect: {left:number;top:number;width:number;height:number}, width:number, height:number, clientX:number, clientY:number, fit = 'contain', position = '50% 50%') {
  if (![rect.left,rect.top,rect.width,rect.height,width,height,clientX,clientY].every(Number.isFinite) || width <= 0 || height <= 0 || rect.width <= 0 || rect.height <= 0 || !['contain','scale-down','fill'].includes(fit)) return;
  const scale = fit === 'fill' ? 1 : Math.min(rect.width/width,rect.height/height,fit === 'scale-down' ? 1 : Infinity);
  const w = fit === 'fill' ? rect.width : width*scale, h = fit === 'fill' ? rect.height : height*scale;
  const tokens=position.trim().split(/\s+/), resolve=(token:string|undefined,free:number)=>{
    if (token==='left'||token==='top') return 0;
    if (token==='right'||token==='bottom') return free;
    if (token==='center'||token===undefined) return free/2;
    if (/^-?\d+(\.\d+)?%$/.test(token)) return free*parseFloat(token)/100;
    if (/^-?\d+(\.\d+)?px$/.test(token)) return parseFloat(token);
    return NaN;
  };
  const left=rect.left+resolve(tokens[0],rect.width-w), top=rect.top+resolve(tokens[1],rect.height-h);
  if (!Number.isFinite(left)||!Number.isFinite(top)||left<rect.left||top<rect.top||left+w>rect.left+rect.width+0.01||top+h>rect.top+rect.height+0.01) return;
  const x=(clientX-left)/w,y=(clientY-top)/h;
  if(x<0||x>1||y<0||y>1)return;
  return {x,y};
}
export type RemotePcPoint={x:number;y:number};
export type RemotePcBrowserInput = {type:'move';x:number;y:number} | {type:'button';button:'left'|'right'|'middle';down:boolean;x:number;y:number;moveBarrier?:number} | {type:'wheel';deltaX:number;deltaY:number;x:number;y:number} | {type:'key';code:string;down:boolean} | {type:'text';text:string} | {type:'releaseAll'} | {type:'heartbeat';pressedKeys:string[];pressedButtons:(0|1|2)[]};
/** Dedicated independent lanes, with reliable order preserved through asynchronous MAC generation. */
export function createRemotePcInputSender(options:{current():boolean;send(payload:RemotePcBrowserInput,lane:'move'|'reliable',seq:number,deadline:number):Promise<unknown>;now?():number;schedule?(callback:()=>void):number;cancel?(id:number):void;sequences?:{move:number;reliable:number}}) {
  const sequences=options.sequences||{move:0,reliable:0};
  let pending:RemotePcPoint|undefined,frame:number|undefined,disposed=false;
  let queue=Promise.resolve(),epoch=0;
  const now=options.now||Date.now,schedule=options.schedule||requestAnimationFrame,cancel=options.cancel||cancelAnimationFrame;
  const enqueue=(payload:RemotePcBrowserInput,lane:'move'|'reliable',seq:number)=>{
    const deadline=now()+300,version=epoch;
    queue=queue.catch(()=>undefined).then(async()=>{if(disposed||version!==epoch||!options.current())return;if(now()>deadline){if(lane==='reliable')throw new Error('Remote PC reliable input expired');return;}await options.send(payload,lane,seq,deadline);});
    return queue;
  };
  const clearMove=()=>{pending=undefined;if(frame!==undefined)cancel(frame);frame=undefined;};
  const reliable=(payload:Exclude<RemotePcBrowserInput,{type:'move'}>)=>{
    if(disposed||!options.current())return Promise.resolve();
    if(payload.type==='button'){clearMove();payload={...payload,moveBarrier:++sequences.move};}
    return enqueue(payload,'reliable',++sequences.reliable);
  };
  return {
    move(point:RemotePcPoint){if(disposed||!options.current())return;pending=point;if(frame!==undefined)return;frame=schedule(()=>{frame=undefined;const point=pending;pending=undefined;if(point&&!disposed&&options.current())void enqueue({type:'move',...point},'move',++sequences.move).catch(()=>undefined);});},
    reliable,
    release(){epoch++;clearMove();return reliable({type:'releaseAll'});},
    flush:()=>queue,
    dispose(){clearMove();disposed=true;},
  };
}

/** Commit complete Unicode text only; chunks never split a surrogate pair. */
export function remotePcTextChunks(value:string){
 if(!value||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error('Invalid remote text');
 const chunks:string[]=[];let chunk='';
 for(const point of value){if(point.length===1&&/[\ud800-\udfff]/.test(point))throw new Error('Invalid Unicode');if(chunk.length+point.length>256){chunks.push(chunk);chunk='';}chunk+=point;}
 if(chunk)chunks.push(chunk);return chunks;
}
