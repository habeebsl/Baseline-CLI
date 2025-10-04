"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = void 0;
const utils_1 = require("../utils");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.configCommand = {
    name: 'config',
    description: 'View and manage baseline configuration',
    async execute(args) {
        const configPath = path.join(process.cwd(), '.baseline.config.json');
        // Parse command arguments
        const action = parseConfigOptions(args);
        switch (action.type) {
            case 'view':
                await viewConfig(configPath);
                break;
            case 'set':
                await setConfigValue(configPath, action.key, action.value);
                break;
            case 'get':
                await getConfigValue(configPath, action.key);
                break;
            case 'edit':
                await editConfig(configPath);
                break;
            default:
                await viewConfig(configPath);
        }
    }
};
// Parse config command options
function parseConfigOptions(args) {
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
    // Default to view
    return { type: 'view' };
}
// View current configuration
async function viewConfig(configPath) {
    console.log(utils_1.colors.bold('⚙️  Baseline Configuration'));
    console.log('');
    if (!fs.existsSync(configPath)) {
        console.log(utils_1.colors.yellow('⚠ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(utils_1.colors.bold('General Settings:'));
        console.log(`${utils_1.colors.blue('Strict mode:')} ${config.strict ? utils_1.colors.green('enabled') : utils_1.colors.gray('disabled')}`);
        console.log(`${utils_1.colors.blue('Target baseline:')} ${utils_1.colors.cyan(config.targets.baseline)}`);
        console.log(`${utils_1.colors.blue('Auto-fix:')} ${config.autofix ? utils_1.colors.green('enabled') : utils_1.colors.gray('disabled')}`);
        console.log(`${utils_1.colors.blue('Output format:')} ${utils_1.colors.cyan(config.outputFormat)}`);
        console.log('');
        console.log(utils_1.colors.bold('Include Patterns:'));
        config.include.forEach(pattern => {
            console.log(`  ${utils_1.colors.green('+')} ${pattern}`);
        });
        console.log('');
        console.log(utils_1.colors.bold('Ignore Patterns:'));
        config.ignore.forEach(pattern => {
            console.log(`  ${utils_1.colors.red('-')} ${pattern}`);
        });
        console.log('');
        console.log(utils_1.colors.bold('Rules:'));
        if (Object.keys(config.rules).length === 0) {
            console.log(utils_1.colors.gray('  No custom rules defined'));
        }
        else {
            Object.entries(config.rules).forEach(([rule, level]) => {
                const levelColor = level === 'error' ? utils_1.colors.red : level === 'warn' ? utils_1.colors.yellow : utils_1.colors.blue;
                console.log(`  ${utils_1.colors.cyan(rule)}: ${levelColor(level)}`);
            });
        }
        console.log('');
        console.log(utils_1.colors.gray('Available commands:'));
        console.log(utils_1.colors.gray('  baseline config --edit        # Edit configuration file'));
        console.log(utils_1.colors.gray('  baseline config --set <key> <value>  # Set a value'));
        console.log(utils_1.colors.gray('  baseline config --get <key>   # Get a value'));
    }
    catch (error) {
        console.error(utils_1.colors.red(`Error reading configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}
// Set a configuration value
async function setConfigValue(configPath, key, value) {
    if (!fs.existsSync(configPath)) {
        console.log(utils_1.colors.red('❌ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // Parse the key path (e.g., "targets.baseline" or "strict")
        const keyParts = key.split('.');
        let current = config;
        // Navigate to the parent object
        for (let i = 0; i < keyParts.length - 1; i++) {
            if (!(keyParts[i] in current)) {
                current[keyParts[i]] = {};
            }
            current = current[keyParts[i]];
        }
        // Set the value with appropriate type conversion
        const finalKey = keyParts[keyParts.length - 1];
        let parsedValue = value;
        // Type conversion based on common config values
        if (value === 'true')
            parsedValue = true;
        else if (value === 'false')
            parsedValue = false;
        else if (/^\\d+$/.test(value))
            parsedValue = parseInt(value);
        else if (/^\\d*\\.\\d+$/.test(value))
            parsedValue = parseFloat(value);
        current[finalKey] = parsedValue;
        // Write back to file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(utils_1.colors.green(`✅ Updated ${utils_1.colors.cyan(key)} to ${utils_1.colors.bold(String(parsedValue))}`));
    }
    catch (error) {
        console.error(utils_1.colors.red(`Error setting configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}
// Get a configuration value
async function getConfigValue(configPath, key) {
    if (!fs.existsSync(configPath)) {
        console.log(utils_1.colors.red('❌ No configuration file found'));
        return;
    }
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // Parse the key path
        const keyParts = key.split('.');
        let current = config;
        // Navigate to the value
        for (const part of keyParts) {
            if (!(part in current)) {
                console.log(utils_1.colors.red(`❌ Key "${key}" not found in configuration`));
                return;
            }
            current = current[part];
        }
        console.log(`${utils_1.colors.cyan(key)}: ${utils_1.colors.bold(JSON.stringify(current, null, 2))}`);
    }
    catch (error) {
        console.error(utils_1.colors.red(`Error getting configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
    }
}
// Edit configuration in default editor
async function editConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        console.log(utils_1.colors.red('❌ No configuration file found'));
        console.log('Run "baseline init" to create one.');
        return;
    }
    const editor = process.env.EDITOR || 'code'; // Default to VS Code
    console.log(utils_1.colors.blue(`📝 Opening configuration in ${editor}...`));
    console.log(utils_1.colors.gray(`File: ${configPath}`));
    // Note: In a real implementation, you'd use child_process.spawn to open the editor
    // For now, just show the path
    console.log('');
    console.log(utils_1.colors.yellow('Manual edit required:'));
    console.log(utils_1.colors.gray(`Edit the file: ${configPath}`));
}
