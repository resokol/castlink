'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const helper=path.resolve(__dirname,'../scripts/macos-signing.cjs');
function api(){assert.ok(fs.existsSync(helper),'explicit macOS signing policy must exist');return require(helper);}
const certificate={CSC_LINK:'/private/signing.p12',CSC_KEY_PASSWORD:'certificate-password'};
const appleId={APPLE_ID:'builder@example.invalid',APPLE_APP_SPECIFIC_PASSWORD:'apple-password',APPLE_TEAM_ID:'ABCDE12345'};
const apiKey={APPLE_API_KEY:'/private/AuthKey_ABCDEFGHIJ.p8',APPLE_API_KEY_ID:'ABCDEFGHIJ',APPLE_API_ISSUER:'00000000-0000-0000-0000-000000000000'};
function distribution(env={}){return {CASTLINK_MAC_DISTRIBUTION:'1',...certificate,...appleId,...env};}

test('default signing policy preserves the ad-hoc candidate config even with ambient credentials',()=>{
  const {readMacSigningPolicy,applyMacSigningPolicy}=api();
  for(const flag of [undefined,'','0']){
    const policy=readMacSigningPolicy({...certificate,...appleId,CASTLINK_MAC_DISTRIBUTION:flag});
    assert.equal(policy.distribution,false);
    const config={mac:{identity:'-',notarize:false,hardenedRuntime:true},dmg:{sign:false},publish:null};
    assert.deepEqual(applyMacSigningPolicy(config,policy),config);
  }
  for(const flag of ['true','yes','2'])assert.throws(()=>readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:flag}),/CASTLINK_MAC_DISTRIBUTION/);
});

test('distribution mode requires an explicit complete signing credential source',()=>{
  const {readMacSigningPolicy}=api();
  for(const credentials of [{},{CSC_LINK:certificate.CSC_LINK},{CSC_KEY_PASSWORD:certificate.CSC_KEY_PASSWORD},{CSC_NAME:'Example'},{CSC_KEYCHAIN:'/private/build.keychain'},{CSC_NAME:'-',CSC_KEYCHAIN:'/private/build.keychain'},{CSC_NAME:'null',CSC_KEYCHAIN:'/private/build.keychain'}]){
    assert.throws(()=>readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...appleId,...credentials}),/CSC_LINK|CSC_NAME|identity/i);
  }
  const imported=readMacSigningPolicy(distribution());
  assert.equal(imported.credentialSource,'certificate');
  const keychain=readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...appleId,CSC_NAME:'Example Company (ABCDE12345)',CSC_KEYCHAIN:'/private/build.keychain'});
  assert.equal(keychain.credentialSource,'keychain');
  assert.equal(keychain.identity,'Example Company (ABCDE12345)');
  const full=readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...appleId,CSC_NAME:'Developer ID Application: Example Company (ABCDE12345)',CSC_KEYCHAIN:'/private/build.keychain'});
  assert.equal(full.identity,'Example Company (ABCDE12345)');
  for(const identity of ['Mac Developer: Example','Apple Development: Example','Developer ID Installer: Example'])assert.throws(()=>readMacSigningPolicy(distribution({CSC_NAME:identity})),/Developer ID Application/);
  assert.throws(()=>readMacSigningPolicy(distribution({CSC_IDENTITY_AUTO_DISCOVERY:'false'})),/CSC_NAME/);
  assert.doesNotThrow(()=>readMacSigningPolicy(distribution({CSC_IDENTITY_AUTO_DISCOVERY:'false',CSC_NAME:'Example Company (ABCDE12345)'})));
});

test('distribution mode requires one complete notarization method and rejects ambiguous or partial methods',()=>{
  const {readMacSigningPolicy}=api();
  for(const auth of [{},{APPLE_ID:'example'},{APPLE_APP_SPECIFIC_PASSWORD:'secret'},{APPLE_ID:'example',APPLE_APP_SPECIFIC_PASSWORD:'secret'},{APPLE_API_KEY:'/private/key.p8'},{APPLE_API_KEY_ID:'ABCDEFGHIJ'},{APPLE_API_ISSUER:'issuer'},{APPLE_KEYCHAIN:'/private/notary.keychain'}]){
    assert.throws(()=>readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...certificate,...auth}),/notarization|APPLE_/i);
  }
  assert.equal(readMacSigningPolicy(distribution()).notarization,'apple-id');
  assert.equal(readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...certificate,...apiKey}).notarization,'api-key');
  assert.equal(readMacSigningPolicy({CASTLINK_MAC_DISTRIBUTION:'1',...certificate,APPLE_KEYCHAIN_PROFILE:'castlink-notary'}).notarization,'keychain-profile');
  assert.throws(()=>readMacSigningPolicy(distribution(apiKey)),/one notarization/i);
  assert.throws(()=>readMacSigningPolicy(distribution({APPLE_KEYCHAIN_PROFILE:'castlink-notary'})),/one notarization/i);
  assert.throws(()=>readMacSigningPolicy(distribution({APPLE_TEAM_ID:'wrong'})),/APPLE_TEAM_ID/);
});

test('distribution policy requests required signing without copying secrets or claiming verification',()=>{
  const {readMacSigningPolicy,applyMacSigningPolicy}=api();
  const policy=readMacSigningPolicy(distribution());
  const config={mac:{identity:'-',notarize:false,hardenedRuntime:false,entitlements:'entitlements.plist'},dmg:{sign:false},publish:null};
  const effective=applyMacSigningPolicy(config,policy);
  assert.equal(effective.forceCodeSigning,true);assert.equal(effective.mac.type,'distribution');
  assert.equal(Object.hasOwn(effective.mac,'identity'),false);
  assert.equal(effective.mac.notarize,true);assert.equal(effective.mac.hardenedRuntime,true);
  assert.equal(effective.dmg.sign,true);assert.equal(effective.mac.entitlements,'entitlements.plist');
  assert.equal(effective.publish,null);assert.equal(config.mac.identity,'-');assert.equal(config.mac.notarize,false);
  const serialized=JSON.stringify({policy,effective});
  for(const secret of [certificate.CSC_LINK,certificate.CSC_KEY_PASSWORD,appleId.APPLE_APP_SPECIFIC_PASSWORD])assert.ok(!serialized.includes(secret));
  assert.equal(Object.hasOwn(policy,'signed'),false);assert.equal(Object.hasOwn(policy,'notarized'),false);
  const selected=applyMacSigningPolicy(config,readMacSigningPolicy(distribution({CSC_NAME:'Example (ABCDE12345)'})));
  assert.equal(selected.mac.identity,'Example (ABCDE12345)');
});

test('credential validation errors expose variable names without credential contents',()=>{
  const {readMacSigningPolicy}=api();
  for(const env of [distribution({CSC_LINK:'',CSC_KEY_PASSWORD:'SECRET_CERT'}),distribution({APPLE_ID:'',APPLE_APP_SPECIFIC_PASSWORD:'SECRET_APPLE'}),distribution({APPLE_TEAM_ID:'SECRET_TEAM'})]){
    assert.throws(()=>readMacSigningPolicy(env),error=>!error.message.includes('SECRET_'));
  }
});

test('distribution config is accepted by the installed pinned builder schema',async()=>{
  const {readMacSigningPolicy,applyMacSigningPolicy}=api();
  const root=path.resolve(__dirname,'../../..');
  const folder=fs.readdirSync(path.join(root,'node_modules/.pnpm')).find(name=>name.startsWith('app-builder-lib@26.15.3_'));
  assert.ok(folder,'pinned builder must be installed');
  const {validateConfiguration}=require(path.join(root,'node_modules/.pnpm',folder,'node_modules/app-builder-lib/out/util/config/config.js'));
  await validateConfiguration(applyMacSigningPolicy({appId:'ru.castlink.client',mac:{target:['dir','zip','dmg'],identity:'-',notarize:false},dmg:{sign:false},publish:null},readMacSigningPolicy(distribution())));
});
