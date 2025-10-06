import { Command, BaselineResult, CheckOptions, FeatureResult, ScanProgress, BaselineConfig } from '../types';
import { findFiles, colors, formatProgress, formatBaselineResult, loadConfig, getDefaultConfig, generateHTMLReport, generateTextReport } from '../utils';
import { parseFile } from '../utils/parsers';
import * as path from 'path';
import * as fs from 'fs';
import { minimatch } from 'minimatch';

export const checkCommand: Command = {
    name: 'check',
    description: 'Check files for Web Platform Baseline compatibility',
    
    async execute(args: string[]): Promise<void> {
        const options = parseCheckOptions(args);
        
        const config = loadConfig(options.configFile) || getDefaultConfig();
        
        if (options.strict !== undefined) {
            config.strict = options.strict;
        }
        if (options.format) {
            config.outputFormat = options.format;
        }
        
        const targetPath = options.path || process.cwd();
        
        console.log(colors.bold(`Baseline Compatibility Check`));
        console.log(colors.gray(`Scanning: ${targetPath}`));
        console.log('');
        
        try {
            const stats = fs.statSync(targetPath);
            let filesToCheck: string[];
            
            if (stats.isFile()) {
                filesToCheck = [targetPath];
            } else {
                const extensions = ['.css', '.scss', '.sass', '.less', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm'];
                const allFiles = findFiles(targetPath, extensions);
                
                filesToCheck = allFiles.filter(file => {
                    const relativePath = path.relative(process.cwd(), file);
                    
                    const shouldIgnore = config.ignore.some(pattern => 
                        minimatch(relativePath, pattern, { dot: true })
                    );
                    
                    if (shouldIgnore) {
                        return false;
                    }
                    
                    if (config.include.length > 0) {
                        const shouldInclude = config.include.some(pattern => 
                            minimatch(relativePath, pattern, { dot: true })
                        );
                        return shouldInclude;
                    }
                    
                    return true;
                });
            }
            
            if (filesToCheck.length === 0) {
                console.log(colors.yellow('⚠ No files found to check'));
                return;
            }
            
            console.log(colors.blue(`Found ${filesToCheck.length} file(s) to check`));
            console.log('');
            
            const results: BaselineResult[] = [];
            let totalErrors = 0;
            let totalWarnings = 0;
            
            for (let i = 0; i < filesToCheck.length; i++) {
                const file = filesToCheck[i];
                const relativePath = path.relative(process.cwd(), file);
                
                if (!options.quiet) {
                    const progress = formatProgress(i + 1, filesToCheck.length);
                    console.log(`${progress} ${colors.gray('Checking:')} ${relativePath}`);
                }
                
                let features = await parseFile(file);
                
                features = applyConfigRules(features, config);
                
                features = applyTargetBaseline(features, config.targets.baseline);
                
                const errors = features.filter(f => f.severity === 'error').length;
                const warnings = features.filter(f => f.severity === 'warn').length;
                
                totalErrors += errors;
                totalWarnings += warnings;
                
                const result: BaselineResult = {
                    file: relativePath,
                    features,
                    errors,
                    warnings,
                    passed: errors === 0 && (options.strict ? warnings === 0 : true)
                };
                
                results.push(result);
                
                if (options.verbose && features.length > 0) {
                    console.log(colors.gray(`  Features found in ${relativePath}:`));
                    features.forEach(feature => {
                        const icon = feature.severity === 'error' ? '✗' : feature.severity === 'warn' ? '⚠' : '✓';
                        const color = feature.severity === 'error' ? colors.red : feature.severity === 'warn' ? colors.yellow : colors.green;
                        console.log(`    ${color(icon)} ${feature.feature} (line ${feature.line}) - ${feature.message}`);
                    });
                    console.log('');
                }
            }
            
            console.log('');
            console.log(colors.bold('Results Summary'));
            console.log('='.repeat(50));
            
            console.log(`${colors.blue('Files checked:')} ${filesToCheck.length}`);
            console.log(`${colors.red('Errors:')} ${totalErrors}`);
            console.log(`${colors.yellow('Warnings:')} ${totalWarnings}`);
            
            const passedFiles = results.filter(r => r.passed).length;
            const failedFiles = results.length - passedFiles;
            
            console.log(`${colors.green('Passed:')} ${passedFiles}`);
            if (failedFiles > 0) {
                console.log(`${colors.red('Failed:')} ${failedFiles}`);
            }
            console.log('');
            
            const summary = {
                totalFiles: filesToCheck.length,
                totalErrors,
                totalWarnings,
                passedFiles,
                failedFiles
            };
            
            if (options.format === 'json') {
                const output = JSON.stringify(results, null, 2);
                const outputPath = path.join(process.cwd(), 'baseline-report.json');
                fs.writeFileSync(outputPath, output);
                console.log(colors.green(`✓ JSON report saved to: ${outputPath}`));
            } else if (options.format === 'html') {
                const htmlReport = generateHTMLReport(results, summary);
                const outputPath = path.join(process.cwd(), 'baseline-report.html');
                fs.writeFileSync(outputPath, htmlReport);
                console.log(colors.green(`✓ HTML report saved to: ${outputPath}`));
                console.log(colors.gray(`   Open in browser: file://${outputPath}`));
            } else if (options.format === 'text') {
                const textReport = generateTextReport(results, summary);
                const outputPath = path.join(process.cwd(), 'baseline-report.txt');
                fs.writeFileSync(outputPath, textReport);
                console.log(colors.green(`✓ Text report saved to: ${outputPath}`));
            } else {
                const filesWithIssues = results.filter(r => r.features.length > 0);
                
                if (filesWithIssues.length > 0) {
                    console.log(colors.bold('Detailed Results'));
                    console.log('');
                    
                    filesWithIssues.forEach(result => {
                        const statusIcon = result.passed ? colors.green('✓') : colors.red('✗');
                        console.log(`${statusIcon} ${colors.bold(result.file)}`);
                        
                        const errorFeatures = result.features.filter(f => f.severity === 'error');
                        const warnFeatures = result.features.filter(f => f.severity === 'warn');
                        const infoFeatures = result.features.filter(f => f.severity === 'info');
                        
                        if (errorFeatures.length > 0) {
                            console.log(colors.red('  Errors:'));
                            errorFeatures.forEach(feature => {
                                console.log(`    ✗ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        
                        if (warnFeatures.length > 0) {
                            console.log(colors.yellow('  Warnings:'));
                            warnFeatures.forEach(feature => {
                                console.log(`    ⚠ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        
                        if (infoFeatures.length > 0 && options.verbose) {
                            console.log(colors.blue('  Info:'));
                            infoFeatures.forEach(feature => {
                                console.log(`    ✓ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        
                        console.log('');
                    });
                }
            }
            
            const hasErrors = totalErrors > 0;
            const hasWarningsInStrict = options.strict && totalWarnings > 0;
            
            if (hasErrors || hasWarningsInStrict) {
                console.log(colors.red('✗ Baseline compatibility check failed'));
                process.exit(1);
            } else {
                console.log(colors.green('✓ All files passed baseline compatibility check'));
            }
            
        } catch (error) {
            console.error(colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    }
};

// Apply config rules to override feature severity
function applyConfigRules(features: FeatureResult[], config: BaselineConfig): FeatureResult[] {
    return features.map(feature => {
        const rule = config.rules[feature.feature];
        
        if (rule === 'off') {
            return null;
        }
        
        if (rule) {
            return {
                ...feature,
                severity: rule
            };
        }
        
        return feature;
    }).filter((f): f is FeatureResult => f !== null);
}

// Apply target baseline filter
function applyTargetBaseline(features: FeatureResult[], targetBaseline: 'high' | 'low'): FeatureResult[] {
    if (targetBaseline === 'low') {
        return features.map(feature => {
            if (feature.status === 'low' && feature.severity === 'warn') {
                return {
                    ...feature,
                    severity: 'info'
                };
            }
            return feature;
        });
    }
    
    return features;
}

// Parse command line options for check command
function parseCheckOptions(args: string[]): CheckOptions {
    const options: CheckOptions = {
        path: undefined,
        strict: false,
        format: 'console',
        quiet: false,
        verbose: false
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--strict':
                options.strict = true;
                break;
            case '--format':
                if (i + 1 < args.length) {
                    const format = args[i + 1];
                    if (format === 'json' || format === 'html' || format === 'text' || format === 'console') {
                        options.format = format as 'console' | 'json' | 'html' | 'text';
                        i++; // Skip the format value in the next iteration
                    }
                }
                break;
            case '--quiet':
                options.quiet = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            default:
                if (!arg.startsWith('--') && !options.path) {
                    options.path = arg;
                }
                break;
        }
    }
    
    return options;
}