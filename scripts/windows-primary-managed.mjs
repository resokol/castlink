// Build-only extraction: runtime catalogs never accept caller C# or assembly paths.
const types={bridge:'CastLinkPrivate',setup:'CastLinkSetupDirectory',backup:'CastLinkBackupOutput'};
export function extractManagedCatalog(name,script){
 if(!Object.hasOwn(types,name)||typeof script!=='string')throw Error('Managed catalog refused.');
 const matches=[...script.matchAll(/Add-Type(?: -ReferencedAssemblies 'System','System.Core','System.Web.Extensions')? -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/g)];
 if(matches.length!==1||script.split('Add-Type').length!==2)throw Error('Managed catalog compiler shape refused.');
 const compilerBlock=matches[0][0],source=matches[0][1];
 if(!source.includes('public static class '+types[name]+' ')||/Assembly(?:Resolve|\.Load)|LoadLibrary|NativeLibrary|Activator|Process\.Start|Reflection\.Emit/.test(source))throw Error('Managed catalog dependency refused.');
 const imports=[...new Set([...source.matchAll(/\[DllImport\("([^"]+)"/g)].map(m=>m[1]))].sort();if(imports.length!==2||imports[0]!=='advapi32.dll'||imports[1]!=='kernel32.dll')throw Error('Managed catalog imports refused.');
 return {source,compilerBlock,script:script.replace(compilerBlock,''),imports};
}
export function renderOSWorkerPrefix(){
 const modules=['Management','Utility','Security'];
 return "$ErrorActionPreference='Stop';$PSModuleAutoLoadingPreference='None';try {"+modules.map(m=>"Import-Module -Name ($PSHOME+'\\Modules\\Microsoft.PowerShell."+m+"\\Microsoft.PowerShell."+m+".psd1') -ErrorAction Stop;").join('')+"[Console]::InputEncoding=[Text.UTF8Encoding]::new($false,$true);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false,$true);}catch{exit 4};\n";
}
