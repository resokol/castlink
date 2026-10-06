import { CliError } from './types.js';

export type ParsedArgs = { command: string; profile?: string; dryRun: boolean; json: boolean; options: Record<string, string> };
const commands = new Set(['setup','status','doctor','start','stop','backup','update','rollback','uninstall','owner-invite','help','version']);
const values = new Set(['target','profile','root','network','host','user','port','domain','release','release-manifest','architecture','bind-ipv4','journal-directory','remote-scope']);
const switches = new Set(['dry-run','json','delete-data','media','prepare-config','start-services','prepare-database','provision-images','prepare-owner']);

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') return { command:'help', dryRun:false, json:false, options:{} };
  if (argv[0] === '--version') return { command:'version', dryRun:false, json:false, options:{} };
  const command = argv[0]!;
  if (!commands.has(command)) throw new CliError('Unknown command; run castlink --help.');
  const commandValues=command==='uninstall'?new Set([...values,'confirm-profile']):command==='backup'?new Set([...values,'output-directory']):values;
  const options: Record<string,string> = {};
  const seen = new Set<string>();
  for (let i=1;i<argv.length;i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) throw new CliError('Expected an option beginning with --.');
    const key = token.slice(2);
    if (!commandValues.has(key) && !switches.has(key)) throw new CliError('Unknown option; run castlink --help.');
    if (seen.has(key)) throw new CliError('Duplicate option.');
    seen.add(key);
    if (switches.has(key)) options[key] = 'true';
    else {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--') || !value.trim() || /[\x00\r\n]/.test(value)) throw new CliError('Option requires a valid value.');
      options[key] = value;
    }
  }
  const allowed = command === 'setup' ? new Set([...values,'dry-run','json','prepare-config','start-services','prepare-database','provision-images','prepare-owner']) : new Set(['profile','json',...(['start','stop'].includes(command)?['dry-run']:[]),...(command==='backup'?['output-directory','dry-run']:[]),...(command==='doctor'?['media']:[]),...(command==='update'?['release']:[]),...(command==='uninstall'?['delete-data','confirm-profile','dry-run']:[])]);
  if (Object.keys(options).some(key=>!allowed.has(key))) throw new CliError('Option is not valid for this command.');
  if(['prepare-config','start-services','prepare-database','provision-images','prepare-owner'].filter(key=>options[key]).length>1)throw new CliError('Choose exactly one setup stage: --prepare-config, --start-services, --prepare-database or --provision-images or --prepare-owner.');
  return { command, profile:options.profile, dryRun:options['dry-run']==='true', json:options.json==='true', options };
}
