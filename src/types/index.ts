export interface Command {
    name: string;
    description: string;
    execute(args: string[]): Promise<void>;
}

export type CommandMap = {
    [key: string]: Command;
};

export type BaselineStatus = 'high' | 'low' | false;

export interface BaselineConfig {
    strict: boolean;
    targets: {
        baseline: 'high' | 'low';
        browsers?: string[];
    };
    rules: {
        [ruleName: string]: 'error' | 'warn' | 'off';
    };
    ignore: string[];
    include: string[];
    autofix: boolean;
    outputFormat: 'console' | 'json' | 'html' | 'text';
}

export interface CheckOptions {
    path?: string;
    strict?: boolean;
    format?: 'console' | 'json' | 'html' | 'text';
    fix?: boolean;
    quiet?: boolean;
    verbose?: boolean;
    configFile?: string;
}

export interface BaselineResult {
    file: string;
    features: FeatureResult[];
    errors: number;
    warnings: number;
    passed: boolean;
}

export interface FeatureResult {
    feature: string;
    status: BaselineStatus;
    severity: 'error' | 'warn' | 'info';
    line?: number;
    column?: number;
    message: string;
    fixable?: boolean;
}

export interface ScanProgress {
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    errors: number;
    warnings: number;
}

export * from './errors';