'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');

// electron-builder 26.15.3: MacTargetHelper.getNotarizeOptions reads these
// environment groups. Keep credentials in the environment, never in the config
// JSON, package manifest, policy, command output, or validation errors.
// Signing: CSC_LINK + CSC_KEY_PASSWORD, or CSC_NAME + CSC_KEYCHAIN pointing to
// an already unlocked keychain containing a Developer ID Application identity.
// Notarization: APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or
// APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or
// APPLE_KEYCHAIN_PROFILE (and optionally APPLE_KEYCHAIN).
function readMacSigningPolicy(env=process.env){
  const present=name=>typeof env[name]==='string'&&env[name].trim().length>0;
  const flag=env.CASTLINK_MAC_DISTRIBUTION;
  if(flag===undefined||flag===''||flag==='0')return Object.freeze({distribution:false});
  if(flag!=='1')throw Error('CASTLINK_MAC_DISTRIBUTION must be 1 to request distribution signing, or 0/unset for an ad-hoc candidate');

  let identity=present('CSC_NAME')?env.CSC_NAME.trim():undefined;
  if(identity){
    identity=identity.replace(/^Developer ID Application:\s*/, '');
    if(!identity||['-','null'].includes(identity.toLowerCase())||/[\r\n\0]/.test(identity)||/^(?:Mac Developer|Apple Development|Apple Distribution|Developer ID Installer|3rd Party Mac Developer)/.test(identity)){
      throw Error('CSC_NAME must select a Developer ID Application identity, never an ad-hoc or development identity');
    }
  }
  let credentialSource;
  if(present('CSC_LINK')||present('CSC_KEY_PASSWORD')){
    if(!present('CSC_LINK')||!present('CSC_KEY_PASSWORD'))throw Error('Distribution signing requires both CSC_LINK and CSC_KEY_PASSWORD');
    credentialSource='certificate';
  }else{
    if(!identity||!present('CSC_KEYCHAIN'))throw Error('Distribution signing requires CSC_LINK + CSC_KEY_PASSWORD or explicit CSC_NAME + CSC_KEYCHAIN');
    credentialSource='keychain';
  }
  if(!identity&&env.CSC_IDENTITY_AUTO_DISCOVERY==='false')throw Error('CSC_NAME is required when CSC_IDENTITY_AUTO_DISCOVERY is false');

  const methods=[
    {name:'apple-id',trigger:['APPLE_ID','APPLE_APP_SPECIFIC_PASSWORD'],required:['APPLE_ID','APPLE_APP_SPECIFIC_PASSWORD','APPLE_TEAM_ID']},
    {name:'api-key',trigger:['APPLE_API_KEY','APPLE_API_KEY_ID','APPLE_API_ISSUER'],required:['APPLE_API_KEY','APPLE_API_KEY_ID','APPLE_API_ISSUER']},
    {name:'keychain-profile',trigger:['APPLE_KEYCHAIN_PROFILE','APPLE_KEYCHAIN'],required:['APPLE_KEYCHAIN_PROFILE']}
  ].filter(method=>method.trigger.some(present));
  if(methods.length!==1)throw Error('Distribution signing requires exactly one notarization credential method: APPLE_ID, APPLE_API_KEY, or APPLE_KEYCHAIN_PROFILE');
  const method=methods[0];
  if(!method.required.every(present))throw Error('Incomplete notarization credentials: set '+method.required.join(' + '));
  let expectedTeamIdentifier;
  if(present('APPLE_TEAM_ID')){
    if(!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID))throw Error('APPLE_TEAM_ID must be a ten-character Apple team identifier');
    expectedTeamIdentifier=env.APPLE_TEAM_ID;
  }
  return Object.freeze({distribution:true,credentialSource,notarization:method.name,...(identity?{identity}:{}),...(expectedTeamIdentifier?{expectedTeamIdentifier}:{})});
}

function applyMacSigningPolicy(config,policy){
  if(!policy.distribution)return config;
  const mac={...config.mac,type:'distribution',notarize:true,hardenedRuntime:true};
  // Builder's explicit "-" permits ad-hoc signing even with forceCodeSigning.
  // An omitted identity selects Developer ID from the explicitly supplied P12.
  delete mac.identity;
  if(policy.identity)mac.identity=policy.identity;
  return {...config,forceCodeSigning:true,mac,dmg:{...config.dmg,sign:true}};
}

// Invoke only AFTER builder.build resolves and BEFORE emitting a distribution
// manifest. These are real checks against the completed .app, not an inference
// from requested options or the presence of credentials. No runner injection:
// unit tests must not turn invented command output into verified build claims.
function verifyMacDistributionBundle(appPath,policy){
  if(!policy.distribution)throw Error('Bundle distribution verification requires an explicit distribution signing policy');
  if(process.platform!=='darwin')throw Error('Verify distribution signing on the native macOS build host');
  if(typeof appPath!=='string'||!path.isAbsolute(appPath)||!appPath.endsWith('.app'))throw Error('Verify the absolute path of the actual built .app bundle');
  let bundle;
  try{
    bundle=fs.realpathSync(appPath);
    if(!fs.statSync(bundle).isDirectory()||!fs.statSync(path.join(bundle,'Contents/Info.plist')).isFile())throw Error();
  }catch{throw Error('Built macOS app bundle is missing or incomplete');}
  const run=(command,args,label)=>{
    const result=spawnSync(command,args,{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,LC_ALL:'C',LANG:'C'}});
    // Deliberately do not rethrow command errors or echo their output: inherited
    // tool diagnostics can contain authentication details from the build host.
    if(result.error||result.status!==0)throw Error('macOS distribution verification failed: '+label);
    return (result.stdout||'')+'\n'+(result.stderr||'');
  };
  run('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',bundle],'codesign integrity');
  const signature=run('/usr/bin/codesign',['--display','--verbose=4',bundle],'codesign identity');
  const team=signature.match(/^TeamIdentifier=([A-Z0-9]{10})\s*$/m)?.[1];
  const authority=signature.match(/^Authority=(Developer ID Application: [^\r\n]+)$/m)?.[1];
  if(!team||!authority||!authority.endsWith('('+team+')')||!/^CodeDirectory(?:\s|=).*\bflags=0x[0-9a-f]+\([^\r\n]*\bruntime\b/m.test(signature))throw Error('Built app lacks a valid Developer ID Application signature, team identifier, or hardened runtime');
  if(policy.expectedTeamIdentifier&&team!==policy.expectedTeamIdentifier)throw Error('Built app signing team does not match APPLE_TEAM_ID');
  if(policy.identity&&!authority.includes(policy.identity))throw Error('Built app signing authority does not match CSC_NAME');
  const assessment=run('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',bundle],'Gatekeeper assessment');
  if(!/^.*: accepted\s*$/m.test(assessment)||!/^source=Notarized Developer ID\s*$/m.test(assessment))throw Error('Gatekeeper did not accept the built app as Notarized Developer ID');
  run('/usr/bin/xcrun',['stapler','validate',bundle],'stapled notarization ticket');
  return {signed:true,signing:'developer-id',notarized:true,signingIdentity:authority,signingTeamIdentifier:team,
    signingVerification:{codesign:'verified',gatekeeper:'accepted',notarization:'stapled-ticket-validated'}};
}

module.exports={readMacSigningPolicy,applyMacSigningPolicy,verifyMacDistributionBundle};
