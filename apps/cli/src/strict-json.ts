// JSON.parse discards duplicate keys. Decode key tokens, including escaped aliases,
// before accepting protocol/schema objects. JSON.parse handles syntax validation.
export function parseStrictJson(raw:string,maxBytes:number):unknown {
 if(typeof raw!=='string'||Buffer.byteLength(raw)>maxBytes||raw.includes('\uFFFD'))throw Error('Invalid JSON response.');
 const value:unknown=JSON.parse(raw);
 const stack:({keys:Set<string>;key:boolean}|null)[]=[];
 for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){
  const token=match[0];
  if(token==='{')stack.push({keys:new Set(),key:true});
  else if(token==='[')stack.push(null);
  else if(token==='}'||token===']')stack.pop();
  else {const current=stack.at(-1);if(!current)continue;if(token===',')current.key=true;else if(current.key){const key=JSON.parse(token) as string;if(current.keys.has(key))throw Error('Duplicate JSON key.');current.keys.add(key);current.key=false;}}
 }
 return value;
}
