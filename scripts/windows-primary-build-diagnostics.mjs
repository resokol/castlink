import {writeFile} from 'node:fs/promises';
import path from 'node:path';

// Compile-only child output stays in the private, newly-created build artifact.
export async function retainPrimaryCompileDiagnostics(output, result) {
  const bounded = value => {
    if (value == null) return Buffer.alloc(0);
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) throw Error('Invalid compile output.');
    const bytes = Buffer.from(value);
    if (bytes.length > 1048576) throw Error('Compile output exceeds its bound.');
    return bytes;
  };
  const stdout = bounded(result.stdout), stderr = bounded(result.stderr);
  const code = result.error?.code;
  const receipt = {
    schemaVersion: 1, phase: 'native-compile-link', nativeExecution: 'not-run',
    status: Number.isInteger(result.status) ? result.status : null,
    signal: typeof result.signal === 'string' && /^SIG[A-Z0-9]{1,16}$/.test(result.signal) ? result.signal : null,
    errorCode: typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : result.error ? 'UNKNOWN' : null,
    stdoutBytes: stdout.length, stderrBytes: stderr.length,
  };
  await writeFile(path.join(output, 'BUILD-STDOUT.log'), stdout, {flag:'wx'});
  await writeFile(path.join(output, 'BUILD-STDERR.log'), stderr, {flag:'wx'});
  await writeFile(path.join(output, 'BUILD-DIAGNOSTIC.json'), JSON.stringify(receipt, null, 2)+'\n', {flag:'wx'});
  return receipt;
}
