import { Command, BaselineConfig } from '../types';
import { colors } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

export const configCommand: Command = {
    name: 'config',
    description: 'View and manage baseline configuration',
    
    async execute(args: string[]): Promise<void> {
        const configPath = path.join(process.cwd(), '.baseline.config.json');
        
        const action = parseConfigOptions(args);
        
        switch (action.type) {
            case 'view':
                await viewConfig(configPath);
                break;
            case 'set':
                await setConfigValue(configPath, action.key!, action.value!);
                break;
            case 'get':
                await getConfigValue(configPath, action.key!);
                break;
            case 'edit':
                await editConfig(configPath);
                break;
            default:
                await viewConfig(configPath);
        }
    }
};

function parseConfigOptions(args: string[]): { type: string; key?: string; value?: string } {
    if (args.length === 0) {
        return { type: 'view' };
    }
    
    const firstArg = args[0];
    
    if (firstArg === '--edit') {
        return { type: 'edit' };
    }
    
    if (firstArg === '--set' && args.length >= 3) {
        return {
            type: 'set',
            key: args[1],
            value: args[2]
        };
    }
    
    if (firstArg === '--get' && args.length >= 2) {
        return {
            type: 'get',
            key: args[1]
        };
    }
    
    return { type: 'view' };
}

async function viewConfig(configPath: string): Promise<void> {
    console.log(colors.bold('⚙️  Baseline Configuration'));
    console.log('');
    
    if (!fs.existsSync(configPath)) {
        console.log(colors.yellow('⚠ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    
    try {
        const config: BaselineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        console.log(colors.bold('General Settings:'));
        console.log(`${colors.blue('Strict mode:')} ${config.strict ? colors.green('enabled') : colors.gray('disabled')}`);
        console.log(`${colors.blue('Target baseline:')} ${colors.cyan(config.targets.baseline)}`);
        console.log(`${colors.blue('Auto-fix:')} ${config.autofix ? colors.green('enabled') : colors.gray('disabled')}`);
        console.log(`${colors.blue('Output format:')} ${colors.cyan(config.outputFormat)}`);
        console.log('');
        
        console.log(colors.bold('Include Patterns:'));
        config.include.forEach(pattern => {
            console.log(`  ${colors.green('+')} ${pattern}`);
        });
        console.log('');
        
        console.log(colors.bold('Ignore Patterns:'));
        config.ignore.forEach(pattern => {
            console.log(`  ${colors.red('-')} ${pattern}`);
        });
        console.log('');
        
        console.log(colors.bold('Rules:'));
        if (Object.keys(config.rules).length === 0) {
            console.log(colors.gray('  No custom rules defined'));
        } else {
            Object.entries(config.rules).forEach(([rule, level]) => {
                const levelColor = level === 'error' ? colors.red : level === 'warn' ? colors.yellow : colors.blue;
                console.log(`  ${colors.cyan(rule)}: ${levelColor(level)}`);
            });
        }
        console.log('');
        
        console.log(colors.gray('Available commands:'));
        console.log(colors.gray('  baseline config --edit        # Edit configuration file'));
        console.log(colors.gray('  baseline config --set <key> <value>  # Set a value'));
        console.log(colors.gray('  baseline config --get <key>   # Get a value'));
        
    } catch (error) {
        console.error(colors.red(`Error reading configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}

async function setConfigValue(configPath: string, key: string, value: string): Promise<void> {
    if (!fs.existsSync(configPath)) {
        console.log(colors.red('❌ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    
    try {
        const config: BaselineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        const keyParts = key.split('.');
        let current: any = config;
        
        for (let i = 0; i < keyParts.length - 1; i++) {
            if (!(keyParts[i] in current)) {
                current[keyParts[i]] = {};
            }
            current = current[keyParts[i]];
        }
        
        const finalKey = keyParts[keyParts.length - 1];
        let parsedValue: any = value;
        
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (/^\\d+$/.test(value)) parsedValue = parseInt(value);
        else if (/^\\d*\\.\\d+$/.test(value)) parsedValue = parseFloat(value);
        
        current[finalKey] = parsedValue;
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log(colors.green(`✓ Updated ${colors.cyan(key)} to ${colors.bold(String(parsedValue))}`));
        
    } catch (error) {
        console.error(colors.red(`Error setting configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}

async function getConfigValue(configPath: string, key: string): Promise<void> {
    if (!fs.existsSync(configPath)) {
        console.log(colors.red('❌ No configuration file found'));
        return;
    }
    
    try {
        const config: BaselineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        const keyParts = key.split('.');
        let current: any = config;
        
        for (const part of keyParts) {
            if (!(part in current)) {
                console.log(colors.red(`❌ Key "${key}" not found in configuration`));
                return;
            }
            current = current[part];
        }
        
        console.log(`${colors.cyan(key)}: ${colors.bold(JSON.stringify(current, null, 2))}`);
        
    } catch (error) {
        console.error(colors.red(`Error getting configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}

async function editConfig(configPath: string): Promise<void> {
    if (!fs.existsSync(configPath)) {
        console.log(colors.red('❌ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    
    const editor = process.env.EDITOR || 'code'; // Default to VS Code
    
    console.log(colors.blue(`📝 Opening configuration in ${editor}...`));
    console.log(colors.gray(`File: ${configPath}`));
    
    // Note: In a real implementation, you'd use child_process.spawn to open the editor
    // For now, just show the path
    console.log('');
    console.log(colors.yellow('Manual edit required:'));
    console.log(colors.gray(`Edit the file: ${configPath}`));
}