/**
 * Tests for Proof Cache module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
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
} from '../../src/core/proofCache'
import { parseExpr } from '../../src/core/parser'
import type { ProofResult } from '../../src/core/prover'
import type { ASTNode } from '../../src/core/ast'

describe('ProofCache', () => {
  beforeEach(() => {
    clearProofCache()
    setProofCacheEnabled(true)
  })

  describe('basic operations', () => {
    it('should cache and retrieve proof results', () => {
      const expr = parseExpr('∞ = ∞ -> ∞')
      const result: ProofResult = {
        success: true,
        message: 'Test proof',
        steps: ['step1'],
      }

      cacheProof(expr, result)
      const cached = getCachedProof(expr)

      expect(cached).toBeDefined()
      expect(cached?.success).toBe(true)
      expect(cached?.message).toBe('Test proof')
    })

    it('should return undefined for non-cached expressions', () => {
      const expr = parseExpr('x = y')
      const cached = getCachedProof(expr)

      expect(cached).toBeUndefined()
    })

    it('should check if expression is cached', () => {
      const expr = parseExpr('∞')
      const result: ProofResult = {
        success: true,
        message: 'Cached',
      }

      expect(isProofCached(expr)).toBe(false)

      cacheProof(expr, result)

      expect(isProofCached(expr)).toBe(true)
    })

    it('should clear cache', () => {
      const expr = parseExpr('∞')
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      cacheProof(expr, result)
      expect(isProofCached(expr)).toBe(true)

      clearProofCache()
      expect(isProofCached(expr)).toBe(false)
    })
  })

  describe('enable/disable', () => {
    it('should respect enabled state', () => {
      const expr = parseExpr('∞')
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      // Cache when enabled
      cacheProof(expr, result)
      expect(isProofCached(expr)).toBe(true)

      // Disable cache
      setProofCacheEnabled(false)
      expect(isProofCacheEnabled()).toBe(false)

      // Should not find cached result when disabled
      expect(getCachedProof(expr)).toBeUndefined()

      // Should not cache new entries when disabled
      const expr2 = parseExpr('x')
      cacheProof(expr2, result)
      setProofCacheEnabled(true)
      expect(isProofCached(expr2)).toBe(false)
    })
  })

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const expr = parseExpr('∞')
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      // Initial state
      let stats = getProofCacheStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)

      // Miss
      getCachedProof(expr)
      stats = getProofCacheStats()
      expect(stats.misses).toBe(1)

      // Cache and hit
      cacheProof(expr, result)
      getCachedProof(expr)
      stats = getProofCacheStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should track cache size', () => {
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      cacheProof(parseExpr('∞'), result)
      cacheProof(parseExpr('x'), result)
      cacheProof(parseExpr('y'), result)

      const stats = getProofCacheStats()
      expect(stats.size).toBe(3)
    })
  })

  describe('LRU eviction', () => {
    it('should evict entries when cache is full', () => {
      // Clear and set small max size
      clearProofCache()
      setProofCacheMaxSize(3)

      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      // Use unique expressions
      const exprA = parseExpr('aaa')
      const exprB = parseExpr('bbb')
      const exprC = parseExpr('ccc')
      const exprD = parseExpr('ddd')

      // Fill cache
      cacheProof(exprA, result)
      cacheProof(exprB, result)
      cacheProof(exprC, result)

      expect(getProofCacheStats().size).toBe(3)

      // Add new entry - should evict one entry to make room
      cacheProof(exprD, result)

      // Cache size should remain at max
      expect(getProofCacheStats().size).toBe(3)

      // The new entry should be cached
      expect(isProofCached(exprD)).toBe(true)

      // Exactly one of the old entries should have been evicted
      const oldEntriesCached = [
        isProofCached(exprA),
        isProofCached(exprB),
        isProofCached(exprC),
      ].filter(Boolean).length
      expect(oldEntriesCached).toBe(2)

      // Reset max size to default
      setProofCacheMaxSize(500)
    })
  })

  describe('state signature', () => {
    it('should generate state signature from definitions', () => {
      const definitions = new Map<string, ASTNode>()
      definitions.set('x', parseExpr('∞ -> ∞'))
      definitions.set('y', parseExpr('♂∞'))

      const signature = generateStateSignature(definitions)

      expect(signature).toContain('D2')
      expect(signature.length).toBeGreaterThan(0)
    })

    it('should return empty signature for empty definitions', () => {
      const definitions = new Map<string, ASTNode>()
      const signature = generateStateSignature(definitions)

      expect(signature).toBe('')
    })

    it('should cache with state signature', () => {
      const expr = parseExpr('x')
      const result1: ProofResult = {
        success: true,
        message: 'State 1',
      }
      const result2: ProofResult = {
        success: false,
        message: 'State 2',
      }

      // Cache with different state signatures
      cacheProof(expr, result1, 'state1')
      cacheProof(expr, result2, 'state2')

      // Retrieve with correct signatures
      expect(getCachedProof(expr, 'state1')?.message).toBe('State 1')
      expect(getCachedProof(expr, 'state2')?.message).toBe('State 2')

      // Different signature returns undefined
      expect(getCachedProof(expr, 'state3')).toBeUndefined()
    })
  })

  describe('cache instance', () => {
    it('should provide access to cache instance', () => {
      const cache = getProofCache()

      expect(cache).toBeDefined()
      expect(typeof cache.setEnabled).toBe('function')
      expect(typeof cache.getStats).toBe('function')
    })

    it('should provide entry metadata', () => {
      const expr = parseExpr('∞')
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      cacheProof(expr, result)

      const cache = getProofCache()
      const metadata = cache.getEntryMetadata(expr)

      expect(metadata).toBeDefined()
      expect(metadata?.accessCount).toBe(1)
      expect(metadata?.cachedAt).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle identical expressions', () => {
      const expr1 = parseExpr('∞ -> ∞')
      const expr2 = parseExpr('∞ -> ∞')
      const result: ProofResult = {
        success: true,
        message: 'Test',
      }

      cacheProof(expr1, result)

      // expr2 should get the same cached result
      expect(getCachedProof(expr2)?.message).toBe('Test')
    })

    it('should handle complex expressions', () => {
      const expr = parseExpr('(♂∞ -> ∞♀) = 1')
      const result: ProofResult = {
        success: true,
        message: 'Complex proof',
        proofSteps: [
          {
            index: 1,
            action: 'Test step',
          },
        ],
      }

      cacheProof(expr, result)
      const cached = getCachedProof(expr)

      expect(cached?.proofSteps?.length).toBe(1)
    })

    it('should update existing cache entry', () => {
      const expr = parseExpr('∞')
      const result1: ProofResult = {
        success: true,
        message: 'First',
      }
      const result2: ProofResult = {
        success: false,
        message: 'Second',
      }

      cacheProof(expr, result1)
      cacheProof(expr, result2)

      const cached = getCachedProof(expr)
      expect(cached?.message).toBe('Second')

      // Size should not increase
      expect(getProofCacheStats().size).toBe(1)
    })
  })
})
