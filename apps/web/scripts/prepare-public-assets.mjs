import {cp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {preparePdfAssets} from './prepare-pdf-assets.mjs';

// Keep local Next runs consistent with the canonical assets copied by Docker.
await preparePdfAssets();
const source=fileURLToPath(new URL('../../../design-preview/new/',import.meta.url));
const target=fileURLToPath(new URL('../public/new/',import.meta.url));
await rm(target,{recursive:true,force:true});
await cp(source,target,{recursive:true});
