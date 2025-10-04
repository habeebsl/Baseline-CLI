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
exports.checkCommand = void 0;
const utils_1 = require("../utils");
const parsers_1 = require("../utils/parsers");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
exports.checkCommand = {
    name: 'check',
    description: 'Check files for Web Platform Baseline compatibility',
    async execute(args) {
        const options = parseCheckOptions(args);
        const targetPath = options.path || process.cwd();
        console.log(utils_1.colors.bold(`🔍 Baseline Compatibility Check`));
        console.log(utils_1.colors.gray(`Scanning: ${targetPath}`));
        console.log('');
        try {
            // Determine if we're checking a file or directory
            const stats = fs.statSync(targetPath);
            let filesToCheck;
            if (stats.isFile()) {
                filesToCheck = [targetPath];
            }
            else {
                // Find all relevant files
                const extensions = ['.css', '.scss', '.sass', '.less', '.js', '.ts', '.jsx', '.tsx', '.html', '.htm'];
                filesToCheck = (0, utils_1.findFiles)(targetPath, extensions);
            }
            if (filesToCheck.length === 0) {
                console.log(utils_1.colors.yellow('⚠ No files found to check'));
                return;
            }
            console.log(utils_1.colors.blue(`📁 Found ${filesToCheck.length} file(s) to check`));
            console.log('');
            // Process files
            const results = [];
            let totalErrors = 0;
            let totalWarnings = 0;
            for (let i = 0; i < filesToCheck.length; i++) {
                const file = filesToCheck[i];
                const relativePath = path.relative(process.cwd(), file);
                // Show progress
                if (!options.quiet) {
                    const progress = (0, utils_1.formatProgress)(i + 1, filesToCheck.length);
                    console.log(`${progress} ${utils_1.colors.gray('Checking:')} ${relativePath}`);
                }
                // Parse the file
                const features = (0, parsers_1.parseFile)(file);
                const errors = features.filter(f => f.severity === 'error').length;
                const warnings = features.filter(f => f.severity === 'warn').length;
                totalErrors += errors;
                totalWarnings += warnings;
                const result = {
                    file: relativePath,
                    features,
                    errors,
                    warnings,
                    passed: errors === 0 && (options.strict ? warnings === 0 : true)
                };
                results.push(result);
                // Show immediate results if verbose
                if (options.verbose && features.length > 0) {
                    console.log(utils_1.colors.gray(`  Features found in ${relativePath}:`));
                    features.forEach(feature => {
                        const icon = feature.severity === 'error' ? '✗' : feature.severity === 'warn' ? '⚠' : '✓';
                        const color = feature.severity === 'error' ? utils_1.colors.red : feature.severity === 'warn' ? utils_1.colors.yellow : utils_1.colors.green;
                        console.log(`    ${color(icon)} ${feature.feature} (line ${feature.line}) - ${feature.message}`);
                    });
                    console.log('');
                }
            }
            console.log('');
            console.log(utils_1.colors.bold('📊 Results Summary'));
            console.log('='.repeat(50));
            // Summary statistics
            console.log(`${utils_1.colors.blue('Files checked:')} ${filesToCheck.length}`);
            console.log(`${utils_1.colors.red('Errors:')} ${totalErrors}`);
            console.log(`${utils_1.colors.yellow('Warnings:')} ${totalWarnings}`);
            const passedFiles = results.filter(r => r.passed).length;
            const failedFiles = results.length - passedFiles;
            console.log(`${utils_1.colors.green('Passed:')} ${passedFiles}`);
            if (failedFiles > 0) {
                console.log(`${utils_1.colors.red('Failed:')} ${failedFiles}`);
            }
            console.log('');
            // Detailed results
            if (options.format === 'json') {
                console.log(JSON.stringify(results, null, 2));
            }
            else {
                // Show files with issues
                const filesWithIssues = results.filter(r => r.features.length > 0);
                if (filesWithIssues.length > 0) {
                    console.log(utils_1.colors.bold('📋 Detailed Results'));
                    console.log('');
                    filesWithIssues.forEach(result => {
                        const statusIcon = result.passed ? utils_1.colors.green('✓') : utils_1.colors.red('✗');
                        console.log(`${statusIcon} ${utils_1.colors.bold(result.file)}`);
                        // Group features by severity
                        const errorFeatures = result.features.filter(f => f.severity === 'error');
                        const warnFeatures = result.features.filter(f => f.severity === 'warn');
                        const infoFeatures = result.features.filter(f => f.severity === 'info');
                        if (errorFeatures.length > 0) {
                            console.log(utils_1.colors.red('  Errors:'));
                            errorFeatures.forEach(feature => {
                                console.log(`    ✗ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        if (warnFeatures.length > 0) {
                            console.log(utils_1.colors.yellow('  Warnings:'));
                            warnFeatures.forEach(feature => {
                                console.log(`    ⚠ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        if (infoFeatures.length > 0 && options.verbose) {
                            console.log(utils_1.colors.blue('  Info:'));
                            infoFeatures.forEach(feature => {
                                console.log(`    ✓ ${feature.feature} (line ${feature.line}): ${feature.message}`);
                            });
                        }
                        console.log('');
                    });
                }
            }
            // Exit with appropriate code
            const hasErrors = totalErrors > 0;
            const hasWarningsInStrict = options.strict && totalWarnings > 0;
            if (hasErrors || hasWarningsInStrict) {
                console.log(utils_1.colors.red('❌ Baseline compatibility check failed'));
                process.exit(1);
            }
            else {
                console.log(utils_1.colors.green('✅ All files passed baseline compatibility check'));
            }
        }
        catch (error) {
            console.error(utils_1.colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    }
};
// Parse command line options for check command
function parseCheckOptions(args) {
    const options = {
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
                    if (format === 'json' || format === 'html' || format === 'console') {
                        options.format = format;
                        i++; // Skip next argument as it's the format value
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
                // If it doesn't start with --, it's probably a path
                if (!arg.startsWith('--') && !options.path) {
                    options.path = arg;
                }
                break;
        }
    }
    return options;
}
