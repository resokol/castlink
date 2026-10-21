import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const imageId = /^sha256:[a-f0-9]{64}$/;
const sourceId = /^[a-f0-9]{40}$/;
const stages = new Set(['web-builder', 'web-runtime', 'turntls-builder', 'turntls-runtime']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
export function expectedSource(image, explicit = '') {
  const tagged = /:([a-f0-9]{40})$/.exec(image)?.[1] || '';
  if (explicit && !sourceId.test(explicit)) throw Error('Invalid explicit image source');
  if (explicit && tagged && explicit !== tagged) throw Error('Explicit image source does not match immutable tag source');
  return explicit || tagged;
}
function inspect(docker, reference) {
  const image = JSON.parse(docker(['image', 'inspect', reference, '--format', '{{json .}}']));
  if (!imageId.test(image?.Id) || !own(image, 'Parent') || typeof image.Parent !== 'string' || (image.Parent && !imageId.test(image.Parent))) throw Error('Incomplete image identity/parent observation');
  if (imageId.test(reference) && image.Id !== reference) throw Error('Image identity changed');
  return image;
}
function marked(image, source, stage) {
  const labels = image?.Config?.Labels;
  return sourceId.test(source) && labels?.['ru.castlink.image.owner'] === 'castlink' && labels?.['ru.castlink.image.ownership'] === 'castlink-build-v1' && labels?.['ru.castlink.image.source'] === source && stages.has(labels?.['ru.castlink.image.stage']) && (!stage || labels['ru.castlink.image.stage'] === stage);
}
function validEntry(entry) {return imageId.test(entry?.id) && sourceId.test(entry?.source) && stages.has(entry?.stage);}
function validate(receipt, scope = receipt?.scope) {
  if (receipt?.schemaVersion !== 1 || typeof scope !== 'string' || !scope || receipt.scope !== scope || !Array.isArray(receipt.parents) || !receipt.parents.every(validEntry)) throw Error('Invalid parent image receipt or installation scope');
}
export function registerParentImages({docker, receipt, source, currentImages}) {
  validate(receipt);
  if (!source) return receipt; // Historical short tags cannot prove an expected release source.
  if (!sourceId.test(source)) throw Error('Invalid expected release source');
  const parents = [...receipt.parents];
  if (!Array.isArray(currentImages) || !currentImages.length) throw Error('Loaded release roots are unknown');
  const queue = [...currentImages]; const seen = new Set();
  while (queue.length) {
    const image = inspect(docker, queue.shift());
    if (seen.has(image.Id)) continue; seen.add(image.Id);
    if (image.Parent) queue.push(image.Parent);
    // Descendants inherit labels: only supplied loaded roots and their Parent
    // chain qualify. Exact source/markers remain a separate ownership requirement.
    if (marked(image, source) && !parents.some(entry => entry.id === image.Id)) parents.push({id: image.Id, source, stage: image.Config.Labels['ru.castlink.image.stage']});
  }
  return {...receipt, parents};
}
function layers(image) {
  const result = image?.RootFS?.Layers;
  if (!Array.isArray(result) || !result.length || !result.every(value => typeof value === 'string' && imageId.test(value))) throw Error('Incomplete image filesystem layer observation');
  return result;
}
function protection(docker, currentImages) {
  if (!Array.isArray(currentImages) || !currentImages.length) throw Error('Current image set is unknown');
  const ids = new Set(); const queue = []; const roots = []; const rootImages = []; const ancestors = new Set();
  const addRoot = reference => {const image = inspect(docker, reference); roots.push(layers(image)); rootImages.push({id: image.Id, layers: layers(image)}); if (!ids.has(image.Id)) {ids.add(image.Id); queue.push(image.Id);}};
  currentImages.forEach(addRoot);
  const containers = docker(['ps', '-aq', '--no-trunc']).trim().split(/\r?\n/).filter(Boolean);
  for (const container of containers) {
    const id = docker(['inspect', container, '--format', '{{.Image}}']).trim();
    if (!imageId.test(id)) throw Error('Incomplete container image observation');
    addRoot(id);
  }
  while (queue.length) {
    const image = inspect(docker, queue.shift());
    if (image.Parent) {ancestors.add(image.Parent); if (!ids.has(image.Parent)) {ids.add(image.Parent); queue.push(image.Parent);}}
  }
  return {ids, roots, rootImages, ancestors};
}
export function mayRetireLeafImage({docker, currentImages, tag}) {
  try {
    const protectedImages = protection(docker, currentImages); const image = inspect(docker, tag); const candidate = layers(image);
    if (protectedImages.ancestors.has(image.Id)) return false;
    if (protectedImages.rootImages.some(root => root.id !== image.Id && candidate.length <= root.layers.length && candidate.every((value, index) => value === root.layers[index]))) return false;
    if (protectedImages.ids.has(image.Id) && (!Array.isArray(image.RepoTags) || !image.RepoTags.some(value => typeof value === 'string' && value && value !== tag))) return false;
    return true;
  } catch {return false;}
}
function unreferenced(image) {
  return ['RepoTags', 'RepoDigests'].every(key => own(image, key) && (image[key] === null || (Array.isArray(image[key]) && image[key].length === 0)));
}
export function cleanupParentImages({docker, receipt, currentImages}) {
  validate(receipt);
  const warnings = []; const retained = [];
  if (!receipt.parents.length) return {...receipt, warnings};
  let protectedImages;
  try {protectedImages = protection(docker, currentImages);} catch (error) {return {...receipt, warnings: ['Parent images retained: ' + error.message]};}
  for (const entry of receipt.parents) {
    if (protectedImages.ids.has(entry.id)) {retained.push(entry); continue;}
    try {
      const image = inspect(docker, entry.id);
      if (!marked(image, entry.source, entry.stage) || !unreferenced(image)) {retained.push(entry); continue;}
      const candidateLayers = layers(image);
      // Modern Docker may omit Parent: layer prefixes add a conservative veto.
      if (protectedImages.roots.some(root => candidateLayers.length <= root.length && candidateLayers.every((value, index) => value === root[index]))) {retained.push(entry); continue;}
      docker(['image', 'rm', '--no-prune', entry.id]);
    } catch (error) {retained.push(entry); warnings.push('Owned parent retained for retry: ' + entry.id + ' (' + error.message + ')');}
  }
  return {...receipt, parents: retained, warnings};
}
function callDocker(args) {
  const result = spawnSync('docker', args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024});
  if (result.error || result.status !== 0) throw Error('Docker observation/cleanup failed: ' + (result.error?.message || result.stderr || 'exit ' + result.status));
  return result.stdout;
}
function readReceipt(file, scope) {
  if (!fs.existsSync(file)) return {schemaVersion: 1, scope, parents: []};
  if (fs.lstatSync(file).isSymbolicLink()) throw Error('Refusing a symlink parent image receipt');
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8')); validate(receipt, scope); return receipt;
}
function saveReceipt(file, receipt) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify({schemaVersion: 1, scope: receipt.scope, parents: receipt.parents}) + '\n', {encoding: 'utf8', mode: 0o600, flag: 'wx'});
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error('Refusing a symlink parent image receipt');
    fs.renameSync(temporary, file);
  } finally {fs.rmSync(temporary, {force: true});}
}
function main(args) {
  const command = args.shift(); const options = {};
  for (let index = 0; index < args.length; index += 2) {if (!args[index]?.startsWith('--') || !args[index + 1]) throw Error('Invalid parent image retention arguments'); options[args[index].slice(2)] = args[index + 1];}
  if (!['register', 'cleanup', 'allow-leaf'].includes(command) || !options.root || !options.scope || !options.image) throw Error('Parent image retention requires command, root, scope and image');
  const file = path.join(options.root, '.castlink-production-parent-images.json');
  const receipt = readReceipt(file, options.scope);
  if (command === 'register') {
    const source = expectedSource(options.image, process.env.CASTLINK_SOURCE_COMMIT || '');
    if (source) saveReceipt(file, registerParentImages({docker: callDocker, receipt, source, currentImages: [options.image]}));
  } else {
    const config = JSON.parse(callDocker(['compose', '-f', options.scope, 'config', '--format', 'json']));
    if (!config?.services || !Object.keys(config.services).length || Object.values(config.services).some(service => typeof service.image !== 'string' || !service.image)) throw Error('Incomplete current Compose image observation');
    const currentImages = [...new Set([options.image, ...Object.values(config.services).map(service => service.image)])];
    if (command === 'allow-leaf') {if (!options.candidate || !mayRetireLeafImage({docker: callDocker, currentImages, tag: options.candidate})) process.exitCode = 1; return;}
    const result = cleanupParentImages({docker: callDocker, receipt, currentImages});
    saveReceipt(file, result); result.warnings.forEach(warning => console.error(warning));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {main(process.argv.slice(2));} catch (error) {console.error('Parent images retained: ' + error.message); process.exitCode = 1;}
}
