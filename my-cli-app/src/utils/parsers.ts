import { FeatureResult, BaselineStatus } from '../types';
import { checkBaselineStatus, findCSSFeature, findJSFeature, findHTMLFeature } from './index';
import * as fs from 'fs';

// Parse CSS files for web platform features
export const parseCSS = (filePath: string): FeatureResult[] => {
    const results: FeatureResult[] = [];
    
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
                const feature = findCSSFeature(property, value);
                
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
                const feature = findCSSFeature('display', value);
                
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
    } catch (error) {
        console.error(`Error parsing CSS file ${filePath}:`, error);
    }
    
    return results;
};

// Parse JavaScript/TypeScript files for web platform features
export const parseJS = (filePath: string): FeatureResult[] => {
    const results: FeatureResult[] = [];
    
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
                    let cleanApiName = apiName.replace(/\s+/g, '');  // Remove spaces
                    
                    // Handle special cases
                    if (type === 'navigator') {
                        cleanApiName = match[0]; // Keep full navigator.xyz
                    } else if (type === 'async') {
                        cleanApiName = 'async-await'; // Special handling for async/await
                    }
                    
                    // Try to find this API dynamically
                    const feature = type === 'async' 
                        ? checkBaselineStatus('async-await') 
                        : findJSFeature(cleanApiName);
                    
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
                    } else if (type === 'async' && typeof feature === 'string') {
                        // Handle backward compatibility for checkBaselineStatus
                        results.push({
                            feature: apiName,
                            status: feature as BaselineStatus,
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
    } catch (error) {
        console.error(`Error parsing JS file ${filePath}:`, error);
    }
    
    return results;
};

// Parse HTML files for web platform features
export const parseHTML = (filePath: string): FeatureResult[] => {
    const results: FeatureResult[] = [];
    
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
                const feature = findHTMLFeature(elementName);
                
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
                    const feature = findHTMLFeature('', attributeValue);
                    
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
    } catch (error) {
        console.error(`Error parsing HTML file ${filePath}:`, error);
    }
    
    return results;
};

// Main function to parse any file based on extension
export const parseFile = (filePath: string): FeatureResult[] => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return parseCSS(filePath);
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
            return parseJS(filePath);
        case 'html':
        case 'htm':
            return parseHTML(filePath);
        default:
            return [];
    }
};