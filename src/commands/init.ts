import { Command, BaselineConfig } from '../types';
import { colors } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

export const initCommand: Command = {
    name: 'init',
    description: 'Initialize baseline configuration',
    
    async execute(args: string[]): Promise<void> {
        console.log(colors.bold('Initializing Baseline CLI Configuration'));
        console.log('');
        
        const configPath = path.join(process.cwd(), '.baseline.config.json');
        
        // Parse arguments for preset and force flag
        const { preset, force } = parseInitOptions(args);
        
        if (fs.existsSync(configPath) && !force) {
            console.log(colors.yellow('⚠ Configuration file already exists at .baseline.config.json'));
            console.log('Use --force to overwrite or run "baseline config" to modify');
            return;
        }
        
        const config = createConfigFromPreset(preset);
        
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            console.log(colors.green('✓ Configuration file created: .baseline.config.json'));
            console.log('');
            console.log(colors.bold('Configuration Summary:'));
            console.log(`${colors.blue('Preset:')} ${preset}`);
            console.log(`${colors.blue('Strict mode:')} ${config.strict ? 'enabled' : 'disabled'}`);
            console.log(`${colors.blue('Target baseline:')} ${config.targets.baseline}`);
            console.log(`${colors.blue('Auto-fix:')} ${config.autofix ? 'enabled' : 'disabled'}`);
            console.log('');
            console.log(colors.gray('You can now run:'));
            console.log(colors.gray('  baseline check           # Check all files'));
            console.log(colors.gray('  baseline check src/      # Check specific directory'));
            console.log(colors.gray('  baseline config          # View/edit configuration'));
            
        } catch (error) {
            console.error(colors.red(`Error creating configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    }
};

function parseInitOptions(args: string[]): { preset: string; force: boolean } {
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
        } else if (arg === '--force') {
            force = true;
        }
    }
    
    return { preset, force };
}

function createConfigFromPreset(preset: string): BaselineConfig {
    const baseConfig: BaselineConfig = {
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