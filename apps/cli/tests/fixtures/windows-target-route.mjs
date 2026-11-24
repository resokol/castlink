import {registerHooks} from 'node:module';
import {load} from './windows-target-route-loader.mjs';
registerHooks({load});
export function targetFixture(provider,prefix=''){const f={provider,prefix,requests:[],families:[]};globalThis.__windowsTargetRouteFixture=f;return f;}
export const missingTargetFs="const fixtureFs=require('node:fs');fixtureFs.lstatSync=()=>{const e=Error('fixture missing');e.code='ENOENT';throw e};";
export function generationProvider(value,calls=[]){return{executeSync(operation,input){calls.push({operation,input});if(operation==='target-lease-v1'&&input.action==='identity')return{status:'ok',stdout:JSON.stringify({principal:value.principal?.sid,scope:value.scope,scopeIdentity:'12345678:123456789ABCDEF0'})};if(operation==='docker-engine-v1')return{status:'ok',stdout:JSON.stringify({engine:value.engine,endpoint:value.endpoint})};throw Error('unexpected generation fixture operation')},target(){throw Error('generation cannot run a target effect')}};}
