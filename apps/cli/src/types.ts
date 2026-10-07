import type {InternetConfiguration} from './internet-network.js';
export type Target = { kind: 'local' } | { kind: 'remote'; host: string; user: string; port: number };
export type NetworkMode = 'loopback' | 'lan' | 'internet';
export type InstallRequest = { profile: string; target: Target; network: NetworkMode; domain?: string; internet?: InternetConfiguration; root: string; release: string };
export type HostFacts = { platform: string; arch: string; runtimeReady: boolean; osVersion?: string; existingInstallationId?: string };
export type StepId = 'preflight' | 'runtime' | 'release' | 'config' | 'services' | 'migrations' | 'seed' | 'owner' | 'verify';
export type InstallPlan = { schemaVersion: 1; request: InstallRequest; steps: StepId[]; blockers: string[] };
export type CommandResult = { code: number; stdout: string; stderr: string };
export type ExecutionRequest = { executable: string; args: string[]; input?: Uint8Array; sensitive: boolean };
export interface Executor { run(command: ExecutionRequest): Promise<CommandResult>; }
export type CheckResult = { id: string; state: 'pass' | 'fail' | 'warning' | 'unverified'; message: string };
export type Profile = { schemaVersion: 1; installationId: string; request: InstallRequest; currentRelease: string; previousRelease?: string; secretFilePaths: Record<string, string> };
export interface StateStore { load(name: string): Promise<Profile | null>; save(profile: Profile): Promise<void>; lock(name: string): Promise<() => Promise<void>>; }
export type CliDependencies = {
  readLine: (prompt: string, hidden: boolean) => Promise<string>;
  write: (text: string) => void;
  detect: (target: Target) => Promise<HostFacts>;
  executor: Executor;
  store: StateStore;
};

export class CliError extends Error {
  constructor(message: string, readonly code: number = 2) { super(message); this.name = 'CliError'; }
}
