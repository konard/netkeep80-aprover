/**
 * Normalizer for МТС (Meta-Theory of Links) AST
 *
 * Transformations:
 * 1. Desugaring:
 *    - a !-> b → !(a -> b)
 *    - a^n → (...((a -> a) -> a) ... -> a) (n times)
 *
 * 2. Canonical form:
 *    - !!x → x (double negation elimination)
 *    - !(♂x) → x♀ (inversion duality)
 *    - !(x♀) → ♂x (inversion duality)
 *
 * 3. Well-formedness checks:
 *    - Guarded recursion: recursive mentions allowed only under ->
 */

import type {
  ASTNode,
  LinkExpr,
  DefExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  Statement,
  File,
} from './ast'
import {
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
} from './ast'

/**
 * Cache for normalization results.
 * Uses canonical string representation of AST as key.
 *
 * Performance optimization for:
 * - Large expressions with repeated subexpressions
 * - Multiple verification passes over the same input
 */
class NormalizationCache {
  private cache: Map<string, ASTNode> = new Map()
  private maxSize: number
  private hits: number = 0
  private misses: number = 0
  private enabled: boolean = true

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get cached result for a canonical string key
   */
  get(key: string): ASTNode | undefined {
    if (!this.enabled) return undefined

    const result = this.cache.get(key)
    if (result) {
      this.hits++
    } else {
      this.misses++
    }
    return result
  }

  /**
   * Store normalized result in cache
   */
  set(key: string, value: ASTNode): void {
    if (!this.enabled) return

    // Evict oldest entries if cache is full (simple LRU approximation)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, value)
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }
}

/** Global normalization cache instance */
const normalizationCache = new NormalizationCache()

/**
 * Get the global normalization cache instance
 * Useful for statistics and cache management
 */
export function getNormalizationCache(): NormalizationCache {
  return normalizationCache
}

/**
 * Clear the normalization cache
 */
export function clearNormalizationCache(): void {
  normalizationCache.clear()
}

/**
 * Enable or disable normalization caching
 */
export function setNormalizationCacheEnabled(enabled: boolean): void {
  normalizationCache.setEnabled(enabled)
}

/**
 * Get normalization cache statistics
 */
export function getNormalizationCacheStats(): {
  size: number
  hits: number
  misses: number
  hitRate: number
} {
  return normalizationCache.getStats()
}

/** Normalization error */
export class NormalizationError extends Error {
  constructor(
    message: string,
    public node: ASTNode
  ) {
    const loc = node.loc
    const locStr = loc ? ` at ${loc.start.line}:${loc.start.column}` : ''
    super(`Normalization error${locStr}: ${message}`)
    this.name = 'NormalizationError'
  }
}

/** Normalizer options */
export interface NormalizerOptions {
  /** Desugar !-> to !(a -> b) */
  desugarNotLink?: boolean
  /** Expand power operator */
  expandPower?: boolean
  /** Apply canonical form rules */
  canonicalize?: boolean
  /** Check guarded recursion */
  checkGuardedRecursion?: boolean
}

const defaultOptions: NormalizerOptions = {
  desugarNotLink: true,
  expandPower: true,
  canonicalize: true,
  checkGuardedRecursion: true,
}

/** Deep clone AST node */
function cloneNode<T extends ASTNode>(node: T): T {
  return JSON.parse(JSON.stringify(node))
}

/** Create link node */
function makeLink(left: ASTNode, right: ASTNode): LinkExpr {
  return {
    type: 'Link',
    left,
    right,
    loc: left.loc && right.loc ? { start: left.loc.start, end: right.loc.end } : undefined,
  }
}

/** Create not node */
function makeNot(operand: ASTNode): NotExpr {
  return {
    type: 'Not',
    operand,
    loc: operand.loc,
  }
}

/** Create male node */
function makeMale(operand: ASTNode): MaleExpr {
  return {
    type: 'Male',
    operand,
    loc: operand.loc,
  }
}

/** Create female node */
function makeFemale(operand: ASTNode): FemaleExpr {
  return {
    type: 'Female',
    operand,
    loc: operand.loc,
  }
}

/**
 * Expand power: a^n → (...((a -> a) -> a) ... -> a)
 * a^1 = a
 * a^2 = (a -> a)
 * a^3 = ((a -> a) -> a)
 * a^n = (a^(n-1) -> a)
 */
function expandPower(base: ASTNode, exponent: number): ASTNode {
  if (exponent < 1) {
    throw new NormalizationError('Power exponent must be >= 1', base)
  }
  if (exponent === 1) {
    return cloneNode(base)
  }

  let result = makeLink(cloneNode(base), cloneNode(base))
  for (let i = 3; i <= exponent; i++) {
    result = makeLink(result, cloneNode(base))
  }
  return result
}

/**
 * Check if identifier appears in node (for guarded recursion check)
 */
function containsIdent(node: ASTNode, name: string, guarded: boolean): boolean {
  if (isIdentExpr(node)) {
    if (node.name === name && !guarded) {
      return true
    }
    return false
  }

  if (isLinkExpr(node)) {
    // Under -> the recursion becomes guarded
    return containsIdent(node.left, name, true) || containsIdent(node.right, name, true)
  }

  if (isNotLinkExpr(node)) {
    return containsIdent(node.left, name, guarded) || containsIdent(node.right, name, guarded)
  }

  if (isMaleExpr(node) || isFemaleExpr(node) || isNotExpr(node)) {
    return containsIdent(node.operand, name, guarded)
  }

  if (isPowerExpr(node)) {
    return containsIdent(node.base, name, guarded)
  }

  if (isSetExpr(node)) {
    return node.elements.some(el => containsIdent(el, name, guarded))
  }

  if (isDefExpr(node)) {
    return containsIdent(node.name, name, guarded) || containsIdent(node.form, name, guarded)
  }

  if (isEqExpr(node) || isNeqExpr(node)) {
    return containsIdent(node.left, name, guarded) || containsIdent(node.right, name, guarded)
  }

  return false
}

/**
 * Check guarded recursion in definition
 */
function checkGuardedRecursion(def: DefExpr): void {
  if (!isIdentExpr(def.name)) {
    return // Only check simple identifier definitions
  }

  const name = def.name.name
  if (containsIdent(def.form, name, false)) {
    throw new NormalizationError(
      `Unguarded recursion: '${name}' appears in its definition outside of '->' constructor`,
      def
    )
  }
}

/**
 * Normalize a single node
 */
function normalizeNode(node: ASTNode, options: NormalizerOptions): ASTNode {
  // First, recursively normalize children
  let normalized: ASTNode

  if (isLinkExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isNotLinkExpr(node)) {
    // Desugar: a !-> b → !(a -> b)
    if (options.desugarNotLink) {
      const link = makeLink(normalizeNode(node.left, options), normalizeNode(node.right, options))
      normalized = makeNot(link)
    } else {
      normalized = {
        ...node,
        left: normalizeNode(node.left, options),
        right: normalizeNode(node.right, options),
      }
    }
  } else if (isDefExpr(node)) {
    normalized = {
      ...node,
      name: normalizeNode(node.name, options),
      form: normalizeNode(node.form, options),
    }
    if (options.checkGuardedRecursion) {
      checkGuardedRecursion(normalized as DefExpr)
    }
  } else if (isEqExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isNeqExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isMaleExpr(node)) {
    normalized = {
      ...node,
      operand: normalizeNode(node.operand, options),
    }
  } else if (isFemaleExpr(node)) {
    normalized = {
      ...node,
      operand: normalizeNode(node.operand, options),
    }
  } else if (isNotExpr(node)) {
    normalized = {
      ...node,
      operand: normalizeNode(node.operand, options),
    }
  } else if (isPowerExpr(node)) {
    // Expand power: a^n → (...((a -> a) -> a) ... -> a)
    if (options.expandPower) {
      const base = normalizeNode(node.base, options)
      normalized = expandPower(base, node.exponent)
    } else {
      normalized = {
        ...node,
        base: normalizeNode(node.base, options),
      }
    }
  } else if (isSetExpr(node)) {
    normalized = {
      ...node,
      elements: node.elements.map(el => normalizeNode(el, options)),
    }
  } else {
    // Leaf nodes: Infinity, Num, Identifier, AbitLit, StringLit, Bracket
    normalized = node
  }

  // Apply canonical form rules
  if (options.canonicalize) {
    normalized = canonicalize(normalized)
  }

  return normalized
}

/**
 * Apply canonical form rules:
 * - !!x → x
 * - !(♂x) → x♀
 * - !(x♀) → ♂x
 */
function canonicalize(node: ASTNode): ASTNode {
  if (!isNotExpr(node)) {
    return node
  }

  const operand = node.operand

  // !!x → x
  if (isNotExpr(operand)) {
    return operand.operand
  }

  // !(♂x) → x♀
  if (isMaleExpr(operand)) {
    return makeFemale(operand.operand)
  }

  // !(x♀) → ♂x
  if (isFemaleExpr(operand)) {
    return makeMale(operand.operand)
  }

  return node
}

/**
 * Generate a cache key for an AST node with given options.
 * The key includes the options hash to differentiate different normalization modes.
 */
function generateCacheKey(node: ASTNode, opts: NormalizerOptions): string {
  // Create options signature (only include non-default values to save space)
  const optsSig = [
    opts.desugarNotLink ? '' : 'D0',
    opts.expandPower ? '' : 'P0',
    opts.canonicalize ? '' : 'C0',
    opts.checkGuardedRecursion ? '' : 'G0',
  ]
    .filter(Boolean)
    .join('')

  // Use toCanonicalString for the node structure (pre-normalization)
  const nodeKey = toCanonicalString(node)

  return optsSig ? `${optsSig}:${nodeKey}` : nodeKey
}

/**
 * Normalize AST
 *
 * Uses caching to improve performance for repeated normalizations
 * of the same expression. Cache is keyed by the canonical string
 * representation of the input AST and normalization options.
 */
export function normalize(node: ASTNode, options: Partial<NormalizerOptions> = {}): ASTNode {
  const opts = { ...defaultOptions, ...options }

  // Try to get from cache first
  if (normalizationCache.isEnabled()) {
    const cacheKey = generateCacheKey(node, opts)
    const cached = normalizationCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Normalize and cache the result
    const result = normalizeNode(node, opts)
    normalizationCache.set(cacheKey, result)
    return result
  }

  // Caching disabled, just normalize
  return normalizeNode(node, opts)
}

/**
 * Normalize file
 *
 * Each statement expression is normalized using the cached normalize function.
 */
export function normalizeFile(file: File, options: Partial<NormalizerOptions> = {}): File {
  return {
    type: 'File',
    statements: file.statements.map(
      stmt =>
        ({
          type: 'Statement',
          expr: normalize(stmt.expr, options),
          loc: stmt.loc,
        }) as Statement
    ),
    loc: file.loc,
  }
}

/**
 * Convert AST to canonical string form (for comparison)
 */
export function toCanonicalString(node: ASTNode): string {
  if (isLinkExpr(node)) {
    return `(${toCanonicalString(node.left)}->${toCanonicalString(node.right)})`
  }
  if (isNotLinkExpr(node)) {
    return `(${toCanonicalString(node.left)}!->${toCanonicalString(node.right)})`
  }
  if (isDefExpr(node)) {
    return `(${toCanonicalString(node.name)}:${toCanonicalString(node.form)})`
  }
  if (isEqExpr(node)) {
    return `(${toCanonicalString(node.left)}=${toCanonicalString(node.right)})`
  }
  if (isNeqExpr(node)) {
    return `(${toCanonicalString(node.left)}!=${toCanonicalString(node.right)})`
  }
  if (isMaleExpr(node)) {
    return `♂${toCanonicalString(node.operand)}`
  }
  if (isFemaleExpr(node)) {
    return `${toCanonicalString(node.operand)}♀`
  }
  if (isNotExpr(node)) {
    return `!${toCanonicalString(node.operand)}`
  }
  if (isPowerExpr(node)) {
    return `${toCanonicalString(node.base)}^${node.exponent}`
  }
  if (isSetExpr(node)) {
    const sorted = [...node.elements].map(toCanonicalString).sort()
    return `{${sorted.join(',')}}`
  }
  if (isInfinityExpr(node)) {
    return '∞'
  }
  if (isNumExpr(node)) {
    return String(node.value)
  }
  if (isIdentExpr(node)) {
    return node.name
  }
  if (isAbitLitExpr(node)) {
    return `'${node.value}'`
  }
  if (isStringLitExpr(node)) {
    return `"${node.value}"`
  }
  if (isBracketExpr(node)) {
    return node.side === 'left' ? '[' : ']'
  }
  return `<unknown:${node.type}>`
}

/**
 * Check structural equality of two AST nodes
 */
export function astEqual(a: ASTNode, b: ASTNode): boolean {
  return toCanonicalString(a) === toCanonicalString(b)
}
