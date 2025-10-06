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
const types_1 = require("../types");
const index_1 = require("./index");
const language_server_1 = require("./language-server");
const fs = __importStar(require("fs"));
// Maximum file size to parse (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let languageServerParser = null;
let parserInitializationPromise = null;
async function getLanguageServerParser() {
    if (languageServerParser) {
        return languageServerParser;
    }
    if (parserInitializationPromise) {
        return parserInitializationPromise;
    }
    parserInitializationPromise = (async () => {
        languageServerParser = (0, language_server_1.createLanguageServerParser)();
        return languageServerParser;
    })();
    try {
        return await parserInitializationPromise;
    }
    finally {
        parserInitializationPromise = null;
    }
}
function convertToFeatureResult(detectedFeature) {
    const baselineStatus = (0, index_1.checkBaselineStatus)(detectedFeature.name);
    const status = typeof baselineStatus === 'string' ? baselineStatus : false;
    const severity = status === false ? 'error' :
        status === 'low' ? 'warn' : 'info';
    return {
        feature: detectedFeature.name,
        status,
        severity,
        line: detectedFeature.line,
        column: detectedFeature.column,
        message: `${detectedFeature.context} - ${detectedFeature.name} is ${status === 'high' ? 'fully baseline' : status === 'low' ? 'newly baseline' : 'not baseline'}`,
        fixable: false
    };
}
const parseCSS = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new types_1.FileSystemError(`File not found: ${filePath}`, filePath, 'access');
        }
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            throw new types_1.FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const parser = await getLanguageServerParser();
        const parseResult = await parser.parseCSS(content, filePath);
        const results = parseResult.features.map(convertToFeatureResult);
        if (parseResult.errors.length > 0) {
            console.warn(`CSS parsing warnings for ${filePath}:`, parseResult.errors);
        }
        console.log(`Parsed ${filePath}: ${results.length} features detected in ${parseResult.metadata.parseTime}ms`);
        return results;
    }
    catch (error) {
        if (error instanceof types_1.FileSystemError || error instanceof types_1.FileSizeError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new types_1.ParsingError(`Failed to parse CSS file: ${message}`, filePath, 'css', error instanceof Error ? error : undefined);
    }
};
exports.parseCSS = parseCSS;
const parseJS = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new types_1.FileSystemError(`File not found: ${filePath}`, filePath, 'access');
        }
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            throw new types_1.FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const parser = await getLanguageServerParser();
        const parseResult = await parser.parseJS(content, filePath);
        const results = parseResult.features.map(convertToFeatureResult);
        if (parseResult.errors.length > 0) {
            console.warn(`JS parsing warnings for ${filePath}:`, parseResult.errors);
        }
        console.log(`⚡ Parsed ${filePath}: ${results.length} features detected in ${parseResult.metadata.parseTime}ms`);
        return results;
    }
    catch (error) {
        if (error instanceof types_1.FileSystemError || error instanceof types_1.FileSizeError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new types_1.ParsingError(`Failed to parse JS file: ${message}`, filePath, 'js', error instanceof Error ? error : undefined);
    }
};
exports.parseJS = parseJS;
const parseHTML = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new types_1.FileSystemError(`File not found: ${filePath}`, filePath, 'access');
        }
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            throw new types_1.FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const parser = await getLanguageServerParser();
        const parseResult = await parser.parseHTML(content, filePath);
        const results = parseResult.features.map(convertToFeatureResult);
        if (parseResult.errors.length > 0) {
            console.warn(`HTML parsing warnings for ${filePath}:`, parseResult.errors);
        }
        console.log(`Parsed ${filePath}: ${results.length} features detected in ${parseResult.metadata.parseTime}ms`);
        return results;
    }
    catch (error) {
        if (error instanceof types_1.FileSystemError || error instanceof types_1.FileSizeError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new types_1.ParsingError(`Failed to parse HTML file: ${message}`, filePath, 'html', error instanceof Error ? error : undefined);
    }
};
exports.parseHTML = parseHTML;
const parseFile = async (filePath) => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return await (0, exports.parseCSS)(filePath);
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
            return await (0, exports.parseJS)(filePath);
        case 'html':
        case 'htm':
            return await (0, exports.parseHTML)(filePath);
        default:
            return [];
    }
};
exports.parseFile = parseFile;
