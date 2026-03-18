/**
 * Tests for Proof Metrics module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMetricsCollector,
  classifyComplexity,
  metricsToSerializable,
  formatMetricsSummary,
  aggregateMetrics,
} from '../../src/core/proofMetrics'
import type { ProofMetrics } from '../../src/core/proofMetrics'
import { createProverState, verify } from '../../src/core/prover'
import { parseExpr } from '../../src/core/parser'

describe('ProofMetrics', () => {
  describe('MetricsCollector', () => {
    it('should start with zero metrics', () => {
      const collector = createMetricsCollector()
      const metrics = collector.getMetrics()

      expect(metrics.totalSteps).toBe(0)
      expect(metrics.axiomsUsed.size).toBe(0)
      expect(metrics.unificationAttempts).toBe(0)
      expect(metrics.unificationSuccesses).toBe(0)
      expect(metrics.backtrackCount).toBe(0)
      expect(metrics.maxDepth).toBe(0)
      expect(metrics.duration).toBe(0)
      expect(metrics.complexity).toBe('trivial')
    })

    it('should record steps', () => {
      const collector = createMetricsCollector()
      collector.recordStep()
      collector.recordStep()
      collector.recordStep()

      const metrics = collector.getMetrics()
      expect(metrics.totalSteps).toBe(3)
    })

    it('should record axiom usage', () => {
      const collector = createMetricsCollector()
      collector.recordAxiomUse('A1')
      collector.recordAxiomUse('A1')
      collector.recordAxiomUse('A4')

      const metrics = collector.getMetrics()
      expect(metrics.axiomsUsed.get('A1')).toBe(2)
      expect(metrics.axiomsUsed.get('A4')).toBe(1)
      expect(metrics.axiomsUsed.size).toBe(2)
    })

    it('should record unification attempts', () => {
      const collector = createMetricsCollector()
      collector.recordUnificationAttempt(true)
      collector.recordUnificationAttempt(false)
      collector.recordUnificationAttempt(true)

      const metrics = collector.getMetrics()
      expect(metrics.unificationAttempts).toBe(3)
      expect(metrics.unificationSuccesses).toBe(2)
    })

    it('should record backtrack count', () => {
      const collector = createMetricsCollector()
      collector.recordBacktrack()
      collector.recordBacktrack()

      const metrics = collector.getMetrics()
      expect(metrics.backtrackCount).toBe(2)
    })

    it('should track maximum depth', () => {
      const collector = createMetricsCollector()
      collector.recordDepth(3)
      collector.recordDepth(1)
      collector.recordDepth(5)
      collector.recordDepth(2)

      const metrics = collector.getMetrics()
      expect(metrics.maxDepth).toBe(5)
    })

    it('should measure duration', () => {
      const collector = createMetricsCollector()
      collector.start()
      // Small delay for measurable duration
      let sum = 0
      for (let i = 0; i < 1000; i++) sum += i
      void sum
      collector.stop()

      const metrics = collector.getMetrics()
      expect(metrics.duration).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 duration if not started', () => {
      const collector = createMetricsCollector()
      collector.stop()

      const metrics = collector.getMetrics()
      expect(metrics.duration).toBe(0)
    })

    it('should reset all metrics', () => {
      const collector = createMetricsCollector()
      collector.start()
      collector.recordStep()
      collector.recordAxiomUse('A1')
      collector.recordUnificationAttempt(true)
      collector.recordBacktrack()
      collector.recordDepth(5)
      collector.stop()

      collector.reset()
      const metrics = collector.getMetrics()

      expect(metrics.totalSteps).toBe(0)
      expect(metrics.axiomsUsed.size).toBe(0)
      expect(metrics.unificationAttempts).toBe(0)
      expect(metrics.unificationSuccesses).toBe(0)
      expect(metrics.backtrackCount).toBe(0)
      expect(metrics.maxDepth).toBe(0)
      expect(metrics.duration).toBe(0)
    })

    it('should return a copy of axiomsUsed map', () => {
      const collector = createMetricsCollector()
      collector.recordAxiomUse('A1')

      const metrics1 = collector.getMetrics()
      const metrics2 = collector.getMetrics()

      expect(metrics1.axiomsUsed).not.toBe(metrics2.axiomsUsed)
      expect(metrics1.axiomsUsed).toEqual(metrics2.axiomsUsed)
    })
  })

  describe('classifyComplexity', () => {
    it('should classify trivial proofs', () => {
      expect(classifyComplexity(1, 1, 0, 0)).toBe('trivial')
      expect(classifyComplexity(2, 1, 0, 1)).toBe('trivial')
    })

    it('should classify simple proofs', () => {
      expect(classifyComplexity(3, 2, 0, 2)).toBe('simple')
      expect(classifyComplexity(5, 3, 1, 3)).toBe('simple')
    })

    it('should classify moderate proofs', () => {
      expect(classifyComplexity(10, 4, 2, 4)).toBe('moderate')
      expect(classifyComplexity(15, 5, 3, 5)).toBe('moderate')
    })

    it('should classify complex proofs', () => {
      expect(classifyComplexity(20, 5, 5, 6)).toBe('complex')
      expect(classifyComplexity(16, 3, 0, 6)).toBe('complex')
    })

    it('should classify based on backtrack count', () => {
      // High backtrack count makes it not trivial
      expect(classifyComplexity(1, 1, 1, 0)).not.toBe('trivial')
    })

    it('should classify based on depth', () => {
      // High depth makes it not trivial
      expect(classifyComplexity(1, 1, 0, 2)).not.toBe('trivial')
    })
  })

  describe('metricsToSerializable', () => {
    it('should convert metrics to serializable format', () => {
      const metrics: ProofMetrics = {
        totalSteps: 3,
        axiomsUsed: new Map([['A1', 2], ['A4', 1]]),
        unificationAttempts: 4,
        unificationSuccesses: 3,
        backtrackCount: 1,
        maxDepth: 2,
        duration: 1.2345,
        complexity: 'simple',
      }

      const serializable = metricsToSerializable(metrics)

      expect(serializable.totalSteps).toBe(3)
      expect(serializable.axiomsUsed).toEqual({ A1: 2, A4: 1 })
      expect(serializable.unificationAttempts).toBe(4)
      expect(serializable.unificationSuccesses).toBe(3)
      expect(serializable.unificationSuccessRate).toBe(0.75)
      expect(serializable.backtrackCount).toBe(1)
      expect(serializable.maxDepth).toBe(2)
      expect(serializable.duration).toBe(1.23)
      expect(serializable.complexity).toBe('simple')
    })

    it('should handle zero unification attempts', () => {
      const metrics: ProofMetrics = {
        totalSteps: 0,
        axiomsUsed: new Map(),
        unificationAttempts: 0,
        unificationSuccesses: 0,
        backtrackCount: 0,
        maxDepth: 0,
        duration: 0,
        complexity: 'trivial',
      }

      const serializable = metricsToSerializable(metrics)
      expect(serializable.unificationSuccessRate).toBe(0)
    })
  })

  describe('formatMetricsSummary', () => {
    it('should format metrics as readable summary', () => {
      const metrics: ProofMetrics = {
        totalSteps: 3,
        axiomsUsed: new Map([['A1', 2], ['A4', 1]]),
        unificationAttempts: 4,
        unificationSuccesses: 3,
        backtrackCount: 1,
        maxDepth: 2,
        duration: 1.5,
        complexity: 'simple',
      }

      const summary = formatMetricsSummary(metrics)

      expect(summary).toContain('Шагов: 3')
      expect(summary).toContain('A1×2')
      expect(summary).toContain('A4×1')
      expect(summary).toContain('Унификация: 3/4 (75%)')
      expect(summary).toContain('Откатов: 1')
      expect(summary).toContain('Макс. глубина: 2')
      expect(summary).toContain('1.50мс')
      expect(summary).toContain('простая')
    })

    it('should omit sections with zero values', () => {
      const metrics: ProofMetrics = {
        totalSteps: 1,
        axiomsUsed: new Map(),
        unificationAttempts: 0,
        unificationSuccesses: 0,
        backtrackCount: 0,
        maxDepth: 0,
        duration: 0,
        complexity: 'trivial',
      }

      const summary = formatMetricsSummary(metrics)

      expect(summary).toContain('Шагов: 1')
      expect(summary).not.toContain('Унификация')
      expect(summary).not.toContain('Откатов')
      expect(summary).not.toContain('Макс. глубина')
      expect(summary).toContain('тривиальная')
    })

    it('should format all complexity levels', () => {
      const base: ProofMetrics = {
        totalSteps: 1,
        axiomsUsed: new Map(),
        unificationAttempts: 0,
        unificationSuccesses: 0,
        backtrackCount: 0,
        maxDepth: 0,
        duration: 0,
        complexity: 'trivial',
      }

      expect(formatMetricsSummary({ ...base, complexity: 'trivial' })).toContain('тривиальная')
      expect(formatMetricsSummary({ ...base, complexity: 'simple' })).toContain('простая')
      expect(formatMetricsSummary({ ...base, complexity: 'moderate' })).toContain('умеренная')
      expect(formatMetricsSummary({ ...base, complexity: 'complex' })).toContain('сложная')
    })
  })

  describe('aggregateMetrics', () => {
    it('should aggregate metrics from multiple proofs', () => {
      const metrics1: ProofMetrics = {
        totalSteps: 2,
        axiomsUsed: new Map([['A1', 1], ['A4', 1]]),
        unificationAttempts: 2,
        unificationSuccesses: 1,
        backtrackCount: 0,
        maxDepth: 1,
        duration: 1.0,
        complexity: 'trivial',
      }

      const metrics2: ProofMetrics = {
        totalSteps: 5,
        axiomsUsed: new Map([['A1', 2], ['A5', 1]]),
        unificationAttempts: 3,
        unificationSuccesses: 2,
        backtrackCount: 1,
        maxDepth: 3,
        duration: 2.0,
        complexity: 'simple',
      }

      const aggregated = aggregateMetrics([metrics1, metrics2])

      expect(aggregated.totalProofs).toBe(2)
      expect(aggregated.totalSteps).toBe(7)
      expect(aggregated.totalDuration).toBe(3.0)
      expect(aggregated.averageSteps).toBe(3.5)
      expect(aggregated.averageDuration).toBe(1.5)
      expect(aggregated.axiomUsageTotals.get('A1')).toBe(3)
      expect(aggregated.axiomUsageTotals.get('A4')).toBe(1)
      expect(aggregated.axiomUsageTotals.get('A5')).toBe(1)
      expect(aggregated.complexityDistribution.trivial).toBe(1)
      expect(aggregated.complexityDistribution.simple).toBe(1)
      expect(aggregated.complexityDistribution.moderate).toBe(0)
      expect(aggregated.complexityDistribution.complex).toBe(0)
    })

    it('should handle empty list', () => {
      const aggregated = aggregateMetrics([])

      expect(aggregated.totalProofs).toBe(0)
      expect(aggregated.totalSteps).toBe(0)
      expect(aggregated.averageSteps).toBe(0)
      expect(aggregated.averageDuration).toBe(0)
    })
  })

  describe('verify integration', () => {
    let state: ReturnType<typeof createProverState>

    beforeEach(() => {
      state = createProverState()
    })

    it('should attach metrics to equality verification result', () => {
      const expr = parseExpr('∞ = ∞ -> ∞')
      const result = verify(expr, state)

      expect(result.metrics).toBeDefined()
      expect(result.metrics!.totalSteps).toBeGreaterThan(0)
      expect(result.metrics!.axiomsUsed.size).toBeGreaterThan(0)
      expect(result.metrics!.duration).toBeGreaterThanOrEqual(0)
      expect(result.metrics!.complexity).toBeDefined()
    })

    it('should attach metrics to reflexive equality', () => {
      const expr = parseExpr('∞ = ∞')
      const result = verify(expr, state)

      expect(result.success).toBe(true)
      expect(result.metrics).toBeDefined()
      // Reflexive equality has 2 steps (normalization + structural comparison)
      // which classifies as 'simple' or 'trivial' depending on depth
      expect(['trivial', 'simple']).toContain(result.metrics!.complexity)
    })

    it('should attach metrics to definition verification', () => {
      const expr = parseExpr('x : ∞')
      const result = verify(expr, state)

      expect(result.success).toBe(true)
      expect(result.metrics).toBeDefined()
      expect(result.metrics!.totalSteps).toBeGreaterThan(0)
    })

    it('should attach metrics to link expression', () => {
      const expr = parseExpr('∞ -> ∞')
      const result = verify(expr, state)

      expect(result.success).toBe(true)
      expect(result.metrics).toBeDefined()
      expect(result.metrics!.totalSteps).toBeGreaterThan(0)
    })

    it('should attach metrics to inequality verification', () => {
      const expr = parseExpr('♂∞ != ∞♀')
      const result = verify(expr, state)

      expect(result.metrics).toBeDefined()
      expect(result.metrics!.totalSteps).toBeGreaterThan(0)
    })

    it('should attach metrics to failed verification', () => {
      const expr = parseExpr('∞')
      const result = verify(expr, state)

      expect(result.success).toBe(false)
      expect(result.metrics).toBeDefined()
    })

    it('should have consistent metrics with proof steps', () => {
      const expr = parseExpr('∞ = ∞ -> ∞')
      const result = verify(expr, state)

      expect(result.metrics).toBeDefined()
      if (result.proofSteps && result.metrics) {
        expect(result.metrics.totalSteps).toBe(result.proofSteps.length)
      }
    })
  })
})
