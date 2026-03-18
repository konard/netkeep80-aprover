/**
 * aprover - МТС (Meta-Theory of Links) Theorem Prover
 *
 * This is the main entry point for using aprover as a library.
 * It re-exports all public APIs from the core modules.
 *
 * @example
 * ```typescript
 * import { parse, createProverState, verify } from './core'
 *
 * const state = createProverState()
 * const file = parse('∞ = ∞ -> ∞')
 * const result = verify(file.statements[0].expr, state)
 * console.log(result.success ? 'Proven!' : 'Failed')
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// AST Module - Abstract Syntax Tree types and utilities
// ============================================================================
export type {
  SourceLocation,
  ASTNode,
  LinkExpr,
  NotLinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  PowerExpr,
  SetExpr,
  InfinityExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  BracketExpr,
  Statement,
  File,
} from './ast'

export {
  isLinkExpr,
  isNotLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isPowerExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isBracketExpr,
  astToString,
} from './ast'

// ============================================================================
// AST Helpers Module - Shared AST node factory functions
// ============================================================================
export {
  makeLoc,
  makeInfinity,
  makeLink,
  makeNot,
  makeMale,
  makeFemale,
  makeAbitLit,
  makeStringLit,
  extractLinkChain,
} from './astHelpers'

// ============================================================================
// Utils Module - Shared utility functions
// ============================================================================
export type { FileParseOptions, FileToMtlOptions } from './utils'

export { escapeLabel, parseFileLines, fileToMtl } from './utils'

// ============================================================================
// Lexer Module - Lexical analysis
// ============================================================================
export type { TokenType, Token } from './lexer'

export { Lexer, LexerError, tokenize } from './lexer'

// ============================================================================
// Parser Module - Syntactic analysis
// ============================================================================
export type { ParseResult } from './parser'

export { Parser, ParseError, parse, parseWithRecovery, parseExpr } from './parser'

// ============================================================================
// Normalizer Module - AST normalization and canonicalization
// ============================================================================
export type { NormalizerOptions } from './normalizer'

export {
  NormalizationError,
  normalize,
  normalizeFile,
  toCanonicalString,
  astEqual,
  clearNormalizationCache,
  setNormalizationCacheEnabled,
  getNormalizationCacheStats,
  getNormalizationCache,
} from './normalizer'

// ============================================================================
// Prover Module - Theorem prover core
// ============================================================================
export type {
  Substitution,
  AxiomId,
  AxiomInfo,
  ProofStep,
  VerificationHint,
  ProofResult,
  ProvenEquality,
  ProvenImplication,
  ProverState,
} from './prover'

export {
  AXIOMS,
  createProverState,
  unify,
  applySubstitution,
  expandDefinitions,
  checkEquality,
  checkInequality,
  verify,
  addProvenEquality,
  addProvenFact,
  addProvenImplication,
  tryModusPonens,
  applyModusPonens,
} from './prover'

// ============================================================================
// Interactive Module - Interactive proof sessions
// ============================================================================
export type {
  ProofStrategy,
  StepType,
  AvailableStep,
  ProofSnapshot,
  StepResult,
  SessionStatus,
} from './interactive'

export {
  STRATEGY_DESCRIPTIONS,
  ProofSession,
  createProofSession,
  getSuggestedSteps,
  quickProof,
} from './interactive'

// ============================================================================
// Proof Export Module - Export proofs to various formats
// ============================================================================
export type {
  ExportFormat,
  LaTeXExportOptions,
  TextExportOptions,
  JSONExportOptions,
  DOTExportOptions,
  ProofExportData,
  ProofStepExport,
  AxiomExport,
  ProverStateExport,
} from './proofExport'

export {
  astToLaTeX,
  stringToLaTeX,
  exportToLaTeX,
  exportToText,
  exportToJSON,
  exportToDOT,
  exportProof,
  getExportExtension,
  getExportMimeType,
} from './proofExport'

// ============================================================================
// String Aнumber Module - String aнumber (.astr) support
// ============================================================================
export type { StringAnumOptions, ConversionStep, StringAnumStats } from './stringAnum'

export {
  StringAnumError,
  parseStringAnumLine,
  parseStringAnum,
  parseStringAnumExpr,
  toStringAnum,
  isStringAnumExpr,
  stringAnumToFormal,
  stringAnumFileToMtl,
  visualizeConversion,
  getStringAnumStats,
} from './stringAnum'

// ============================================================================
// Quaternary Aнumber Module - Quaternary aнumber (.anum) support
// ============================================================================
export type {
  AbitChar,
  QuatAnumOptions,
  ParsedAbit,
  ParsedContext,
  ValidationResult,
  QuatConversionStep,
  QuatAnumStats,
} from './quatAnum'

export {
  VALID_ABITS,
  ABIT_DEFINITIONS,
  QuatAnumError,
  isValidAbit,
  validateQuatAnum,
  cleanQuatAnum,
  parseAbitToAST,
  quatAnumToFormal,
  quatAnumToStringAnum,
  parseQuatAnumLine,
  parseQuatAnum,
  parseQuatAnumExpr,
  toQuatAnum,
  isQuatAnumExpr,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  isQuatAnumContent,
} from './quatAnum'

// ============================================================================
// File I/O Module - File operations
// ============================================================================
export type { FileMetadata, ExportResult, SupportedExtension } from './fileIO'

export {
  SUPPORTED_EXTENSIONS,
  readFileContent,
  isSupportedFile,
  isMtlFile,
  getFileExtension,
  getFilePreview,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  formatResultsForExport,
  formatAstForExport,
  generateMtlFromAst,
  downloadFile,
  openFileDialog,
} from './fileIO'

// ============================================================================
// Proof Cache Module - Caching verification results
// ============================================================================
export type { ProofCacheStats } from './proofCache'

export {
  getProofCache,
  getCachedProof,
  cacheProof,
  isProofCached,
  clearProofCache,
  setProofCacheEnabled,
  isProofCacheEnabled,
  getProofCacheStats,
  setProofCacheMaxSize,
  generateStateSignature,
} from './proofCache'

// ============================================================================
// Proof Metrics Module - Proof verification metrics and analysis
// ============================================================================
export type {
  ProofComplexity,
  ProofMetrics,
  SerializableProofMetrics,
  MetricsCollector,
} from './proofMetrics'

export {
  classifyComplexity,
  createMetricsCollector,
  metricsToSerializable,
  formatMetricsSummary,
  aggregateMetrics,
} from './proofMetrics'

// ============================================================================
// Link Graph Module - Visualization of link formulas as directed graphs
// ============================================================================
export type {
  LinkGraphNodeType,
  LinkGraphNode,
  LinkGraphEdgeType,
  LinkGraphEdge,
  LinkGraph,
} from './linkGraph'

export {
  projectToGraph,
  projectStatementsToGraph,
  toCytoscapeElements,
  linkGraphToDOT,
} from './linkGraph'
