import type {CheckResult, Executor, Profile} from './types.js';
import {SshExecutor} from './executors/ssh.js';
import {prerequisiteChecks} from './probe.js';

// This deliberately diagnoses prerequisites, not installation, service, TLS or media readiness.
export async function diagnosePrerequisites(profile:Profile|null,localExecutor:Executor):Promise<CheckResult[]> {
  const target=profile?.request.target;
  return target?.kind==='remote'
    ? prerequisiteChecks(new SshExecutor(target,localExecutor),true)
    : prerequisiteChecks(localExecutor,false);
}
