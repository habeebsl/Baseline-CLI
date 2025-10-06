import { Command, FeatureResult } from '../types';
import { colors, loadConfig } from '../utils';
import { createLanguageServerParser } from '../utils/language-server';
import { createAIService } from '../utils/ai-service';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createPatch } from 'diff';

export const fixCommand: Command = {
    name: 'fix',
    description: 'Fix baseline compatibility issues in CSS files using AI',
    
    async execute(args: string[]): Promise<void> {
        if (args.length === 0) {
            console.log(colors.yellow('Usage: baseline fix <file> [options]'));
            console.log('');
            console.log('Options:');
            console.log('  --lines <start-end>         Fix only specific lines (e.g., --lines 30-60)');
            console.log('  --config <path>             Path to config file');
            console.log('  --provider <openai|anthropic>  AI provider to use');
            console.log('  --api-key <key>             API key (overrides config and env)');
            console.log('');
            console.log('Examples:');
            console.log('  baseline fix src/styles.css');
            console.log('  baseline fix src/styles.css --lines 30-60');
            console.log('  baseline fix src/styles.css --provider anthropic');
            console.log('');
            console.log(colors.gray('Note: Requires OpenAI or Anthropic API key via:'));
            console.log(colors.gray('  1. Config file (.baseline.config.json)'));
            console.log(colors.gray('  2. Environment variable (OPENAI_API_KEY or ANTHROPIC_API_KEY)'));
            console.log(colors.gray('  3. Command line flag (--api-key)'));
            return;
        }

        const options = parseFixOptions(args);
        const filePath = path.resolve(options.file);
        
        const config = loadConfig(options.configPath);

        if (!fs.existsSync(filePath)) {
            console.error(colors.red(`Error: File not found: ${filePath}`));
            process.exit(1);
        }

        if (!filePath.endsWith('.css')) {
            console.error(colors.red('Error: Only CSS files are supported for AI fixes'));
            process.exit(1);
        }

        console.log(colors.bold(`Analyzing ${path.basename(filePath)}...`));
        console.log('');

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            let contentToAnalyze = content;
            let lineOffset = 0;

            if (options.lineRange) {
                const [start, end] = options.lineRange;
                if (start < 1 || end > lines.length || start > end) {
                    console.error(colors.red(`Error: Invalid line range. File has ${lines.length} lines.`));
                    process.exit(1);
                }
                
                contentToAnalyze = lines.slice(start - 1, end).join('\n');
                lineOffset = start - 1;
                console.log(colors.gray(`Analyzing lines ${start}-${end} of ${lines.length}`));
                console.log('');
            }

            const parser = createLanguageServerParser();
            const parseResult = await parser.parseCSS(contentToAnalyze, filePath);
            
            if (parseResult.features.length === 0) {
                console.log(colors.green('✓ No baseline compatibility issues found!'));
                return;
            }

            const issues = parseResult.features.map((f: any) => ({
                line: f.line + lineOffset,
                feature: f.name,
                message: f.context
            }));

            console.log(colors.yellow(`Found ${issues.length} baseline issue(s). Generating fixes with AI...`));
            console.log('');

            const provider = options.provider || config?.ai?.defaultProvider || 'openai';
            
            let apiKey = options.apiKey;
            if (!apiKey && config?.ai?.providers) {
                const providerConfig = config.ai.providers[provider];
                apiKey = providerConfig?.apiKey;
            }
            if (!apiKey) {
                apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
            }
            
            const aiService = createAIService(apiKey, provider);
            const fixResponse = await aiService.fixCSS({
                cssContent: contentToAnalyze,
                issues: issues.map((i: any) => ({ ...i, line: i.line - lineOffset }))
            });

            let fixedContent = content;
            if (options.lineRange) {
                const [start, end] = options.lineRange;
                const before = lines.slice(0, start - 1).join('\n');
                const after = lines.slice(end).join('\n');
                fixedContent = before + '\n' + fixResponse.fixedCSS + '\n' + after;
            } else {
                fixedContent = fixResponse.fixedCSS;
            }

            displayDiff(content, fixedContent, filePath, fixResponse);

            const approved = await promptUser('\nApply these changes? (y/n): ');

            if (approved) {
                const backupPath = `${filePath}.bak`;
                fs.writeFileSync(backupPath, content);
                fs.writeFileSync(filePath, fixedContent);
                
                console.log('');
                console.log(colors.green('✓ Changes applied successfully!'));
                console.log(colors.gray(`  Backup saved: ${path.basename(backupPath)}`));
            } else {
                console.log('');
                console.log(colors.yellow('✗ Changes not applied'));
            }

        } catch (error) {
            if (error instanceof Error && error.message.includes('API key')) {
                console.error(colors.red('Error: AI API key not configured'));
                console.error('');
                console.error(colors.yellow('The fix command uses AI to generate CSS fixes.'));
                console.error('');
                console.error(colors.bold('Configure your API key in one of these ways:'));
                console.error('');
                console.error(colors.cyan('1. In your .baseline.config.json:'));
                console.error('   {');
                console.error('     "ai": {');
                console.error('       "defaultProvider": "openai",');
                console.error('       "providers": {');
                console.error('         "openai": { "apiKey": "sk-..." },');
                console.error('         "anthropic": { "apiKey": "sk-ant-..." }');
                console.error('       }');
                console.error('     }');
                console.error('   }');
                console.error('');
                console.error(colors.cyan('2. As an environment variable:'));
                console.error('   export OPENAI_API_KEY=sk-your-key-here');
                console.error('   # or');
                console.error('   export ANTHROPIC_API_KEY=sk-ant-your-key-here');
                console.error('');
                console.error(colors.cyan('3. Via command line flag:'));
                console.error('   baseline fix file.css --api-key sk-your-key-here');
                console.error('');
                console.error(colors.gray('Get API keys from:'));
                console.error(colors.gray('  OpenAI: https://platform.openai.com/api-keys'));
                console.error(colors.gray('  Anthropic: https://console.anthropic.com/'));
            } else {
                console.error(colors.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            }
            process.exit(1);
        }
    }
};

interface FixOptions {
    file: string;
    lineRange?: [number, number];
    apiKey?: string;
    provider: 'openai' | 'anthropic';
    configPath?: string;
}

function parseFixOptions(args: string[]): FixOptions {
    const options: FixOptions = {
        file: args[0],
        provider: 'openai'
    };

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--lines' && i + 1 < args.length) {
            const rangeStr = args[i + 1];
            const match = rangeStr.match(/^(\d+)-(\d+)$/);
            if (match) {
                options.lineRange = [parseInt(match[1]), parseInt(match[2])];
            }
            i++;
        } else if (arg === '--provider' && i + 1 < args.length) {
            const provider = args[i + 1];
            if (provider === 'openai' || provider === 'anthropic') {
                options.provider = provider;
            }
            i++;
        } else if (arg === '--api-key' && i + 1 < args.length) {
            options.apiKey = args[i + 1];
            i++;
        } else if (arg === '--config' && i + 1 < args.length) {
            options.configPath = args[i + 1];
            i++;
        }
    }

    return options;
}

function displayDiff(original: string, fixed: string, filePath: string, response: any) {
    console.log(colors.bold('━'.repeat(70)));
    console.log(colors.bold(' Proposed Changes'));
    console.log(colors.bold('━'.repeat(70)));
    console.log('');

    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');

    if (response.changes && response.changes.length > 0) {
        response.changes.forEach((change: any, index: number) => {
            console.log(colors.bold(`Change ${index + 1}: Line ${change.line}`));
            console.log(colors.red(`  - ${change.old}`));
            console.log(colors.green(`  + ${change.new}`));
            if (change.reason) {
                console.log(colors.gray(`    ${change.reason}`));
            }
            console.log('');
        });
    } else {
        let changeCount = 0;
        for (let i = 0; i < Math.max(originalLines.length, fixedLines.length); i++) {
            if (originalLines[i] !== fixedLines[i]) {
                changeCount++;
                console.log(colors.bold(`Line ${i + 1}:`));
                if (originalLines[i]) {
                    console.log(colors.red(`  - ${originalLines[i]}`));
                }
                if (fixedLines[i]) {
                    console.log(colors.green(`  + ${fixedLines[i]}`));
                }
                console.log('');
                
                if (changeCount >= 10) {
                    const remaining = Math.max(originalLines.length, fixedLines.length) - i - 1;
                    if (remaining > 0) {
                        console.log(colors.gray(`  ... and ${remaining} more changes`));
                        console.log('');
                    }
                    break;
                }
            }
        }
    }

    console.log(colors.bold('━'.repeat(70)));
    console.log(colors.bold(` Summary: ${response.changes?.length || 0} change(s) proposed`));
    console.log(colors.bold('━'.repeat(70)));
    console.log('');

    if (response.summary && response.summary.length > 0) {
        response.summary.forEach((point: string) => {
            console.log(colors.green(`✓ ${point}`));
        });
    }
}

function promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
    });
}
