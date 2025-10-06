import { FeatureResult, BaselineStatus, ParsingError, FileSystemError, FileSizeError } from '../types';
import { checkBaselineStatus } from './index';
import { createLanguageServerParser, DetectedFeature } from './language-server';
import * as fs from 'fs';

// Maximum file size to parse (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

let languageServerParser: ReturnType<typeof createLanguageServerParser> | null = null;
let parserInitializationPromise: Promise<ReturnType<typeof createLanguageServerParser>> | null = null;

async function getLanguageServerParser() {
  if (languageServerParser) {
    return languageServerParser;
  }
  
  if (parserInitializationPromise) {
    return parserInitializationPromise;
  }
  
  parserInitializationPromise = (async () => {
    languageServerParser = createLanguageServerParser();
    return languageServerParser;
  })();
  
  try {
    return await parserInitializationPromise;
  } finally {
    parserInitializationPromise = null;
  }
}

function convertToFeatureResult(detectedFeature: DetectedFeature): FeatureResult {
  const baselineStatus = checkBaselineStatus(detectedFeature.name);
  const status: BaselineStatus = typeof baselineStatus === 'string' ? baselineStatus : false;

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

export const parseCSS = async (filePath: string): Promise<FeatureResult[]> => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new FileSystemError(`File not found: ${filePath}`, filePath, 'access');
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
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
    
  } catch (error) {
    if (error instanceof FileSystemError || error instanceof FileSizeError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    throw new ParsingError(`Failed to parse CSS file: ${message}`, filePath, 'css', error instanceof Error ? error : undefined);
  }
};

export const parseJS = async (filePath: string): Promise<FeatureResult[]> => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new FileSystemError(`File not found: ${filePath}`, filePath, 'access');
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
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
    
  } catch (error) {
    if (error instanceof FileSystemError || error instanceof FileSizeError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    throw new ParsingError(`Failed to parse JS file: ${message}`, filePath, 'js', error instanceof Error ? error : undefined);
  }
};

export const parseHTML = async (filePath: string): Promise<FeatureResult[]> => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new FileSystemError(`File not found: ${filePath}`, filePath, 'access');
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new FileSizeError(filePath, stats.size, MAX_FILE_SIZE);
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
    
  } catch (error) {
    if (error instanceof FileSystemError || error instanceof FileSizeError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : String(error);
    throw new ParsingError(`Failed to parse HTML file: ${message}`, filePath, 'html', error instanceof Error ? error : undefined);
  }
};

export const parseFile = async (filePath: string): Promise<FeatureResult[]> => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return await parseCSS(filePath);
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return await parseJS(filePath);
    case 'html':
    case 'htm':
      return await parseHTML(filePath);
    default:
      return [];
  }
};