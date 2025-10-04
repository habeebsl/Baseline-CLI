import { Command } from 'commander';
import { executeCommand } from './commands';

const packageJson = require('../package.json');
const program = new Command();

program
  .version(packageJson.version)
  .description('CLI tool for checking Web Platform Baseline compatibility')
  .option('-v, --verbose', 'output extra information');

// Check command
program
  .command('check [path]')
  .description('Check files for Web Platform Baseline compatibility')
  .option('--strict', 'fail on warnings')
  .option('--format <type>', 'output format (console, json, html)', 'console')
  .option('--quiet', 'minimal output')
  .option('--verbose', 'detailed output')
  .action(async (path, options) => {
    const args = [];
    if (path) args.push(path);
    if (options.strict) args.push('--strict');
    if (options.format !== 'console') args.push('--format', options.format);
    if (options.quiet) args.push('--quiet');
    if (options.verbose) args.push('--verbose');
    
    await executeCommand('check', args);
  });

// Init command
program
  .command('init')
  .description('Initialize baseline configuration')
  .option('--preset <type>', 'configuration preset (strict, balanced, legacy)', 'balanced')
  .action(async (options) => {
    const args = [];
    if (options.preset !== 'balanced') args.push('--preset', options.preset);
    
    await executeCommand('init', args);
  });

// Config command
program
  .command('config')
  .description('View and manage baseline configuration')
  .option('--edit', 'edit configuration file')
  .option('--set <key> <value>', 'set configuration value')
  .option('--get <key>', 'get configuration value')
  .action(async (options) => {
    const args = [];
    if (options.edit) args.push('--edit');
    if (options.set) args.push('--set', ...options.set.split('='));
    if (options.get) args.push('--get', options.get);
    
    await executeCommand('config', args);
  });

program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}