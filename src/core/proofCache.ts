/**
 * Proof Cache for МТС (Meta-Theory of Links) Prover
 *
 * Caches verification results to improve performance when:
 * - Verifying the same expression multiple times
 * - Re-running verification after minor edits
 * - Batch processing with repeated subexpressions
 *
 * Uses LRU (Least Recently Used) eviction strategy.
 */

import type { ASTNode } from './ast'
import type { ProofResult } from './prover'
import { toCanonicalString } from './normalizer'

/**
 * Cache statistics
 */
export interface ProofCacheStats {
  /** Current number of cached entries */
  size: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Hit rate (hits / total requests) */
  hitRate: number
  /** Maximum cache size */
  maxSize: number
  /** Whether caching is enabled */
  enabled: boolean
}

/**
 * Cached proof entry with metadata
 */
interface CacheEntry {
  /** The proof result */
  result: ProofResult
  /** Timestamp when cached */
  cachedAt: number
  /** Number of times this entry was accessed */
  accessCount: number
  /** Last access timestamp */
  lastAccessedAt: number
}

/**
 * Proof Cache implementation with LRU eviction
 *
 * Performance optimizations:
 * - Uses canonical string as key for fast lookup
 * - LRU eviction keeps frequently used results in cache
 * - Optional state signature for context-dependent caching
 */
class ProofCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number
  private hits: number = 0
  private misses: number = 0
  private enabled: boolean = true

  constructor(maxSize: number = 500) {
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
   * Set maximum cache size
   * If new size is smaller, evicts oldest entries
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize
    this.evictToSize(maxSize)
  }

  /**
   * Get maximum cache size
   */
  getMaxSize(): number {
    return this.maxSize
  }

  /**
   * Generate cache key for an expression
   * Optionally includes state signature for context-dependent caching
   */
  private generateKey(expr: ASTNode, stateSignature?: string): string {
    const exprKey = toCanonicalString(expr)
    return stateSignature ? `${stateSignature}:${exprKey}` : exprKey
  }

  /**
   * Get cached proof result for an expression
   *
   * @param expr - The AST expression to look up
   * @param stateSignature - Optional state signature for context-dependent lookup
   * @returns ProofResult if found, undefined otherwise
   */
  get(expr: ASTNode, stateSignature?: string): ProofResult | undefined {
    if (!this.enabled) {
      return undefined
    }

    const key = this.generateKey(expr, stateSignature)
    const entry = this.cache.get(key)

    if (entry) {
      this.hits++
      // Update access metadata for LRU
      entry.accessCount++
      entry.lastAccessedAt = Date.now()
      return entry.result
    }

    this.misses++
    return undefined
  }

  /**
   * Store proof result in cache
   *
   * @param expr - The AST expression
   * @param result - The proof result to cache
   * @param stateSignature - Optional state signature for context-dependent caching
   */
  set(expr: ASTNode, result: ProofResult, stateSignature?: string): void {
    if (!this.enabled) {
      return
    }

    const key = this.generateKey(expr, stateSignature)

    // Check if already exists (update in place)
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!
      entry.result = result
      entry.accessCount++
      entry.lastAccessedAt = Date.now()
      return
    }

    // Evict if necessary before adding
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    // Add new entry
    const now = Date.now()
    this.cache.set(key, {
      result,
      cachedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    })
  }

  /**
   * Check if an expression is cached
   */
  has(expr: ASTNode, stateSignature?: string): boolean {
    if (!this.enabled) {
      return false
    }
    const key = this.generateKey(expr, stateSignature)
    return this.cache.has(key)
  }

  /**
   * Delete a specific entry from cache
   */
  delete(expr: ASTNode, stateSignature?: string): boolean {
    const key = this.generateKey(expr, stateSignature)
    return this.cache.delete(key)
  }

  /**
   * Clear all cached entries and reset statistics
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Clear only the cache entries, preserving statistics
   */
  clearEntries(): void {
    this.cache.clear()
  }

  /**
   * Reset only the statistics, preserving cache entries
   */
  resetStats(): void {
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache statistics
   */
  getStats(): ProofCacheStats {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      maxSize: this.maxSize,
      enabled: this.enabled,
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Evict entries until cache size is at or below target
   */
  private evictToSize(targetSize: number): void {
    while (this.cache.size > targetSize) {
      this.evictLRU()
    }
  }

  /**
   * Get all cached expression keys (for debugging/inspection)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache entry metadata (for debugging/inspection)
   */
  getEntryMetadata(
    expr: ASTNode,
    stateSignature?: string
  ): { cachedAt: number; accessCount: number; lastAccessedAt: number } | undefined {
    const key = this.generateKey(expr, stateSignature)
    const entry = this.cache.get(key)
    if (entry) {
      return {
        cachedAt: entry.cachedAt,
        accessCount: entry.accessCount,
        lastAccessedAt: entry.lastAccessedAt,
      }
    }
    return undefined
  }
}

/** Global proof cache instance */
const proofCache = new ProofCache()

/**
 * Get the global proof cache instance
 */
export function getProofCache(): ProofCache {
  return proofCache
}

/**
 * Get cached proof result for an expression
 *
 * @param expr - The AST expression to look up
 * @param stateSignature - Optional state signature for context-dependent lookup
 * @returns ProofResult if found, undefined otherwise
 */
export function getCachedProof(expr: ASTNode, stateSignature?: string): ProofResult | undefined {
  return proofCache.get(expr, stateSignature)
}

/**
 * Store proof result in cache
 *
 * @param expr - The AST expression
 * @param result - The proof result to cache
 * @param stateSignature - Optional state signature for context-dependent caching
 */
export function cacheProof(expr: ASTNode, result: ProofResult, stateSignature?: string): void {
  proofCache.set(expr, result, stateSignature)
}

/**
 * Check if an expression is cached
 */
export function isProofCached(expr: ASTNode, stateSignature?: string): boolean {
  return proofCache.has(expr, stateSignature)
}

/**
 * Clear the proof cache
 */
export function clearProofCache(): void {
  proofCache.clear()
}

/**
 * Enable or disable proof caching
 */
export function setProofCacheEnabled(enabled: boolean): void {
  proofCache.setEnabled(enabled)
}

/**
 * Check if proof caching is enabled
 */
export function isProofCacheEnabled(): boolean {
  return proofCache.isEnabled()
}

/**
 * Get proof cache statistics
 */
export function getProofCacheStats(): ProofCacheStats {
  return proofCache.getStats()
}

/**
 * Set maximum proof cache size
 */
export function setProofCacheMaxSize(maxSize: number): void {
  proofCache.setMaxSize(maxSize)
}

/**
 * Generate a state signature from prover state
 * Used for context-dependent caching when definitions change
 *
 * @param definitions - Map of user definitions
 * @returns A string signature representing the state
 */
export function generateStateSignature(definitions: Map<string, ASTNode>): string {
  if (definitions.size === 0) {
    return ''
  }

  // Create sorted list of definition signatures
  const defSigs: string[] = []
  for (const [name, form] of definitions) {
    defSigs.push(`${name}:${toCanonicalString(form)}`)
  }
  defSigs.sort()

  // Create hash-like signature
  return `D${defSigs.length}:${defSigs.join(';').slice(0, 100)}`
}
