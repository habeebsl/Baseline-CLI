import * as ts from 'typescript';
import { getCSSLanguageService, LanguageService as CSSLanguageService, TextDocument } from 'vscode-css-languageservice';
import { getLanguageService as getHTMLLanguageService, LanguageService as HTMLLanguageService } from 'vscode-html-languageservice';
import { getWebFeaturesMapper, WebFeaturesMapper } from './web-features-mapper';
import {
  CSSNode,
  CSSNodeType,
  CSSStylesheet,
  CSSDeclaration,
  CSSProperty,
  CSSAtRule,
  CSSSelector,
  HTMLNode,
  HTMLDocument,
  isCSSDeclaration,
  isCSSProperty,
  isCSSAtRule,
  isCSSSelector,
  isHTMLElement,
  hasAttributes
} from '../types/ast-nodes';

export interface DetectedFeature {
  name: string;
  type: 'css' | 'js' | 'html';
  line: number;
  column: number;
  context: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ParseResult {
  features: DetectedFeature[];
  errors: string[];
  metadata: {
    totalLines: number;
    language: string;
    parseTime: number;
  };
}

export class LanguageServerParser {
  private cssLanguageService: CSSLanguageService;
  private htmlLanguageService: HTMLLanguageService;
  private webFeaturesMapper: WebFeaturesMapper | null = null;

  constructor() {
    this.cssLanguageService = getCSSLanguageService();
    this.htmlLanguageService = getHTMLLanguageService();
  }

  private async ensureMapperInitialized() {
    if (!this.webFeaturesMapper) {
      this.webFeaturesMapper = await getWebFeaturesMapper();
    }
  }

  async parseCSS(content: string, filePath: string = 'untitled.css'): Promise<ParseResult> {
    const startTime = Date.now();
    const features: DetectedFeature[] = [];
    const errors: string[] = [];

    await this.ensureMapperInitialized();

    try {
      const document = TextDocument.create(filePath, 'css', 1, content);
      const cssDocument = this.cssLanguageService.parseStylesheet(document);
      
      this.extractCSSFeatures(cssDocument as unknown as CSSNode, document, features);
      
      const diagnostics = this.cssLanguageService.doValidation(document, cssDocument);
      errors.push(...diagnostics.map(d => d.message));

    } catch (error) {
      errors.push(`CSS parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      features,
      errors,
      metadata: {
        totalLines: content.split('\n').length,
        language: 'css',
        parseTime: Date.now() - startTime
      }
    };
  }

  async parseJS(content: string, filePath: string = 'untitled.js'): Promise<ParseResult> {
    const startTime = Date.now();
    const features: DetectedFeature[] = [];
    const errors: string[] = [];

    await this.ensureMapperInitialized();

    try {
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      const scriptKind = isTypeScript ? ts.ScriptKind.TS : ts.ScriptKind.JS;

      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      );

      this.extractJSFeatures(sourceFile, content, features);

      const program = ts.createProgram([filePath], { allowJs: true, checkJs: false });
      const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
      if (diagnostics.length > 0) {
        errors.push(...diagnostics.map(d => 
          ts.flattenDiagnosticMessageText(d.messageText, '\n')
        ));
      }

    } catch (error) {
      errors.push(`JS/TS parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      features,
      errors,
      metadata: {
        totalLines: content.split('\n').length,
        language: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        parseTime: Date.now() - startTime
      }
    };
  }

  async parseHTML(content: string, filePath: string = 'untitled.html'): Promise<ParseResult> {
        const startTime = Date.now();
    const features: DetectedFeature[] = [];
    const errors: string[] = [];

    await this.ensureMapperInitialized();

    try {
      const document = TextDocument.create(filePath, 'html', 1, content);
      const htmlDocument = this.htmlLanguageService.parseHTMLDocument(document);
      
      this.extractHTMLFeatures(htmlDocument as unknown as HTMLDocument, document, features);

    } catch (error) {
      errors.push(`HTML parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      features,
      errors,
      metadata: {
        totalLines: content.split('\n').length,
        language: 'html',
        parseTime: Date.now() - startTime
      }
    };
  }

  private extractCSSFeatures(cssDocument: CSSNode, textDocument: TextDocument, features: DetectedFeature[]) {
    // Traverse CSS AST and identify features
    const traverse = (node: CSSNode) => {
      if (!node) return;

      switch (node.type) {
        case CSSNodeType.Ruleset:
        case CSSNodeType.Declaration:
          this.handleCSSRule(node, textDocument, features);
          break;
        case CSSNodeType.Keyframe:
        case CSSNodeType.Media:
        case CSSNodeType.Container:
        case CSSNodeType.Supports:
        case CSSNodeType.Layer:
          this.handleCSSAtRule(node as CSSAtRule, textDocument, features);
          break;
        case CSSNodeType.Property:
          this.handleCSSProperty(node as CSSProperty, textDocument, features);
          break;
        case CSSNodeType.Selector:
        case CSSNodeType.SimpleSelector:
        case CSSNodeType.PseudoSelector:
          this.handleCSSSelector(node, textDocument, features);
          break;
      }

      if (node.children) {
        node.children.forEach((child: CSSNode) => traverse(child));
      }
    };

    traverse(cssDocument);
  }

  private handleCSSRule(node: CSSNode, textDocument: TextDocument, features: DetectedFeature[]) {
    const ruleText = textDocument.getText().substring(node.offset, node.end);
    const position = textDocument.positionAt(node.offset);
    
    const propertyMatch = ruleText.match(/([-\w]+)\s*:\s*([^;]+)/g);
    if (propertyMatch) {
      propertyMatch.forEach((match: string) => {
        const [, property, value] = match.match(/([-\w]+)\s*:\s*(.+)/) || [];
        if (property && value) {
          const compatFeature = this.mapCSSPropertyToFeature(property.trim());
          if (compatFeature) {
            features.push({
              name: compatFeature,
              type: 'css',
              line: position.line + 1,
              column: position.character + 1,
              context: `CSS property: ${property}: ${value.trim()}`,
              confidence: 'high'
            });
          }
          
          const valueFeatures = this.checkCSSPropertyValue(property.trim(), value.trim());
          valueFeatures.forEach(feature => {
            features.push({
              name: feature,
              type: 'css',
              line: position.line + 1,
              column: position.character + 1,
              context: `CSS value: ${property}: ${value.trim()}`,
              confidence: 'high'
            });
          });
        }
      });
    }
  }

  private handleCSSProperty(node: CSSProperty, textDocument: TextDocument, features: DetectedFeature[]) {
    const propertyName = textDocument.getText().substring(node.offset, node.end);
    const position = textDocument.positionAt(node.offset);
    
    const compatFeature = this.mapCSSPropertyToFeature(propertyName);
    if (compatFeature) {
      features.push({
        name: compatFeature,
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName.match(/-(inline|block)-(start|end)$/)) {
      features.push({
        name: 'css-logical-properties',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS logical property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName === 'container-type' || propertyName === 'container-name' || propertyName === 'container') {
      features.push({
        name: 'css-container-queries',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS container property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName.startsWith('scroll-snap-') || propertyName === 'scroll-behavior' || propertyName.startsWith('scroll-margin') || propertyName.startsWith('scroll-padding')) {
      features.push({
        name: 'css-scroll-snap',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS scroll property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName === 'overscroll-behavior' || propertyName === 'overscroll-behavior-x' || propertyName === 'overscroll-behavior-y') {
      features.push({
        name: 'css-overscroll-behavior',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS overscroll property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName.startsWith('text-decoration-')) {
      features.push({
        name: 'css-text-decoration',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS text decoration property: ${propertyName}`,
        confidence: 'high'
      });
    }
    
    if (propertyName === 'gap' || propertyName === 'row-gap' || propertyName === 'column-gap') {
      features.push({
        name: 'css-gap',
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS gap property: ${propertyName}`,
        confidence: 'high'
      });
    }
  }

  private handleCSSSelector(node: CSSNode, textDocument: TextDocument, features: DetectedFeature[]) {
    const selectorText = textDocument.getText().substring(node.offset, node.end);
    const position = textDocument.positionAt(node.offset);
    
    // Check for modern selector features like :has(), :is(), :where()
    const selectorFeatures = this.mapCSSSelectorToFeatures(selectorText);
    selectorFeatures.forEach(feature => {
      features.push({
        name: feature,
        type: 'css',
        line: position.line + 1,
        column: position.character + 1,
        context: `CSS selector: ${selectorText.trim()}`,
        confidence: 'high'
      });
    });
    
    const advancedSelectors = [
      { pattern: /:has\(/, name: 'css-has', desc: ':has() selector' },
      { pattern: /:is\(/, name: 'css-is', desc: ':is() selector' },
      { pattern: /:where\(/, name: 'css-where', desc: ':where() selector' },
      { pattern: /:not\(/, name: 'css-not', desc: ':not() selector' },
      { pattern: /::backdrop/, name: 'dialog', desc: '::backdrop pseudo-element' },
      { pattern: /::placeholder/, name: 'css-placeholder', desc: '::placeholder pseudo-element' },
      { pattern: /::marker/, name: 'css-marker', desc: '::marker pseudo-element' },
      { pattern: /::selection/, name: 'css-selection', desc: '::selection pseudo-element' },
      { pattern: /::part\(/, name: 'css-shadow-parts', desc: '::part() pseudo-element' },
      { pattern: /::slotted\(/, name: 'css-slotted', desc: '::slotted() pseudo-element' },
      { pattern: /:focus-visible/, name: 'css-focus-visible', desc: ':focus-visible pseudo-class' },
      { pattern: /:focus-within/, name: 'css-focus-within', desc: ':focus-within pseudo-class' },
      { pattern: /:target/, name: 'css-target', desc: ':target pseudo-class' },
      { pattern: /:nth-child\(.*of/, name: 'css-nth-child-of', desc: ':nth-child(... of S) selector' }
    ];
    
    advancedSelectors.forEach(({ pattern, name, desc }) => {
      if (pattern.test(selectorText)) {
        features.push({
          name,
          type: 'css',
          line: position.line + 1,
          column: position.character + 1,
          context: `CSS ${desc}`,
          confidence: 'high'
        });
      }
    });
  }

  private handleCSSAtRule(node: CSSAtRule, textDocument: TextDocument, features: DetectedFeature[]) {
    const atRuleText = textDocument.getText().substring(node.offset, node.end);
    const position = textDocument.positionAt(node.offset);
    
    // Extract at-rule name (like @container, @media, @supports)
    const atRuleMatch = atRuleText.match(/@([\w-]+)/);
    if (atRuleMatch) {
      const atRuleName = atRuleMatch[1];
      const compatFeature = this.mapCSSAtRuleToFeature(atRuleName);
      if (compatFeature) {
        features.push({
          name: compatFeature,
          type: 'css',
          line: position.line + 1,
          column: position.character + 1,
          context: `CSS at-rule: @${atRuleName}`,
          confidence: 'high'
        });
      }
      
      const atRuleFeatures: Record<string, string> = {
        'container': 'css-container-queries',
        'layer': 'css-cascade-layers',
        'scope': 'css-scope',
        'starting-style': 'css-starting-style',
        'property': 'css-properties-values-api',
        'keyframes': 'css-animations',
        'media': 'css-media-queries',
        'supports': 'css-supports',
        'import': 'css-import',
        'font-face': 'css-font-face',
        'counter-style': 'css-counter-styles'
      };
      
      if (atRuleFeatures[atRuleName]) {
        features.push({
          name: atRuleFeatures[atRuleName],
          type: 'css',
          line: position.line + 1,
          column: position.character + 1,
          context: `CSS at-rule: @${atRuleName}`,
          confidence: 'high'
        });
      }
      
      if (atRuleName === 'media') {
        const mediaFeatures = [
          { pattern: /prefers-color-scheme/, name: 'prefers-color-scheme' },
          { pattern: /prefers-reduced-motion/, name: 'prefers-reduced-motion' },
          { pattern: /prefers-contrast/, name: 'prefers-contrast' },
          { pattern: /prefers-reduced-data/, name: 'prefers-reduced-data' },
          { pattern: /prefers-reduced-transparency/, name: 'prefers-reduced-transparency' },
          { pattern: /forced-colors/, name: 'forced-colors' },
          { pattern: /hover:\s*hover/, name: 'hover-media-query' },
          { pattern: /pointer:\s*fine/, name: 'pointer-media-query' },
          { pattern: /any-hover/, name: 'any-hover' },
          { pattern: /any-pointer/, name: 'any-pointer' }
        ];
        
        mediaFeatures.forEach(({ pattern, name }) => {
          if (pattern.test(atRuleText)) {
            features.push({
              name,
              type: 'css',
              line: position.line + 1,
              column: position.character + 1,
              context: `Media query feature: ${name}`,
              confidence: 'high'
            });
          }
        });
      }
    }
  }

  private checkCSSPropertyValue(property: string, value: string): string[] {
    const features: string[] = [];
    
    if (property === 'display') {
      if (value.includes('grid')) features.push('css-grid');
      if (value.includes('flex')) features.push('flexbox');
      if (value.includes('contents')) features.push('display-contents');
      if (value.includes('subgrid')) features.push('css-subgrid');
    }
    
    if (value.includes('clamp(')) features.push('css-math-functions');
    if (value.includes('min(') || value.includes('max(')) features.push('css-math-functions');
    if (value.includes('var(')) features.push('custom-properties');
    if (value.includes('calc(')) features.push('calc');
    
    if (value.match(/rgb\(.*\/.*\)/)) features.push('css-color-4');
    if (value.match(/hsl\(.*\/.*\)/)) features.push('css-color-4');
    if (value.match(/hwb\(/)) features.push('css-color-4');
    if (value.match(/lch\(/) || value.match(/lab\(/)) features.push('css-color-4');
    if (value.match(/color\(/)) features.push('css-color-5');
    
    if (value.includes('linear-gradient')) features.push('css-gradients');
    if (value.includes('radial-gradient')) features.push('css-gradients');
    if (value.includes('conic-gradient')) features.push('css-conic-gradients');
    
    if (value.includes('blur(') || value.includes('brightness(') || value.includes('contrast(')) {
      features.push('css-filters');
    }
    
    if (property === 'backdrop-filter' || property === '-webkit-backdrop-filter') {
      features.push('backdrop-filter');
    }
    
    if (property === 'aspect-ratio') {
      features.push('aspect-ratio');
    }
    
    // Container query units
    if (value.match(/\d+cq[whib]/)) {
      features.push('css-container-queries');
    }
    
    // View transition
    if (property.startsWith('view-transition')) {
      features.push('view-transitions');
    }
    
    // Anchor positioning
    if (property.startsWith('anchor-') || property === 'position-anchor') {
      features.push('css-anchor-positioning');
    }
    
    // Scroll-driven animations
    if (property === 'animation-timeline' || property === 'scroll-timeline') {
      features.push('scroll-driven-animations');
    }
    
    return features;
  }

  private extractJSFeatures(sourceFile: ts.SourceFile, content: string, features: DetectedFeature[]) {
    const traverse = (node: ts.Node) => {
      // Handle different JavaScript/TypeScript node types
      switch (node.kind) {
        case ts.SyntaxKind.PropertyAccessExpression:
          this.handleJSPropertyAccess(node as ts.PropertyAccessExpression, sourceFile, features);
          break;
        case ts.SyntaxKind.CallExpression:
          this.handleJSMethodCall(node as ts.CallExpression, sourceFile, features);
          break;
        case ts.SyntaxKind.NewExpression:
          this.handleJSConstructor(node as ts.NewExpression, sourceFile, features);
          break;
        case ts.SyntaxKind.VariableDeclaration:
          this.handleJSVariableDeclaration(node as ts.VariableDeclaration, sourceFile, features);
          break;
        case ts.SyntaxKind.ArrowFunction:
          this.handleJSArrowFunction(node as ts.ArrowFunction, sourceFile, features);
          break;
        case ts.SyntaxKind.AsyncKeyword:
          this.handleJSAsyncKeyword(node, sourceFile, features);
          break;
        case ts.SyntaxKind.AwaitExpression:
          this.handleJSAwaitExpression(node as ts.AwaitExpression, sourceFile, features);
          break;
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
          this.handleJSClass(node as ts.ClassDeclaration | ts.ClassExpression, sourceFile, features);
          break;
        case ts.SyntaxKind.SpreadElement:
        case ts.SyntaxKind.SpreadAssignment:
          this.handleJSSpreadOperator(node, sourceFile, features);
          break;
        case ts.SyntaxKind.QuestionDotToken:
          this.handleJSOptionalChaining(node, sourceFile, features);
          break;
        case ts.SyntaxKind.QuestionQuestionToken:
          this.handleJSNullishCoalescing(node, sourceFile, features);
          break;
        case ts.SyntaxKind.BigIntLiteral:
          this.handleJSBigInt(node, sourceFile, features);
          break;
        case ts.SyntaxKind.TemplateExpression:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
          this.handleJSTemplateLiteral(node, sourceFile, features);
          break;
        case ts.SyntaxKind.ImportKeyword:
          if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
            this.handleJSDynamicImport(node.parent, sourceFile, features);
          }
          break;
      }

      ts.forEachChild(node, traverse);
    };

    traverse(sourceFile);
  }

  private handleJSPropertyAccess(node: ts.PropertyAccessExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const fullText = sourceFile.getFullText();
    const nodeText = fullText.substring(node.getStart(), node.getEnd());
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    const compatFeature = this.mapJSPropertyToFeature(nodeText);
    if (compatFeature) {
      features.push({
        name: compatFeature,
        type: 'js',
        line: position.line + 1,
        column: position.character + 1,
        context: `JS property access: ${nodeText}`,
        confidence: 'high'
      });
    }
  }

  private handleJSMethodCall(node: ts.CallExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const fullText = sourceFile.getFullText();
    const nodeText = fullText.substring(node.getStart(), node.getEnd());
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    // Get the actual function being called
    const expression = node.expression;
    let functionName = '';
    
    if (ts.isIdentifier(expression)) {
      // Direct function call like fetch()
      functionName = expression.text;
    } else if (ts.isPropertyAccessExpression(expression)) {
      // Method call like document.querySelector() or navigator.serviceWorker
      const object = fullText.substring(expression.expression.getStart(), expression.expression.getEnd());
      const property = expression.name.text;
      functionName = `${object}.${property}`;
    }
    
    if (functionName) {
      const compatFeature = this.mapJSMethodToFeature(functionName);
      if (compatFeature) {
        features.push({
          name: compatFeature,
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: `JS method call: ${functionName}()`,
          confidence: 'high'
        });
      }
      
      // Check for built-in global functions
      const globalFunctions: Record<string, string> = {
        'fetch': 'fetch',
        'requestAnimationFrame': 'requestanimationframe',
        'requestIdleCallback': 'requestidlecallback',
        'queueMicrotask': 'queuemicrotask'
      };
      
      if (globalFunctions[functionName]) {
        features.push({
          name: globalFunctions[functionName],
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: `JS function: ${functionName}()`,
          confidence: 'high'
        });
      }
      
      // Check for Promise methods
      if (functionName.includes('Promise.allSettled')) {
        features.push({
          name: 'promise-allsettled',
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: 'Promise.allSettled()',
          confidence: 'high'
        });
      } else if (functionName.includes('Promise.any')) {
        features.push({
          name: 'promise-any',
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: 'Promise.any()',
          confidence: 'high'
        });
      }
      
      // Check for Reflect API
      if (functionName.startsWith('Reflect.')) {
        features.push({
          name: 'reflect',
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: `Reflect API: ${functionName}()`,
          confidence: 'high'
        });
      }
    }
  }

  private handleJSConstructor(node: ts.NewExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const fullText = sourceFile.getFullText();
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    // Get constructor name
    let constructorName = '';
    if (node.expression && ts.isIdentifier(node.expression)) {
      constructorName = node.expression.text;
    } else if (node.expression) {
      constructorName = fullText.substring(node.expression.getStart(), node.expression.getEnd());
    }
    
    if (constructorName) {
      // Pass with 'new ' prefix so the mapper can extract it correctly
      const compatFeature = this.mapJSConstructorToFeature(`new ${constructorName}`);
      if (compatFeature) {
        features.push({
          name: compatFeature,
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: `JS constructor: new ${constructorName}()`,
          confidence: 'high'
        });
      }
      
      // Also check for built-in constructors that might not be in web-features
      const builtInConstructors: Record<string, string> = {
        'WeakMap': 'weakmap',
        'WeakSet': 'weakset',
        'Map': 'map',
        'Set': 'set',
        'Symbol': 'symbol',
        'Proxy': 'proxy',
        'Promise': 'promises',
        'WeakRef': 'weakref',
        'FinalizationRegistry': 'finalizationregistry'
      };
      
      if (builtInConstructors[constructorName]) {
        features.push({
          name: builtInConstructors[constructorName],
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: `JS constructor: new ${constructorName}()`,
          confidence: 'high'
        });
      }
    }
  }

  private handleJSArrowFunction(node: ts.ArrowFunction, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'arrow-functions',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Arrow function syntax',
      confidence: 'high'
    });
  }

  private handleJSAsyncKeyword(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'async-functions',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Async function',
      confidence: 'high'
    });
  }

  private handleJSAwaitExpression(node: ts.AwaitExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'async-await',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Await expression',
      confidence: 'high'
    });
  }

  private handleJSVariableDeclaration(node: ts.VariableDeclaration, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const fullText = sourceFile.getFullText();
    const nodeText = fullText.substring(node.getStart(), node.getEnd());
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    // Check for destructuring assignment
    if (node.name && (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name))) {
      features.push({
        name: 'destructuring-assignment',
        type: 'js',
        line: position.line + 1,
        column: position.character + 1,
        context: 'Destructuring assignment',
        confidence: 'high'
      });
    }
    
    // Check for template literals in initializer
    if (node.initializer && nodeText.includes('`')) {
      features.push({
        name: 'template-literals',
        type: 'js',
        line: position.line + 1,
        column: position.character + 1,
        context: 'Template literal',
        confidence: 'high'
      });
    }
  }

  private handleJSClass(node: ts.ClassDeclaration | ts.ClassExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    
    // Basic class syntax
    features.push({
      name: 'es6-class',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'ES6 Class',
      confidence: 'high'
    });
    
    // Check for private fields/methods
    node.members.forEach(member => {
      if (member.name && ts.isPrivateIdentifier(member.name)) {
        features.push({
          name: 'class-private-fields',
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: 'Private class fields',
          confidence: 'high'
        });
      }
      
      // Check for static members
      if (member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword)) {
        features.push({
          name: 'class-static-members',
          type: 'js',
          line: position.line + 1,
          column: position.character + 1,
          context: 'Static class members',
          confidence: 'high'
        });
      }
    });
  }

  private handleJSSpreadOperator(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'spread-operator',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Spread operator (...)',
      confidence: 'high'
    });
  }

  private handleJSOptionalChaining(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'optional-chaining',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Optional chaining (?.)',
      confidence: 'high'
    });
  }

  private handleJSNullishCoalescing(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'nullish-coalescing',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Nullish coalescing (??)',
      confidence: 'high'
    });
  }

  private handleJSBigInt(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'bigint',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'BigInt',
      confidence: 'high'
    });
  }

  private handleJSTemplateLiteral(node: ts.Node, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'template-literals',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Template literal',
      confidence: 'high'
    });
  }

  private handleJSDynamicImport(node: ts.CallExpression, sourceFile: ts.SourceFile, features: DetectedFeature[]) {
    const position = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    features.push({
      name: 'dynamic-import',
      type: 'js',
      line: position.line + 1,
      column: position.character + 1,
      context: 'Dynamic import()',
      confidence: 'high'
    });
  }

  private extractHTMLFeatures(htmlDocument: HTMLDocument, textDocument: TextDocument, features: DetectedFeature[]) {
    // Traverse HTML AST and identify features
    const traverse = (node: HTMLNode) => {
      if (!node) return;

      // Handle HTML elements and attributes
      if (node.tag) {
        this.handleHTMLElement(node, textDocument, features);
      }

      if (node.children) {
        node.children.forEach((child: HTMLNode) => traverse(child));
      }
    };

    if (htmlDocument.roots) {
      htmlDocument.roots.forEach((root: HTMLNode) => traverse(root));
    }
  }

  private handleHTMLElement(node: HTMLNode, textDocument: TextDocument, features: DetectedFeature[]) {
    const position = textDocument.positionAt(node.start);
    
    // Check element name for modern HTML features
    if (node.tag) {
      const elementFeature = this.mapHTMLElementToFeature(node.tag);
      if (elementFeature) {
        features.push({
          name: elementFeature,
          type: 'html',
          line: position.line + 1,
          column: position.character + 1,
          context: `HTML element: <${node.tag}>`,
          confidence: 'high'
        });
      }
      
      // Additional element detection
      const modernElements: Record<string, string> = {
        'dialog': 'dialog',
        'details': 'details',
        'summary': 'details',
        'template': 'template',
        'slot': 'slot',
        'canvas': 'canvas',
        'video': 'video',
        'audio': 'audio',
        'picture': 'picture',
        'source': 'picture',
        'track': 'track',
        'progress': 'progress',
        'meter': 'meter',
        'output': 'output',
        'datalist': 'datalist',
        'time': 'time',
        'mark': 'mark',
        'svg': 'svg',
        'math': 'mathml'
      };
      
      if (modernElements[node.tag.toLowerCase()]) {
        features.push({
          name: modernElements[node.tag.toLowerCase()],
          type: 'html',
          line: position.line + 1,
          column: position.character + 1,
          context: `HTML element: <${node.tag}>`,
          confidence: 'high'
        });
      }
      
      // Check for custom elements (contain hyphen)
      if (node.tag.includes('-')) {
        features.push({
          name: 'custom-elements',
          type: 'html',
          line: position.line + 1,
          column: position.character + 1,
          context: `Custom element: <${node.tag}>`,
          confidence: 'high'
        });
      }
    }

    // Check attributes for modern features
    if (node.attributes) {
      Object.keys(node.attributes).forEach(attrName => {
        const attrValue = node.attributes![attrName];
        const attrFeature = this.mapHTMLAttributeToFeature(attrName);
        if (attrFeature) {
          features.push({
            name: attrFeature,
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: `HTML attribute: ${attrName}`,
            confidence: 'high'
          });
        }
        
        // ARIA attributes detection
        if (attrName.startsWith('aria-')) {
          features.push({
            name: 'aria',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: `ARIA attribute: ${attrName}`,
            confidence: 'high'
          });
        }
        
        // Data attributes detection
        if (attrName.startsWith('data-')) {
          features.push({
            name: 'dataset',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: `Data attribute: ${attrName}`,
            confidence: 'high'
          });
        }
        
        // Content editable
        if (attrName === 'contenteditable') {
          features.push({
            name: 'contenteditable',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'contenteditable attribute',
            confidence: 'high'
          });
        }
        
        // Spellcheck
        if (attrName === 'spellcheck') {
          features.push({
            name: 'spellcheck',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'spellcheck attribute',
            confidence: 'high'
          });
        }
        
        // Draggable
        if (attrName === 'draggable') {
          features.push({
            name: 'drag-and-drop',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'draggable attribute',
            confidence: 'high'
          });
        }
        
        // Input types
        if (node.tag?.toLowerCase() === 'input' && attrName === 'type' && attrValue) {
          const modernInputTypes: Record<string, string> = {
            'email': 'input-email',
            'url': 'input-url',
            'tel': 'input-tel',
            'number': 'input-number',
            'range': 'input-range',
            'date': 'input-date',
            'time': 'input-time',
            'datetime-local': 'input-datetime-local',
            'month': 'input-month',
            'week': 'input-week',
            'color': 'input-color',
            'search': 'input-search'
          };
          
          const inputType = attrValue.toLowerCase();
          if (modernInputTypes[inputType]) {
            features.push({
              name: modernInputTypes[inputType],
              type: 'html',
              line: position.line + 1,
              column: position.character + 1,
              context: `Input type: ${inputType}`,
              confidence: 'high'
            });
          }
        }
        
        // Form validation attributes
        const validationAttrs = ['required', 'pattern', 'min', 'max', 'minlength', 'maxlength', 'step'];
        if (validationAttrs.includes(attrName)) {
          features.push({
            name: 'form-validation',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: `Form validation: ${attrName}`,
            confidence: 'high'
          });
        }
        
        // Loading attribute (lazy loading)
        if (attrName === 'loading' && attrValue === 'lazy') {
          features.push({
            name: 'loading-lazy',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'Lazy loading attribute',
            confidence: 'high'
          });
        }
        
        // Decoding attribute
        if (attrName === 'decoding') {
          features.push({
            name: 'img-decoding',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'Image decoding attribute',
            confidence: 'high'
          });
        }
        
        // Referrerpolicy
        if (attrName === 'referrerpolicy') {
          features.push({
            name: 'referrer-policy',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'Referrer policy attribute',
            confidence: 'high'
          });
        }
        
        // Crossorigin
        if (attrName === 'crossorigin') {
          features.push({
            name: 'cors',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'CORS attribute',
            confidence: 'high'
          });
        }
        
        // Integrity (Subresource Integrity)
        if (attrName === 'integrity') {
          features.push({
            name: 'subresource-integrity',
            type: 'html',
            line: position.line + 1,
            column: position.character + 1,
            context: 'Subresource Integrity',
            confidence: 'high'
          });
        }
      });
    }
  }

  private mapCSSPropertyToFeature(property: string): string | null {
    return this.webFeaturesMapper?.mapCSSProperty(property) || null;
  }

  private mapCSSSelectorToFeatures(selector: string): string[] {
    return this.webFeaturesMapper?.mapCSSSelector(selector) || [];
  }

  private mapCSSAtRuleToFeature(atRule: string): string | null {
    return this.webFeaturesMapper?.mapCSSAtRule(atRule) || null;
  }

  private mapJSPropertyToFeature(property: string): string | null {
    return this.webFeaturesMapper?.mapJSProperty(property) || null;
  }

  private mapJSMethodToFeature(method: string): string | null {
    return this.webFeaturesMapper?.mapJSMethod(method) || null;
  }

  private mapJSConstructorToFeature(constructor: string): string | null {
    return this.webFeaturesMapper?.mapJSConstructor(constructor) || null;
  }

  private mapJSVariableToFeatures(variable: string): string[] {
    // For variables, we can detect modern syntax patterns
    const features: string[] = [];
    
    // Destructuring assignment
    if (variable.includes('{') && variable.includes('}')) {
      features.push('destructuring-assignment');
    }
    
    // Template literals
    if (variable.includes('`')) {
      features.push('template-literals');
    }
    
    // Arrow functions
    if (variable.includes('=>')) {
      features.push('arrow-functions');
    }
    
    return features;
  }

  private mapHTMLElementToFeature(element: string): string | null {
    return this.webFeaturesMapper?.mapHTMLElement(element) || null;
  }

  private mapHTMLAttributeToFeature(attribute: string): string | null {
    return this.webFeaturesMapper?.mapHTMLAttribute(attribute) || null;
  }
}

// Factory function for creating parser instance
export function createLanguageServerParser(): LanguageServerParser {
  return new LanguageServerParser();
}