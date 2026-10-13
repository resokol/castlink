import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBundleNetwork} from '../dist/network.js';

test('loopback candidate uses only the exact explicit IPv4 origin and ports',()=>{
 assert.deepEqual(validateBundleNetwork('loopback','127.0.0.1'),{bindIPv4:'127.0.0.1',origin:'https://127.0.0.1',httpsPort:443,iceTcpPort:7881,iceUdpRange:'61000-61100'});
 for(const ip of ['127.0.0.2','localhost','0.0.0.0','::1','192.168.1.2',undefined])assert.throws(()=>validateBundleNetwork('loopback',ip));
});
test('LAN accepts canonical private unicast IPv4 without detecting interfaces',()=>{
 for(const ip of ['10.0.0.2','172.16.0.2','172.31.255.254','192.168.50.20'])assert.equal(validateBundleNetwork('lan',ip).origin,`https://${ip}`);
 for(const ip of ['0.0.0.0','127.0.0.1','169.254.1.1','224.0.0.1','255.255.255.255','8.8.8.8','172.32.0.2','192.168.01.2','192.168.1.256','192.168.1.2\n','192.168.1.2:443','192.168.1.2/24','192.168.1.2;echo x',true])assert.throws(()=>validateBundleNetwork('lan',ip));
});
test('internet and unknown network modes fail closed without network or TURN guesses',()=>{
 for(const mode of ['internet','unknown',undefined])assert.throws(()=>validateBundleNetwork(mode,'192.168.1.2'),/unsupported/i);
});
