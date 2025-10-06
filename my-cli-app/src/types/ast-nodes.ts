/**
 * Type definitions for AST nodes from vscode-css-languageservice and vscode-html-languageservice
 * These interfaces provide type safety for parsing operations
 */


export enum CSSNodeType {
  Undefined = 0,
  Identifier = 1,
  Stylesheet = 2,
  Ruleset = 3,
  Selector = 4,
  SimpleSelector = 5,
  SelectorInterpolation = 6,
  SelectorCombinator = 7,
  SelectorCombinatorParent = 8,
  SelectorCombinatorSibling = 9,
  SelectorCombinatorAllSiblings = 10,
  SelectorCombinatorShadowPiercingDescendant = 11,
  Page = 12,
  PageBoxMarginBox = 13,
  ClassSelector = 14,
  IdentifierSelector = 15,
  ElementNameSelector = 16,
  PseudoSelector = 17,
  AttributeSelector = 18,
  Declaration = 19,
  Declarations = 20,
  Property = 21,
  Expression = 22,
  BinaryExpression = 23,
  Term = 24,
  Operator = 25,
  Value = 26,
  StringLiteral = 27,
  URILiteral = 28,
  EscapedValue = 29,
  Function = 30,
  NumericValue = 31,
  HexColorValue = 32,
  MixinDeclaration = 33,
  MixinReference = 34,
  VariableName = 35,
  VariableDeclaration = 36,
  Prio = 37,
  Interpolation = 38,
  NestedProperties = 39,
  ExtendsReference = 40,
  SelectorPlaceholder = 41,
  Debug = 42,
  If = 43,
  Else = 44,
  For = 45,
  Each = 46,
  While = 47,
  MixinContentReference = 48,
  MixinContentDeclaration = 49,
  Media = 50,
  Keyframe = 51,
  FontFace = 52,
  Import = 53,
  Namespace = 54,
  Invocation = 55,
  FunctionDeclaration = 56,
  ReturnStatement = 57,
  MediaQuery = 58,
  MediaCondition = 59,
  MediaFeature = 60,
  FunctionParameter = 61,
  FunctionArgument = 62,
  KeyframeSelector = 63,
  ViewPort = 64,
  Document = 65,
  AtApplyRule = 66,
  CustomPropertyDeclaration = 67,
  CustomPropertySet = 68,
  ListEntry = 69,
  Supports = 70,
  SupportsCondition = 71,
  NamespacePrefix = 72,
  GridLine = 73,
  Plugin = 74,
  UnknownAtRule = 75,
  Use = 76,
  ModuleConfiguration = 77,
  Forward = 78,
  ForwardVisibility = 79,
  Module = 80,
  UnicodeRange = 81,
  Layer = 82,
  LayerNameList = 83,
  LayerName = 84,
  PropertyAtRule = 85,
  MozDocument = 86,
  Container = 88,
  ContainerQuery = 87,
  Scope = 89
}

export interface CSSPosition {
  line: number;
  character: number;
}

export interface CSSNode {
  type: CSSNodeType;
  offset: number;
  length: number;
  end: number;
  parent?: CSSNode;
  children?: CSSNode[];
  getText?(): string;
  getChildren?(): CSSNode[];
}

export interface CSSStylesheet extends CSSNode {
  type: CSSNodeType.Stylesheet;
  children: CSSNode[];
}

export interface CSSRuleset extends CSSNode {
  type: CSSNodeType.Ruleset;
  selectors?: CSSNode;
  declarations?: CSSNode;
}

export interface CSSDeclaration extends CSSNode {
  type: CSSNodeType.Declaration;
  property?: CSSNode;
  value?: CSSNode;
  colonPosition?: number;
  semicolonPosition?: number;
}

export interface CSSProperty extends CSSNode {
  type: CSSNodeType.Property;
}

export interface CSSAtRule extends CSSNode {
  type: CSSNodeType.Media | CSSNodeType.Keyframe | CSSNodeType.Container | CSSNodeType.Supports | CSSNodeType.Layer;
  name?: string;
}

export interface CSSSelector extends CSSNode {
  type: CSSNodeType.Selector;
}


export interface HTMLPosition {
  line: number;
  character: number;
}

export interface HTMLNode {
  tag?: string;
  tagLowerCase?: string;
  start: number;
  startTagEnd?: number;
  end: number;
  endTagStart?: number;
  closed: boolean;
  children?: HTMLNode[];
  parent?: HTMLNode;
  attributes?: Record<string, string | null>;
  attributeQuotes?: Record<string, '"' | "'" | undefined>;
}

export interface HTMLDocument {
  roots: HTMLNode[];
  findNodeBefore(offset: number): HTMLNode | undefined;
  findNodeAt(offset: number): HTMLNode | undefined;
}


/**
 * Helper type guards for CSS nodes
 */
export function isCSSRuleset(node: CSSNode): node is CSSRuleset {
  return node.type === CSSNodeType.Ruleset;
}

export function isCSSDeclaration(node: CSSNode): node is CSSDeclaration {
  return node.type === CSSNodeType.Declaration;
}

export function isCSSProperty(node: CSSNode): node is CSSProperty {
  return node.type === CSSNodeType.Property;
}

export function isCSSAtRule(node: CSSNode): node is CSSAtRule {
  return (
    node.type === CSSNodeType.Media ||
    node.type === CSSNodeType.Keyframe ||
    node.type === CSSNodeType.Container ||
    node.type === CSSNodeType.Supports ||
    node.type === CSSNodeType.Layer
  );
}

export function isCSSSelector(node: CSSNode): node is CSSSelector {
  return node.type === CSSNodeType.Selector;
}

/**
 * Helper type guards for HTML nodes
 */
export function isHTMLElement(node: HTMLNode): node is HTMLNode & { tag: string } {
  return node.tag !== undefined;
}

export function hasAttributes(node: HTMLNode): node is HTMLNode & { attributes: Record<string, string | null> } {
  return node.attributes !== undefined && Object.keys(node.attributes).length > 0;
}
