import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
// Build-only fixed payload. Both regular files are inventoried before admission.
export async function stageFixedDockerConfig(payload){const directory=path.join(payload,'metadata/docker-config');await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'config.json'),'{}\n',{flag:'wx'});await writeFile(path.join(directory,'cli-plugins'),'disabled\n',{flag:'wx'});}
