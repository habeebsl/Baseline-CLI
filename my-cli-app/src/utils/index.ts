import { features } from 'web-features';
import { BaselineStatus, FeatureResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Color utilities for console output
export const colors = {
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// Format output with baseline status
export const formatBaselineResult = (feature: string, status: BaselineStatus): string => {
    const statusText = status === 'high' ? colors.green('✓ Baseline') 
                      : status === 'low' ? colors.yellow('⚠ New Baseline') 
                      : colors.red('✗ Not Baseline');
    return `${colors.bold(feature)}: ${statusText}`;
};



// Create a reverse lookup index from compat_features to baseline status
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

// Dynamic feature detection functions
export const findCSSFeature = (property: string, value?: string): { status: BaselineStatus; featureName: string; compatFeature: string } | null => {
    const index = getCompatFeaturesIndex();
    
    // Try different CSS compat_features patterns
    const patterns = [
        `css.properties.${property}`,
        `css.properties.${property}.${value}`,
        `css.properties.display.${value}`, // For display: grid, flex, etc.
        `css.at-rules.${property}`,
        `css.selectors.${property}`,
    ].filter(Boolean);
    
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
    
    // Try different API compat_features patterns
    const patterns = [
        `api.${apiName}`,
        `api.${apiName}.${apiName}`, // Constructor pattern
        `javascript.builtins.${apiName}`,
        `javascript.statements.${apiName}`,
        `javascript.operators.${apiName}`,
    ];
    
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    
    return null;
};

export const findHTMLFeature = (elementName: string, attribute?: string): { status: BaselineStatus; featureName: string; compatFeature: string } | null => {
    const index = getCompatFeaturesIndex();
    
    // Try different HTML compat_features patterns
    const patterns = [
        `html.elements.${elementName}`,
        attribute ? `html.elements.${elementName}.${attribute}` : null,
        attribute ? `html.global_attributes.${attribute}` : null,
    ].filter(Boolean) as string[];
    
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    
    return null;
};

// Legacy function for backward compatibility - now uses dynamic lookup
export const checkBaselineStatus = (featureIdOrCompat: string): BaselineStatus => {
    const index = getCompatFeaturesIndex();
    const match = index.get(featureIdOrCompat);
    return match ? match.status : false;
};

// File system utilities
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

// Progress utilities
export const formatProgress = (current: number, total: number): string => {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
    return `[${bar}] ${percentage}% (${current}/${total})`;
};