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
export {
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
export {
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
export {
  readFileContent,
  isSupportedFile,
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
  downloadFile,
  openFileDialog,
} from './fileIO'
