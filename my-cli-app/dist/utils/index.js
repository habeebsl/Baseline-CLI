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
exports.formatProgress = exports.findFiles = exports.checkBaselineStatus = exports.findHTMLFeature = exports.findJSFeature = exports.findCSSFeature = exports.getCompatFeaturesIndex = exports.formatBaselineResult = exports.colors = void 0;
const web_features_1 = require("web-features");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Color utilities for console output
exports.colors = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
};
// Format output with baseline status
const formatBaselineResult = (feature, status) => {
    const statusText = status === 'high' ? exports.colors.green('✓ Baseline')
        : status === 'low' ? exports.colors.yellow('⚠ New Baseline')
            : exports.colors.red('✗ Not Baseline');
    return `${exports.colors.bold(feature)}: ${statusText}`;
};
exports.formatBaselineResult = formatBaselineResult;
// Create a reverse lookup index from compat_features to baseline status
let compatFeaturesIndex = null;
const getCompatFeaturesIndex = () => {
    if (compatFeaturesIndex) {
        return compatFeaturesIndex;
    }
    compatFeaturesIndex = new Map();
    Object.entries(web_features_1.features).forEach(([featureId, feature]) => {
        if (feature && typeof feature === 'object' && 'status' in feature) {
            const featureData = feature;
            const status = featureData.status?.baseline;
            const featureName = featureData.name || featureId;
            if (status) {
                // Map the main feature ID
                compatFeaturesIndex.set(featureId, { status, featureName, featureId });
                // Map all compat_features
                if ('compat_features' in featureData && Array.isArray(featureData.compat_features)) {
                    featureData.compat_features.forEach((compatFeature) => {
                        compatFeaturesIndex.set(compatFeature, { status, featureName, featureId });
                    });
                }
            }
        }
    });
    return compatFeaturesIndex;
};
exports.getCompatFeaturesIndex = getCompatFeaturesIndex;
// Dynamic feature detection functions
const findCSSFeature = (property, value) => {
    const index = (0, exports.getCompatFeaturesIndex)();
    // Try different CSS compat_features patterns
    const patterns = [
        `css.properties.${property}`,
        `css.properties.${property}.${value}`,
        `css.properties.display.${value}`,
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
exports.findCSSFeature = findCSSFeature;
const findJSFeature = (apiName) => {
    const index = (0, exports.getCompatFeaturesIndex)();
    // Try different API compat_features patterns
    const patterns = [
        `api.${apiName}`,
        `api.${apiName}.${apiName}`,
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
exports.findJSFeature = findJSFeature;
const findHTMLFeature = (elementName, attribute) => {
    const index = (0, exports.getCompatFeaturesIndex)();
    // Try different HTML compat_features patterns
    const patterns = [
        `html.elements.${elementName}`,
        attribute ? `html.elements.${elementName}.${attribute}` : null,
        attribute ? `html.global_attributes.${attribute}` : null,
    ].filter(Boolean);
    for (const pattern of patterns) {
        const match = index.get(pattern);
        if (match) {
            return { ...match, compatFeature: pattern };
        }
    }
    return null;
};
exports.findHTMLFeature = findHTMLFeature;
// Legacy function for backward compatibility - now uses dynamic lookup
const checkBaselineStatus = (featureIdOrCompat) => {
    const index = (0, exports.getCompatFeaturesIndex)();
    const match = index.get(featureIdOrCompat);
    return match ? match.status : false;
};
exports.checkBaselineStatus = checkBaselineStatus;
// File system utilities
const findFiles = (dir, extensions) => {
    const files = [];
    if (!fs.existsSync(dir)) {
        return files;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...(0, exports.findFiles)(fullPath, extensions));
        }
        else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
                files.push(fullPath);
            }
        }
    }
    return files;
};
exports.findFiles = findFiles;
// Progress utilities
const formatProgress = (current, total) => {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
    return `[${bar}] ${percentage}% (${current}/${total})`;
};
exports.formatProgress = formatProgress;
