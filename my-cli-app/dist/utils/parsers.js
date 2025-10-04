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
exports.parseFile = exports.parseHTML = exports.parseJS = exports.parseCSS = void 0;
const index_1 = require("./index");
const fs = __importStar(require("fs"));
// Parse CSS files for web platform features
const parseCSS = (filePath) => {
    const results = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, lineIndex) => {
            // Extract CSS property: value pairs
            const cssDeclarationRegex = /([a-z-]+)\s*:\s*([^;{]+)/gi;
            let match;
            while ((match = cssDeclarationRegex.exec(line)) !== null) {
                const property = match[1].trim();
                const value = match[2].trim();
                // Try to find this CSS feature dynamically
                const feature = (0, index_1.findCSSFeature)(property, value);
                if (feature) {
                    results.push({
                        feature: `${property}${value ? `: ${value}` : ''}`,
                        status: feature.status,
                        severity: feature.status === 'high' ? 'info' : feature.status === 'low' ? 'warn' : 'error',
                        line: lineIndex + 1,
                        column: line.indexOf(match[0]) + 1,
                        message: `${feature.featureName} is ${feature.status === 'high' ? 'baseline' : feature.status === 'low' ? 'newly baseline' : 'not baseline'}`,
                        fixable: false
                    });
                }
            }
            // Special handling for display values (very common)
            const displayValueMatch = line.match(/display\s*:\s*(grid|flex|inline-grid|inline-flex|contents)/i);
            if (displayValueMatch) {
                const value = displayValueMatch[1].toLowerCase();
                const feature = (0, index_1.findCSSFeature)('display', value);
                if (feature) {
                    results.push({
                        feature: `display: ${value}`,
                        status: feature.status,
                        severity: feature.status === 'high' ? 'info' : feature.status === 'low' ? 'warn' : 'error',
                        line: lineIndex + 1,
                        column: line.indexOf(displayValueMatch[0]) + 1,
                        message: `${feature.featureName} is ${feature.status === 'high' ? 'baseline' : feature.status === 'low' ? 'newly baseline' : 'not baseline'}`,
                        fixable: false
                    });
                }
            }
        });
    }
    catch (error) {
        console.error(`Error parsing CSS file ${filePath}:`, error);
    }
    return results;
};
exports.parseCSS = parseCSS;
// Parse JavaScript/TypeScript files for web platform features
const parseJS = (filePath) => {
    const results = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, lineIndex) => {
            // Dynamic API detection - look for common Web API patterns
            const apiPatterns = [
                // Constructor calls: new SomeAPI()
                { regex: /\bnew\s+([A-Z][a-zA-Z]+Observer|[A-Z][a-zA-Z]*Controller|[A-Z][a-zA-Z]*Request|[A-Z][a-zA-Z]*Response)\b/g, type: 'constructor' },
                // API calls: someAPI.method() or globalAPI()
                { regex: /\b(fetch|requestAnimationFrame|requestIdleCallback|cancelAnimationFrame)\s*\(/g, type: 'function' },
                // Storage APIs
                { regex: /\b(localStorage|sessionStorage|indexedDB)\b/g, type: 'storage' },
                // Navigator APIs
                { regex: /navigator\.(serviceWorker|geolocation|mediaDevices|clipboard)/g, type: 'navigator' },
                // Promise/async patterns
                { regex: /\b(async|await)\b/g, type: 'async' },
            ];
            apiPatterns.forEach(({ regex, type }) => {
                let match;
                while ((match = regex.exec(line)) !== null) {
                    const apiName = match[1] || match[0];
                    let cleanApiName = apiName.replace(/\s+/g, ''); // Remove spaces
                    // Handle special cases
                    if (type === 'navigator') {
                        cleanApiName = match[0]; // Keep full navigator.xyz
                    }
                    else if (type === 'async') {
                        cleanApiName = 'async-await'; // Special handling for async/await
                    }
                    // Try to find this API dynamically
                    const feature = type === 'async'
                        ? (0, index_1.checkBaselineStatus)('async-await')
                        : (0, index_1.findJSFeature)(cleanApiName);
                    if (feature && typeof feature === 'object') {
                        results.push({
                            feature: apiName,
                            status: feature.status,
                            severity: feature.status === 'high' ? 'info' : feature.status === 'low' ? 'warn' : 'error',
                            line: lineIndex + 1,
                            column: match.index + 1,
                            message: `${feature.featureName} is ${feature.status === 'high' ? 'baseline' : feature.status === 'low' ? 'newly baseline' : 'not baseline'}`,
                            fixable: false
                        });
                    }
                    else if (type === 'async' && typeof feature === 'string') {
                        // Handle backward compatibility for checkBaselineStatus
                        results.push({
                            feature: apiName,
                            status: feature,
                            severity: feature === 'high' ? 'info' : feature === 'low' ? 'warn' : 'error',
                            line: lineIndex + 1,
                            column: match.index + 1,
                            message: `Async/await is ${feature === 'high' ? 'baseline' : feature === 'low' ? 'newly baseline' : 'not baseline'}`,
                            fixable: false
                        });
                    }
                    // Reset regex lastIndex to avoid infinite loops
                    regex.lastIndex = match.index + 1;
                }
            });
        });
    }
    catch (error) {
        console.error(`Error parsing JS file ${filePath}:`, error);
    }
    return results;
};
exports.parseJS = parseJS;
// Parse HTML files for web platform features
const parseHTML = (filePath) => {
    const results = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, lineIndex) => {
            // Dynamic HTML element detection
            const elementMatches = line.matchAll(/<([a-z]+[a-z0-9-]*)\b[^>]*>/gi);
            for (const match of elementMatches) {
                const elementName = match[1].toLowerCase();
                // Skip very common/basic elements that are definitely baseline
                const skipElements = ['div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li', 'ol', 'table', 'tr', 'td', 'th', 'body', 'head', 'html', 'meta', 'link', 'script', 'style'];
                if (skipElements.includes(elementName)) {
                    continue;
                }
                // Try to find this HTML element dynamically
                const feature = (0, index_1.findHTMLFeature)(elementName);
                if (feature) {
                    results.push({
                        feature: `<${elementName}> element`,
                        status: feature.status,
                        severity: feature.status === 'high' ? 'info' : feature.status === 'low' ? 'warn' : 'error',
                        line: lineIndex + 1,
                        column: (match.index || 0) + 1,
                        message: `${feature.featureName} is ${feature.status === 'high' ? 'baseline' : feature.status === 'low' ? 'newly baseline' : 'not baseline'}`,
                        fixable: false
                    });
                }
            }
            // Check for HTML attributes that might have baseline implications
            const attributePatterns = [
                // Form validation attributes
                { regex: /\b(required|pattern|min|max|step|minlength|maxlength)\b/g, feature: 'form-validation' },
                // Input types
                { regex: /type=["']?(email|url|tel|number|range|date|time|datetime-local|month|week|color|search)["']?/g, feature: 'input-types' },
                // ARIA attributes (accessibility)
                { regex: /\baria-[\w-]+=/g, feature: 'aria' },
                // Data attributes
                { regex: /\bdata-[\w-]+=/g, feature: 'dataset' },
                // Content attributes
                { regex: /\b(contenteditable|spellcheck|translate)\b/g, feature: 'content-attributes' },
            ];
            attributePatterns.forEach(({ regex, feature: featureName }) => {
                let match;
                while ((match = regex.exec(line)) !== null) {
                    const attributeValue = match[1] || match[0];
                    // Try to find HTML attribute features
                    const feature = (0, index_1.findHTMLFeature)('', attributeValue);
                    if (feature) {
                        results.push({
                            feature: `${attributeValue} attribute`,
                            status: feature.status,
                            severity: feature.status === 'high' ? 'info' : feature.status === 'low' ? 'warn' : 'error',
                            line: lineIndex + 1,
                            column: (match.index || 0) + 1,
                            message: `${feature.featureName} is ${feature.status === 'high' ? 'baseline' : feature.status === 'low' ? 'newly baseline' : 'not baseline'}`,
                            fixable: false
                        });
                    }
                }
            });
        });
    }
    catch (error) {
        console.error(`Error parsing HTML file ${filePath}:`, error);
    }
    return results;
};
exports.parseHTML = parseHTML;
// Main function to parse any file based on extension
const parseFile = (filePath) => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return (0, exports.parseCSS)(filePath);
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
            return (0, exports.parseJS)(filePath);
        case 'html':
        case 'htm':
            return (0, exports.parseHTML)(filePath);
        default:
            return [];
    }
};
exports.parseFile = parseFile;
