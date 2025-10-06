import * as webFeatures from 'web-features';
import { DetectedFeature } from './language-server';

interface FeatureMapping {
  cssProperties: Map<string, string>;
  cssSelectors: Map<string, string>;
  cssAtRules: Map<string, string>;
  jsAPIs: Map<string, string>;
  jsConstructors: Map<string, string>;
  htmlElements: Map<string, string>;
  htmlAttributes: Map<string, string>;
}

interface EnhancedMapping {
  compatFeature: string;
  confidence: 'high' | 'medium' | 'low';
  pattern?: RegExp;
  validator?: (context: string) => boolean;
}

export class WebFeaturesMapper {
  private mappings: FeatureMapping;
  private enhancedMappings: Map<string, EnhancedMapping[]> = new Map();
  private initialized = false;

  constructor() {
    this.mappings = {
      cssProperties: new Map(),
      cssSelectors: new Map(),
      cssAtRules: new Map(),
      jsAPIs: new Map(),
      jsConstructors: new Map(),
      htmlElements: new Map(),
      htmlAttributes: new Map()
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing web-features mappings...');
    const startTime = Date.now();

    await this.buildCSSMappings();
    await this.buildJSMappings();
    await this.buildHTMLMappings();
    await this.buildEnhancedMappings();

    this.initialized = true;
    console.log(`Mappings initialized in ${Date.now() - startTime}ms`);
    console.log(`   CSS Properties: ${this.mappings.cssProperties.size}`);
    console.log(`   CSS Selectors: ${this.mappings.cssSelectors.size}`);
    console.log(`   CSS At-Rules: ${this.mappings.cssAtRules.size}`);
    console.log(`   JS APIs: ${this.mappings.jsAPIs.size}`);
    console.log(`   JS Constructors: ${this.mappings.jsConstructors.size}`);
    console.log(`   HTML Elements: ${this.mappings.htmlElements.size}`);
    console.log(`   HTML Attributes: ${this.mappings.htmlAttributes.size}`);
  }

  private async buildCSSMappings(): Promise<void> {
    Object.entries(webFeatures.features).forEach(([featureId, feature]) => {
      if (!('compat_features' in feature) || !feature.compat_features) return;

      feature.compat_features.forEach((compatFeature: string) => {
        if (compatFeature.startsWith('css.properties.')) {
          const property = compatFeature.replace('css.properties.', '').replace(/_/g, '-');
          this.mappings.cssProperties.set(property, featureId);
        }
        
        if (compatFeature.startsWith('css.selectors.')) {
          const selector = compatFeature.replace('css.selectors.', '');
          this.mappings.cssSelectors.set(selector, featureId);
        }
        
        if (compatFeature.startsWith('css.at-rules.')) {
          const atRule = compatFeature.replace('css.at-rules.', '').replace(/_/g, '-');
          this.mappings.cssAtRules.set(atRule, featureId);
        }
      });
    });
  }

  private async buildJSMappings(): Promise<void> {
    Object.entries(webFeatures.features).forEach(([featureId, feature]) => {
      if (!('compat_features' in feature) || !feature.compat_features) return;

      feature.compat_features.forEach((compatFeature: string) => {
        // Handle JavaScript APIs (methods, properties, interfaces)
        if (compatFeature.startsWith('api.')) {
          const apiPath = compatFeature.replace('api.', '');
          
          // Handle top-level APIs (like fetch, requestAnimationFrame)
          if (!apiPath.includes('.')) {
            // Check if it's a constructor (starts with capital letter) or function (lowercase)
            if (apiPath[0] === apiPath[0].toUpperCase()) {
              // Constructor: IntersectionObserver, ResizeObserver, etc.
              this.mappings.jsConstructors.set(apiPath, featureId);
            } else {
              // Function: fetch, requestAnimationFrame, etc.
              this.mappings.jsAPIs.set(apiPath, featureId);
            }
          } else {
            // Extract method/property patterns (e.g., api.Document.querySelector -> document.querySelector)
            const parts = apiPath.split('.');
            if (parts.length >= 2) {
              const objectName = parts[0].toLowerCase();
              const memberName = parts.slice(1).join('.').toLowerCase();
              const fullPath = `${objectName}.${memberName}`;
              this.mappings.jsAPIs.set(fullPath, featureId);
              
              // Also map just the member name for flexible matching
              this.mappings.jsAPIs.set(memberName, featureId);
            }
          }
        }
      });
    });
  }

  private async buildHTMLMappings(): Promise<void> {
    Object.entries(webFeatures.features).forEach(([featureId, feature]) => {
      if (!('compat_features' in feature) || !feature.compat_features) return;

      feature.compat_features.forEach((compatFeature: string) => {
        // Handle HTML elements
        if (compatFeature.startsWith('html.elements.')) {
          const element = compatFeature.replace('html.elements.', '');
          this.mappings.htmlElements.set(element, featureId);
        }
        
        // Handle HTML attributes (global and element-specific)
        if (compatFeature.startsWith('html.global_attributes.')) {
          const attribute = compatFeature.replace('html.global_attributes.', '');
          this.mappings.htmlAttributes.set(attribute, featureId);
        }
        
        // Handle element-specific attributes
        if (compatFeature.includes('.attributes.')) {
          const parts = compatFeature.split('.attributes.');
          if (parts.length === 2) {
            const attribute = parts[1];
            this.mappings.htmlAttributes.set(attribute, featureId);
          }
        }
      });
    });
  }

  private async buildEnhancedMappings(): Promise<void> {
    // CSS Selector patterns
    this.enhancedMappings.set(':has(', [{
      compatFeature: 'css-has',
      confidence: 'high',
      pattern: /:has\(/
    }]);

    this.enhancedMappings.set('::backdrop', [{
      compatFeature: 'dialog',
      confidence: 'high',
      pattern: /::backdrop/
    }]);

    this.enhancedMappings.set('@container', [{
      compatFeature: 'css-container-queries',
      confidence: 'high',
      pattern: /@container/
    }]);

    // JavaScript API patterns
    this.enhancedMappings.set('IntersectionObserver', [{
      compatFeature: 'intersectionobserver',
      confidence: 'high',
      pattern: /new\s+IntersectionObserver/
    }]);

    this.enhancedMappings.set('ResizeObserver', [{
      compatFeature: 'resizeobserver',
      confidence: 'high',
      pattern: /new\s+ResizeObserver/
    }]);

    this.enhancedMappings.set('fetch(', [{
      compatFeature: 'fetch',
      confidence: 'high',
      pattern: /fetch\s*\(/
    }]);

    // HTML element patterns
    this.enhancedMappings.set('<dialog', [{
      compatFeature: 'dialog',
      confidence: 'high',
      pattern: /<dialog/i
    }]);

    this.enhancedMappings.set('<details', [{
      compatFeature: 'details',
      confidence: 'high',
      pattern: /<details/i
    }]);
  }

  mapCSSProperty(property: string): string | null {
    if (!this.initialized) {
      console.warn('WebFeaturesMapper not initialized');
      return null;
    }
    
    // Direct mapping
    const directMatch = this.mappings.cssProperties.get(property);
    if (directMatch) return directMatch;
    
    // Vendor prefix handling
    const unprefixed = property.replace(/^-(?:webkit|moz|ms|o)-/, '');
    return this.mappings.cssProperties.get(unprefixed) || null;
  }

  mapCSSSelector(selector: string): string[] {
    if (!this.initialized) return [];
    
    const features: string[] = [];
    
    // Check enhanced mappings with patterns
    this.enhancedMappings.forEach((mappings, key) => {
      mappings.forEach(mapping => {
        if (mapping.pattern && mapping.pattern.test(selector)) {
          features.push(mapping.compatFeature);
        }
      });
    });
    
    // Check direct mappings
    const directMatch = this.mappings.cssSelectors.get(selector);
    if (directMatch) features.push(directMatch);
    
    return [...new Set(features)]; // Remove duplicates
  }

  mapCSSAtRule(atRule: string): string | null {
    if (!this.initialized) return null;
    
    // Check enhanced mappings first
    const enhanced = this.enhancedMappings.get(`@${atRule}`);
    if (enhanced && enhanced.length > 0) {
      return enhanced[0].compatFeature;
    }
    
    return this.mappings.cssAtRules.get(atRule) || null;
  }

  mapJSProperty(propertyAccess: string): string | null {
    if (!this.initialized) return null;
    
    // Try direct mapping
    const directMatch = this.mappings.jsAPIs.get(propertyAccess.toLowerCase());
    if (directMatch) return directMatch;
    
    // Try pattern matching for complex expressions
    const enhanced = this.findEnhancedJSMapping(propertyAccess);
    return enhanced;
  }

  mapJSMethod(methodCall: string): string | null {
    if (!this.initialized) return null;
    
    // Extract method name from call expression
    const methodMatch = methodCall.match(/(\w+(?:\.\w+)*)\s*\(/);
    if (methodMatch) {
      const methodPath = methodMatch[1].toLowerCase();
      const directMatch = this.mappings.jsAPIs.get(methodPath);
      if (directMatch) return directMatch;
    }
    
    // Check enhanced mappings
    return this.findEnhancedJSMapping(methodCall);
  }

  mapJSConstructor(constructor: string): string | null {
    if (!this.initialized) return null;
    
    // Extract constructor name
    const constructorMatch = constructor.match(/new\s+(\w+)/);
    if (constructorMatch) {
      const constructorName = constructorMatch[1];
      const directMatch = this.mappings.jsConstructors.get(constructorName);
      if (directMatch) return directMatch;
    }
    
    return this.findEnhancedJSMapping(constructor);
  }

  private findEnhancedJSMapping(jsCode: string): string | null {
    for (const [key, mappings] of this.enhancedMappings) {
      for (const mapping of mappings) {
        if (mapping.pattern && mapping.pattern.test(jsCode)) {
          return mapping.compatFeature;
        }
      }
    }
    return null;
  }

  mapHTMLElement(element: string): string | null {
    if (!this.initialized) return null;
    
    const directMatch = this.mappings.htmlElements.get(element.toLowerCase());
    if (directMatch) return directMatch;
    
    // Check enhanced mappings
    const enhanced = this.enhancedMappings.get(`<${element.toLowerCase()}`);
    if (enhanced && enhanced.length > 0) {
      return enhanced[0].compatFeature;
    }
    
    return null;
  }

  mapHTMLAttribute(attribute: string): string | null {
    if (!this.initialized) return null;
    
    return this.mappings.htmlAttributes.get(attribute.toLowerCase()) || null;
  }

  detectFeaturesInContext(content: string, language: 'css' | 'js' | 'html'): DetectedFeature[] {
    if (!this.initialized) return [];
    
    const features: DetectedFeature[] = [];
    const lines = content.split('\n');
    
    this.enhancedMappings.forEach((mappings, key) => {
      mappings.forEach(mapping => {
        if (mapping.pattern) {
          const matches = content.matchAll(new RegExp(mapping.pattern.source, 'gi'));
          for (const match of matches) {
            if (match.index !== undefined) {
              const lineIndex = content.substring(0, match.index).split('\n').length - 1;
              const columnIndex = match.index - content.lastIndexOf('\n', match.index - 1) - 1;
              
              features.push({
                name: mapping.compatFeature,
                type: language,
                line: lineIndex + 1,
                column: columnIndex + 1,
                context: match[0],
                confidence: mapping.confidence
              });
            }
          }
        }
      });
    });
    
    return features;
  }

  getStats() {
    return {
      initialized: this.initialized,
      cssProperties: this.mappings.cssProperties.size,
      cssSelectors: this.mappings.cssSelectors.size,
      cssAtRules: this.mappings.cssAtRules.size,
      jsAPIs: this.mappings.jsAPIs.size,
      jsConstructors: this.mappings.jsConstructors.size,
      htmlElements: this.mappings.htmlElements.size,
      htmlAttributes: this.mappings.htmlAttributes.size,
      enhancedMappings: this.enhancedMappings.size
    };
  }
}

// Singleton instance
let mapperInstance: WebFeaturesMapper | null = null;

export async function getWebFeaturesMapper(): Promise<WebFeaturesMapper> {
  if (!mapperInstance) {
    mapperInstance = new WebFeaturesMapper();
    await mapperInstance.initialize();
  }
  return mapperInstance;
}