import { features } from 'web-features';
import { BaselineStatus, FeatureResult, BaselineConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export const loadConfig = (configPath?: string): BaselineConfig | null => {
    const defaultConfigPaths = [
        path.join(process.cwd(), '.baseline.config.json'),
        path.join(process.cwd(), 'baseline.config.json')
    ];
    
    const pathsToCheck = configPath ? [configPath, ...defaultConfigPaths] : defaultConfigPaths;
    
    for (const configFile of pathsToCheck) {
        if (fs.existsSync(configFile)) {
            try {
                const content = fs.readFileSync(configFile, 'utf-8');
                const config: BaselineConfig = JSON.parse(content);
                return config;
            } catch (error) {
                console.warn(colors.yellow(`⚠️  Warning: Could not parse config file ${configFile}`));
            }
        }
    }
    
    return null;
};

export const getDefaultConfig = (): BaselineConfig => {
    return {
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
            '**/*.html',
            '**/*.css',
            '**/*.js',
            '**/*.ts',
            '**/*.jsx',
            '**/*.tsx'
        ],
        autofix: false,
        outputFormat: 'console'
    };
};

export const colors = {
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

export const formatBaselineResult = (feature: string, status: BaselineStatus): string => {
    const statusText = status === 'high' ? colors.green('✓ Baseline') 
                      : status === 'low' ? colors.yellow('⚠ New Baseline') 
                      : colors.red('✗ Not Baseline');
    return `${colors.bold(feature)}: ${statusText}`;
};



let compatFeaturesIndex: Map<string, { status: BaselineStatus; featureName: string; featureId: string }> | null = null;

export const getCompatFeaturesIndex = (): Map<string, { status: BaselineStatus; featureName: string; featureId: string }> => {
    if (compatFeaturesIndex) {
        return compatFeaturesIndex;
    }
    
    compatFeaturesIndex = new Map();
    
    Object.entries(features).forEach(([featureId, feature]) => {
        if (feature && typeof feature === 'object' && 'status' in feature) {
            const featureData = feature as any;
            const status = featureData.status?.baseline as BaselineStatus;
            const featureName = featureData.name || featureId;
            
            if (status) {
                // Map the main feature ID
                compatFeaturesIndex!.set(featureId, { status, featureName, featureId });
                
                // Map all compat_features
                if ('compat_features' in featureData && Array.isArray(featureData.compat_features)) {
                    featureData.compat_features.forEach((compatFeature: string) => {
                        compatFeaturesIndex!.set(compatFeature, { status, featureName, featureId });
                    });
                }
            }
        }
    });
    
    return compatFeaturesIndex;
};

export const logExampleJSFeatures = () => {
    console.log('\n🔍 Example JavaScript Features from web-features package:\n');
    
    // Look for some common JS features
    const exampleFeatures = ['async-await', 'fetch', 'intersection-observer', 'promise'];
    
    exampleFeatures.forEach(featureId => {
        const feature = features[featureId];
        if (feature && typeof feature === 'object') {
            const featureData = feature as any; // Cast to access properties
            console.log(`Feature ID: ${featureId}`);
            console.log(`Name: ${featureData.name || 'N/A'}`);
            console.log(`Baseline Status: ${featureData.status?.baseline || 'N/A'}`);
            console.log(`Compat Features:`, featureData.compat_features?.slice(0, 5) || 'None'); // Show first 5
            console.log('---');
        }
    });
    
    // Show some actual compat_features mappings
    console.log('\n📋 Sample compat_features mappings:');
    const index = getCompatFeaturesIndex();
    const jsCompatFeatures = Array.from(index.keys()).filter(key => key.startsWith('api.') || key.startsWith('javascript.')).slice(0, 10);
    
    jsCompatFeatures.forEach(compatFeature => {
        const data = index.get(compatFeature);
        console.log(`${compatFeature} → ${data?.featureName} (${data?.status})`);
    });
};

export const analyzeAllPatterns = () => {
    console.log('\n🔍 Analyzing ALL possible compat_features patterns...\n');
    
    const index = getCompatFeaturesIndex();
    const allPatterns = Array.from(index.keys());
    
    // Group patterns by their prefix
    const patternGroups: { [key: string]: string[] } = {};
    
    allPatterns.forEach(pattern => {
        const parts = pattern.split('.');
        if (parts.length >= 2) {
            const prefix = `${parts[0]}.${parts[1]}`;
            if (!patternGroups[prefix]) {
                patternGroups[prefix] = [];
            }
            patternGroups[prefix].push(pattern);
        }
    });
    
    // Show statistics for each group
    Object.entries(patternGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([prefix, patterns]) => {
            console.log(`${prefix}* - ${patterns.length} patterns`);
            // Show a few examples
            const examples = patterns.slice(0, 3);
            examples.forEach(example => console.log(`  └─ ${example}`));
            if (patterns.length > 3) {
                console.log(`  └─ ... and ${patterns.length - 3} more`);
            }
            console.log('');
        });
    
    return patternGroups;
};

export const findAllMatchingPatterns = (searchTerm: string): Array<{ pattern: string; data: any }> => {
    const index = getCompatFeaturesIndex();
    const matches: Array<{ pattern: string; data: any }> = [];
    
    // Convert search term to lowercase for case-insensitive matching
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Search through all patterns
    for (const [pattern, data] of index.entries()) {
        if (pattern.toLowerCase().includes(lowerSearchTerm)) {
            matches.push({ pattern, data });
        }
    }
    
    return matches.sort((a, b) => a.pattern.localeCompare(b.pattern));
};

export const CSS_PATTERN_TEMPLATES = [
    'css.properties.${property}',
    'css.properties.${property}.${value}',
    'css.properties.display.${value}', // For display: grid, flex, etc.
    'css.at-rules.${property}',
    'css.at-rules.${property}.${value}', // Nested at-rule features
    'css.selectors.${property}',
    'css.selectors.${property}.${value}', // Nested selector features
    'css.types.${property}',
    'css.types.${property}.${value}', // Nested type features
];

export const JS_PATTERN_TEMPLATES = [
    // API patterns
    'api.${apiName}',
    'api.${apiName}.${apiName}', // Constructor pattern
    
    // JavaScript builtins
    'javascript.builtins.${apiName}',
    'javascript.builtins.${apiName}.${apiName}', // Constructor
    
    // JavaScript language features
    'javascript.statements.${apiName}',
    'javascript.operators.${apiName}',
    'javascript.functions.${apiName}',
    'javascript.classes.${apiName}',
    'javascript.grammar.${apiName}', // Grammar features (template literals, etc.)
    
    // Global objects
    'javascript.builtins.globalThis.${apiName}',
    
    // Web APIs (alternative patterns)
    'webapi.${apiName}',
];

export const HTML_PATTERN_TEMPLATES = [
    'html.elements.${elementName}',
    'html.elements.${elementName}.${attribute}',
    'html.global_attributes.${attribute}',
];

export const generatePatterns = (templates: string[], replacements: Record<string, string>): string[] => {
    return templates.map(template => {
        let pattern = template;
        Object.entries(replacements).forEach(([key, value]) => {
            pattern = pattern.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
        });
        return pattern;
    }).filter(pattern => !pattern.includes('${') && !pattern.includes('undefined'));
};

export const findCSSFeature = (property: string, value?: string): { status: BaselineStatus; featureName: string; compatFeature: string } | null => {
    const index = getCompatFeaturesIndex();
    
    // Generate patterns using the exportable templates
    const patterns = generatePatterns(CSS_PATTERN_TEMPLATES, { property, value: value || '' });
    
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    
    return null;
};

export const findJSFeature = (apiName: string): { status: BaselineStatus; featureName: string; compatFeature: string } | null => {
    const index = getCompatFeaturesIndex();
    
    // Generate patterns using the exportable templates
    const patterns = generatePatterns(JS_PATTERN_TEMPLATES, { apiName });
    
    // First try exact matches
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    
    // If no exact match, try fuzzy matching (contains the API name)
    const allMatches = findAllMatchingPatterns(apiName);
    const relevantMatch = allMatches.find(match => 
        match.pattern.startsWith('api.') || 
        match.pattern.startsWith('javascript.')
    );
    
    if (relevantMatch) {
        return { ...relevantMatch.data, compatFeature: relevantMatch.pattern };
    }
    
    return null;
};

export const findHTMLFeature = (elementName: string, attribute?: string): { status: BaselineStatus; featureName: string; compatFeature: string } | null => {
    const index = getCompatFeaturesIndex();
    
    // Generate patterns using the exportable templates
    const patterns = generatePatterns(HTML_PATTERN_TEMPLATES, { 
        elementName, 
        attribute: attribute || '' 
    });
    
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    
    return null;
};

export const checkBaselineStatus = (featureIdOrCompat: string): BaselineStatus => {
    const index = getCompatFeaturesIndex();
    const match = index.get(featureIdOrCompat);
    return match ? match.status : false;
};

export const findFiles = (dir: string, extensions: string[]): string[] => {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
        return files;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...findFiles(fullPath, extensions));
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
                files.push(fullPath);
            }
        }
    }
    
    return files;
};

export const formatProgress = (current: number, total: number): string => {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
    return `[${bar}] ${percentage}% (${current}/${total})`;
};

import { BaselineResult } from '../types';

export const generateHTMLReport = (results: BaselineResult[], summary: {
    totalFiles: number;
    totalErrors: number;
    totalWarnings: number;
    passedFiles: number;
    failedFiles: number;
}): string => {
    const timestamp = new Date().toLocaleString();
    const statusColor = summary.totalErrors > 0 ? '#dc2626' : summary.totalWarnings > 0 ? '#f59e0b' : '#16a34a';
    const statusText = summary.totalErrors > 0 ? 'Failed' : summary.totalWarnings > 0 ? 'Warning' : 'Passed';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baseline Compatibility Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: #f8fafc;
            padding: 2rem;
            color: #1e293b;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: #0f172a;
        }
        .timestamp {
            color: #64748b;
            font-size: 0.875rem;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border-left: 4px solid;
        }
        .stat.status { border-color: ${statusColor}; }
        .stat.errors { border-color: #dc2626; }
        .stat.warnings { border-color: #f59e0b; }
        .stat.passed { border-color: #16a34a; }
        .stat.files { border-color: #3b82f6; }
        .stat-label {
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 0.25rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: #0f172a;
        }
        .file-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .file-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #f1f5f9;
        }
        .file-status {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            flex-shrink: 0;
        }
        .file-status.pass { background: #dcfce7; }
        .file-status.fail { background: #fee2e2; }
        .file-name {
            font-weight: 600;
            font-size: 1.125rem;
            color: #0f172a;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .features-section {
            margin-top: 1rem;
        }
        .section-title {
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.75rem;
            margin-top: 1rem;
        }
        .section-title.errors { color: #dc2626; }
        .section-title.warnings { color: #f59e0b; }
        .section-title.info { color: #3b82f6; }
        .feature-item {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-radius: 6px;
            font-size: 0.875rem;
            display: flex;
            gap: 0.75rem;
            align-items: flex-start;
        }
        .feature-item.error {
            background: #fef2f2;
            border-left: 3px solid #dc2626;
        }
        .feature-item.warn {
            background: #fffbeb;
            border-left: 3px solid #f59e0b;
        }
        .feature-item.info {
            background: #eff6ff;
            border-left: 3px solid #3b82f6;
        }
        .feature-icon {
            font-size: 1rem;
            flex-shrink: 0;
        }
        .feature-content {
            flex: 1;
        }
        .feature-name {
            font-weight: 600;
            font-family: 'Monaco', 'Courier New', monospace;
            margin-bottom: 0.25rem;
        }
        .feature-location {
            color: #64748b;
            font-size: 0.8125rem;
        }
        .feature-message {
            color: #475569;
            margin-top: 0.25rem;
        }
        .no-issues {
            text-align: center;
            padding: 3rem;
            color: #64748b;
        }
        .footer {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Baseline Compatibility Report</h1>
            <div class="timestamp">Generated on ${timestamp}</div>
        </div>

        <div class="summary">
            <div class="stat status">
                <div class="stat-label">Status</div>
                <div class="stat-value" style="color: ${statusColor}">${statusText}</div>
            </div>
            <div class="stat files">
                <div class="stat-label">Files Checked</div>
                <div class="stat-value">${summary.totalFiles}</div>
            </div>
            <div class="stat errors">
                <div class="stat-label">Errors</div>
                <div class="stat-value">${summary.totalErrors}</div>
            </div>
            <div class="stat warnings">
                <div class="stat-label">Warnings</div>
                <div class="stat-value">${summary.totalWarnings}</div>
            </div>
            <div class="stat passed">
                <div class="stat-label">Passed</div>
                <div class="stat-value">${summary.passedFiles}</div>
            </div>
        </div>

        ${results.filter(r => r.features.length > 0).length > 0 ? results.filter(r => r.features.length > 0).map(result => {
            const errorFeatures = result.features.filter(f => f.severity === 'error');
            const warnFeatures = result.features.filter(f => f.severity === 'warn');
            const infoFeatures = result.features.filter(f => f.severity === 'info');
            
            return `
        <div class="file-card">
            <div class="file-header">
                <div class="file-status ${result.passed ? 'pass' : 'fail'}">
                    ${result.passed ? '✓' : '✗'}
                </div>
                <div class="file-name">${result.file}</div>
            </div>

            ${errorFeatures.length > 0 ? `
            <div class="features-section">
                <div class="section-title errors">Errors (${errorFeatures.length})</div>
                ${errorFeatures.map(f => `
                <div class="feature-item error">
                    <span class="feature-icon">✗</span>
                    <div class="feature-content">
                        <div class="feature-name">${f.feature}</div>
                        <div class="feature-location">Line ${f.line || 'N/A'}</div>
                        <div class="feature-message">${f.message}</div>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}

            ${warnFeatures.length > 0 ? `
            <div class="features-section">
                <div class="section-title warnings">Warnings (${warnFeatures.length})</div>
                ${warnFeatures.map(f => `
                <div class="feature-item warn">
                    <span class="feature-icon">⚠</span>
                    <div class="feature-content">
                        <div class="feature-name">${f.feature}</div>
                        <div class="feature-location">Line ${f.line || 'N/A'}</div>
                        <div class="feature-message">${f.message}</div>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}

            ${infoFeatures.length > 0 ? `
            <div class="features-section">
                <div class="section-title info">Info (${infoFeatures.length})</div>
                ${infoFeatures.map(f => `
                <div class="feature-item info">
                    <span class="feature-icon">ℹ</span>
                    <div class="feature-content">
                        <div class="feature-name">${f.feature}</div>
                        <div class="feature-location">Line ${f.line || 'N/A'}</div>
                        <div class="feature-message">${f.message}</div>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
            `;
        }).join('') : `
        <div class="no-issues">
            <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
            <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">All Clear!</div>
            <div>No baseline compatibility issues found.</div>
        </div>
        `}

        <div class="footer">
            Generated by Baseline CLI &middot; Web Platform Baseline Compatibility Checker
        </div>
    </div>
</body>
</html>`;
};

export const generateTextReport = (results: BaselineResult[], summary: {
    totalFiles: number;
    totalErrors: number;
    totalWarnings: number;
    passedFiles: number;
    failedFiles: number;
}): string => {
    const timestamp = new Date().toLocaleString();
    const lines: string[] = [];
    
    // Header
    lines.push('='.repeat(70));
    lines.push('BASELINE COMPATIBILITY REPORT');
    lines.push('='.repeat(70));
    lines.push(`Generated: ${timestamp}`);
    lines.push('');
    
    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(70));
    lines.push(`Status:         ${summary.totalErrors > 0 ? 'FAILED' : summary.totalWarnings > 0 ? 'WARNING' : 'PASSED'}`);
    lines.push(`Files Checked:  ${summary.totalFiles}`);
    lines.push(`Errors:         ${summary.totalErrors}`);
    lines.push(`Warnings:       ${summary.totalWarnings}`);
    lines.push(`Passed:         ${summary.passedFiles}`);
    lines.push(`Failed:         ${summary.failedFiles}`);
    lines.push('');
    
    // Detailed results
    const filesWithIssues = results.filter(r => r.features.length > 0);
    
    if (filesWithIssues.length > 0) {
        lines.push('DETAILED RESULTS');
        lines.push('='.repeat(70));
        lines.push('');
        
        filesWithIssues.forEach(result => {
            const statusSymbol = result.passed ? '✓' : '✗';
            lines.push(`${statusSymbol} ${result.file}`);
            lines.push('-'.repeat(70));
            
            const errorFeatures = result.features.filter(f => f.severity === 'error');
            const warnFeatures = result.features.filter(f => f.severity === 'warn');
            const infoFeatures = result.features.filter(f => f.severity === 'info');
            
            if (errorFeatures.length > 0) {
                lines.push(`  ERRORS (${errorFeatures.length}):`);
                errorFeatures.forEach(f => {
                    lines.push(`    ✗ ${f.feature} (Line ${f.line || 'N/A'})`);
                    lines.push(`      ${f.message}`);
                });
                lines.push('');
            }
            
            if (warnFeatures.length > 0) {
                lines.push(`  WARNINGS (${warnFeatures.length}):`);
                warnFeatures.forEach(f => {
                    lines.push(`    ⚠ ${f.feature} (Line ${f.line || 'N/A'})`);
                    lines.push(`      ${f.message}`);
                });
                lines.push('');
            }
            
            if (infoFeatures.length > 0) {
                lines.push(`  INFO (${infoFeatures.length}):`);
                infoFeatures.forEach(f => {
                    lines.push(`    ℹ ${f.feature} (Line ${f.line || 'N/A'})`);
                    lines.push(`      ${f.message}`);
                });
                lines.push('');
            }
            
            lines.push('');
        });
    } else {
        lines.push('RESULT');
        lines.push('='.repeat(70));
        lines.push('');
        lines.push('✓ All Clear! No baseline compatibility issues found.');
        lines.push('');
    }
    
    // Footer
    lines.push('='.repeat(70));
    lines.push('Generated by Baseline CLI - Web Platform Baseline Compatibility Checker');
    lines.push('='.repeat(70));
    
    return lines.join('\n');
};