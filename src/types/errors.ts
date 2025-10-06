/**
 * Custom error types for the Baseline CLI
 * Provides structured error handling with context
 */

/**
 * Base error class for all Baseline CLI errors
 */
export class BaselineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(message);
    this.name = 'BaselineError';
    Object.setPrototypeOf(this, BaselineError.prototype);
  }

  toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.filePath) {
      str += `\n  at ${this.filePath}`;
      if (this.line !== undefined) {
        str += `:${this.line}`;
        if (this.column !== undefined) {
          str += `:${this.column}`;
        }
      }
    }
    return str;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      filePath: this.filePath,
      line: this.line,
      column: this.column,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when a file cannot be parsed
 */
export class ParsingError extends BaselineError {
  constructor(
    message: string,
    filePath: string,
    public readonly language: 'css' | 'js' | 'html',
    public readonly cause?: Error
  ) {
    super(message, 'PARSING_ERROR', filePath);
    this.name = 'ParsingError';
    Object.setPrototypeOf(this, ParsingError.prototype);
  }

  toString(): string {
    let str = super.toString();
    if (this.cause) {
      str += `\nCaused by: ${this.cause.message}`;
    }
    return str;
  }
}

/**
 * Error thrown when feature detection fails
 */
export class FeatureDetectionError extends BaselineError {
  constructor(
    message: string,
    filePath: string,
    public readonly featureName: string,
    line?: number,
    column?: number
  ) {
    super(message, 'FEATURE_DETECTION_ERROR', filePath, line, column);
    this.name = 'FeatureDetectionError';
    Object.setPrototypeOf(this, FeatureDetectionError.prototype);
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends BaselineError {
  constructor(
    message: string,
    filePath: string,
    public readonly operation: 'read' | 'write' | 'access' | 'stat',
    public readonly cause?: Error
  ) {
    super(message, 'FILE_SYSTEM_ERROR', filePath);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends BaselineError {
  constructor(
    message: string,
    public readonly configPath?: string,
    public readonly configKey?: string
  ) {
    super(message, 'CONFIGURATION_ERROR', configPath);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when a file is too large to process
 */
export class FileSizeError extends BaselineError {
  constructor(
    filePath: string,
    public readonly fileSize: number,
    public readonly maxSize: number
  ) {
    super(
      `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
      'FILE_SIZE_ERROR',
      filePath
    );
    this.name = 'FileSizeError';
    Object.setPrototypeOf(this, FileSizeError.prototype);
  }
}

/**
 * Error thrown when language server initialization fails
 */
export class LanguageServerError extends BaselineError {
  constructor(
    message: string,
    public readonly language: 'css' | 'js' | 'html',
    public readonly cause?: Error
  ) {
    super(message, 'LANGUAGE_SERVER_ERROR');
    this.name = 'LanguageServerError';
    Object.setPrototypeOf(this, LanguageServerError.prototype);
  }
}

/**
 * Helper function to determine if an error is a Baseline error
 */
export function isBaselineError(error: unknown): error is BaselineError {
  return error instanceof BaselineError;
}

/**
 * Helper function to create a user-friendly error message
 */
export function formatErrorMessage(error: unknown): string {
  if (isBaselineError(error)) {
    return error.toString();
  }
  
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  return String(error);
}

/**
 * Helper function to extract error details for logging
 */
export function getErrorDetails(error: unknown): {
  message: string;
  code?: string;
  filePath?: string;
  line?: number;
  column?: number;
  stack?: string;
} {
  if (isBaselineError(error)) {
    return {
      message: error.message,
      code: error.code,
      filePath: error.filePath,
      line: error.line,
      column: error.column,
      stack: error.stack
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
  
  return {
    message: String(error)
  };
}
