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
exports.initCommand = void 0;
const utils_1 = require("../utils");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.initCommand = {
    name: 'init',
    description: 'Initialize baseline configuration',
    async execute(args) {
        console.log(utils_1.colors.bold('Initializing Baseline CLI Configuration'));
        console.log('');
        const configPath = path.join(process.cwd(), '.baseline.config.json');
        // Parse arguments for preset and force flag
        const { preset, force } = parseInitOptions(args);
        if (fs.existsSync(configPath) && !force) {
            console.log(utils_1.colors.yellow('⚠ Configuration file already exists at .baseline.config.json'));
            console.log('Use --force to overwrite or run "baseline config" to modify');
            return;
        }
        const config = createConfigFromPreset(preset);
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(utils_1.colors.green('✓ Configuration file created: .baseline.config.json'));
            console.log('');
            console.log(utils_1.colors.bold('Configuration Summary:'));
            console.log(`${utils_1.colors.blue('Preset:')} ${preset}`);
            console.log(`${utils_1.colors.blue('Strict mode:')} ${config.strict ? 'enabled' : 'disabled'}`);
            console.log(`${utils_1.colors.blue('Target baseline:')} ${config.targets.baseline}`);
            console.log(`${utils_1.colors.blue('Auto-fix:')} ${config.autofix ? 'enabled' : 'disabled'}`);
            console.log('');
            console.log(utils_1.colors.gray('You can now run:'));
            console.log(utils_1.colors.gray('  baseline check           # Check all files'));
            console.log(utils_1.colors.gray('  baseline check src/      # Check specific directory'));
            console.log(utils_1.colors.gray('  baseline config          # View/edit configuration'));
        }
        catch (error) {
            console.error(utils_1.colors.red(`Error creating configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    }
};
function parseInitOptions(args) {
    let preset = 'balanced';
    let force = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--preset' && i + 1 < args.length) {
            const presetValue = args[i + 1];
            if (['strict', 'balanced', 'legacy'].includes(presetValue)) {
                preset = presetValue;
            }
            i++; // Skip next argument
        }
        else if (arg === '--force') {
            force = true;
        }
    }
    return { preset, force };
}
function createConfigFromPreset(preset) {
    const baseConfig = {
        strict: false,
        targets: {
            baseline: 'high'
        },
        rules: {},
        ignore: [
            'node_modules/**',
            'dist/**',
            'build/**',
            '.git/**',
            '*.min.js',
            '*.min.css'
        ],
        include: [
            'src/**',
            'lib/**',
            'app/**',
            'components/**',
            'styles/**',
            '*.html',
            '*.css',
            '*.js',
            '*.ts'
        ],
        autofix: false,
        outputFormat: 'console'
    };
    switch (preset) {
        case 'strict':
            return {
                ...baseConfig,
                strict: true,
                targets: {
                    baseline: 'high'
                },
                rules: {
                    'css-grid': 'error',
                    'flexbox': 'error',
                    'async-functions': 'error',
                    'fetch': 'error',
                    'custom-elements': 'error',
                    'shadow-dom': 'error'
                },
                autofix: true
            };
        case 'legacy':
            return {
                ...baseConfig,
                strict: false,
                targets: {
                    baseline: 'low'
                },
                rules: {
                    'css-grid': 'warn',
                    'flexbox': 'warn',
                    'async-functions': 'warn',
                    'fetch': 'warn',
                    'custom-elements': 'warn',
                    'shadow-dom': 'off'
                },
                autofix: false
            };
        case 'balanced':
        default:
            return {
                ...baseConfig,
                strict: false,
                targets: {
                    baseline: 'high'
                },
                rules: {
                    'css-grid': 'warn',
                    'flexbox': 'off',
                    'async-functions': 'off',
                    'fetch': 'off',
                    'custom-elements': 'warn',
                    'shadow-dom': 'warn'
                },
                autofix: false
            };
    }
}
