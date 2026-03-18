/**
 * Proof Metrics for МТС (Meta-Theory of Links) Prover
 *
 * Collects and analyzes metrics during proof verification:
 * - Step count and axiom usage statistics
 * - Unification attempts and success rate
 * - Proof duration timing
 * - Complexity classification
 *
 * Usage:
 * ```typescript
 * const collector = createMetricsCollector()
 * collector.start()
 * // ... perform verification ...
 * collector.recordAxiomUse('A1')
 * collector.recordUnificationAttempt(true)
 * collector.stop()
 * const metrics = collector.getMetrics()
 * ```
 */

import type { AxiomId } from './prover'

/**
 * Proof complexity classification
 */
export type ProofComplexity = 'trivial' | 'simple' | 'moderate' | 'complex'

/**
 * Collected proof metrics
 */
export interface ProofMetrics {
  /** Total number of proof steps */
  totalSteps: number
  /** Map of axiom IDs to usage count */
  axiomsUsed: Map<AxiomId, number>
  /** Number of unification attempts */
  unificationAttempts: number
  /** Number of successful unifications */
  unificationSuccesses: number
  /** Number of backtrack operations */
  backtrackCount: number
  /** Maximum proof search depth */
  maxDepth: number
  /** Proof duration in milliseconds */
  duration: number
  /** Computed complexity classification */
  complexity: ProofComplexity
}

/**
 * Serializable proof metrics (for JSON export)
 */
export interface SerializableProofMetrics {
  /** Total number of proof steps */
  totalSteps: number
  /** Axiom usage as record */
  axiomsUsed: Record<string, number>
  /** Number of unification attempts */
  unificationAttempts: number
  /** Number of successful unifications */
  unificationSuccesses: number
  /** Unification success rate (0-1) */
  unificationSuccessRate: number
  /** Number of backtrack operations */
  backtrackCount: number
  /** Maximum proof search depth */
  maxDepth: number
  /** Proof duration in milliseconds */
  duration: number
  /** Computed complexity classification */
  complexity: ProofComplexity
}

/**
 * Metrics collector for tracking proof verification progress
 */
export interface MetricsCollector {
  /** Start timing the proof */
  start(): void
  /** Stop timing the proof */
  stop(): void
  /** Record a proof step */
  recordStep(): void
  /** Record an axiom usage */
  recordAxiomUse(axiomId: AxiomId): void
  /** Record a unification attempt */
  recordUnificationAttempt(success: boolean): void
  /** Record a backtrack operation */
  recordBacktrack(): void
  /** Update the current search depth */
  recordDepth(depth: number): void
  /** Get the collected metrics */
  getMetrics(): ProofMetrics
  /** Reset all collected metrics */
  reset(): void
}

/**
 * Complexity thresholds for classification
 */
interface ComplexityThresholds {
  /** Max steps for trivial proof */
  trivialMaxSteps: number
  /** Max steps for simple proof */
  simpleMaxSteps: number
  /** Max steps for moderate proof */
  moderateMaxSteps: number
  /** Max axioms for trivial proof */
  trivialMaxAxioms: number
  /** Max axioms for simple proof */
  simpleMaxAxioms: number
}

/** Default complexity thresholds */
const DEFAULT_THRESHOLDS: ComplexityThresholds = {
  trivialMaxSteps: 2,
  simpleMaxSteps: 5,
  moderateMaxSteps: 15,
  trivialMaxAxioms: 1,
  simpleMaxAxioms: 3,
}

/**
 * Classify proof complexity based on metrics
 */
export function classifyComplexity(
  totalSteps: number,
  uniqueAxioms: number,
  backtrackCount: number,
  maxDepth: number,
  thresholds: ComplexityThresholds = DEFAULT_THRESHOLDS
): ProofComplexity {
  // Trivial: very few steps, single axiom, no backtracking
  if (
    totalSteps <= thresholds.trivialMaxSteps &&
    uniqueAxioms <= thresholds.trivialMaxAxioms &&
    backtrackCount === 0 &&
    maxDepth <= 1
  ) {
    return 'trivial'
  }

  // Simple: few steps, few axioms, minimal backtracking
  if (
    totalSteps <= thresholds.simpleMaxSteps &&
    uniqueAxioms <= thresholds.simpleMaxAxioms &&
    backtrackCount <= 1 &&
    maxDepth <= 3
  ) {
    return 'simple'
  }

  // Moderate: medium steps count
  if (totalSteps <= thresholds.moderateMaxSteps && maxDepth <= 5) {
    return 'moderate'
  }

  // Complex: everything else
  return 'complex'
}

/**
 * Create a new metrics collector instance
 */
export function createMetricsCollector(): MetricsCollector {
  let startTime: number | null = null
  let endTime: number | null = null
  let totalSteps = 0
  const axiomsUsed = new Map<AxiomId, number>()
  let unificationAttempts = 0
  let unificationSuccesses = 0
  let backtrackCount = 0
  let maxDepth = 0

  return {
    start(): void {
      startTime = performance.now()
      endTime = null
    },

    stop(): void {
      if (startTime !== null) {
        endTime = performance.now()
      }
    },

    recordStep(): void {
      totalSteps++
    },

    recordAxiomUse(axiomId: AxiomId): void {
      const count = axiomsUsed.get(axiomId) ?? 0
      axiomsUsed.set(axiomId, count + 1)
    },

    recordUnificationAttempt(success: boolean): void {
      unificationAttempts++
      if (success) {
        unificationSuccesses++
      }
    },

    recordBacktrack(): void {
      backtrackCount++
    },

    recordDepth(depth: number): void {
      if (depth > maxDepth) {
        maxDepth = depth
      }
    },

    getMetrics(): ProofMetrics {
      const duration = startTime !== null && endTime !== null ? endTime - startTime : 0

      const complexity = classifyComplexity(totalSteps, axiomsUsed.size, backtrackCount, maxDepth)

      return {
        totalSteps,
        axiomsUsed: new Map(axiomsUsed),
        unificationAttempts,
        unificationSuccesses,
        backtrackCount,
        maxDepth,
        duration,
        complexity,
      }
    },

    reset(): void {
      startTime = null
      endTime = null
      totalSteps = 0
      axiomsUsed.clear()
      unificationAttempts = 0
      unificationSuccesses = 0
      backtrackCount = 0
      maxDepth = 0
    },
  }
}

/**
 * Convert ProofMetrics to a serializable format (for JSON export)
 */
export function metricsToSerializable(metrics: ProofMetrics): SerializableProofMetrics {
  const axiomsUsed: Record<string, number> = {}
  for (const [key, value] of metrics.axiomsUsed) {
    axiomsUsed[key] = value
  }

  const successRate =
    metrics.unificationAttempts > 0 ? metrics.unificationSuccesses / metrics.unificationAttempts : 0

  return {
    totalSteps: metrics.totalSteps,
    axiomsUsed,
    unificationAttempts: metrics.unificationAttempts,
    unificationSuccesses: metrics.unificationSuccesses,
    unificationSuccessRate: Math.round(successRate * 1000) / 1000,
    backtrackCount: metrics.backtrackCount,
    maxDepth: metrics.maxDepth,
    duration: Math.round(metrics.duration * 100) / 100,
    complexity: metrics.complexity,
  }
}

/**
 * Format metrics as a human-readable text summary
 */
export function formatMetricsSummary(metrics: ProofMetrics): string {
  const lines: string[] = []

  lines.push(`Шагов: ${metrics.totalSteps}`)

  if (metrics.axiomsUsed.size > 0) {
    const axiomList = Array.from(metrics.axiomsUsed.entries())
      .map(([id, count]) => `${id}×${count}`)
      .join(', ')
    lines.push(`Аксиомы: ${axiomList}`)
  }

  if (metrics.unificationAttempts > 0) {
    const rate =
      metrics.unificationAttempts > 0
        ? Math.round((metrics.unificationSuccesses / metrics.unificationAttempts) * 100)
        : 0
    lines.push(
      `Унификация: ${metrics.unificationSuccesses}/${metrics.unificationAttempts} (${rate}%)`
    )
  }

  if (metrics.backtrackCount > 0) {
    lines.push(`Откатов: ${metrics.backtrackCount}`)
  }

  if (metrics.maxDepth > 0) {
    lines.push(`Макс. глубина: ${metrics.maxDepth}`)
  }

  if (metrics.duration > 0) {
    lines.push(`Время: ${metrics.duration.toFixed(2)}мс`)
  }

  const complexityLabels: Record<ProofComplexity, string> = {
    trivial: 'тривиальная',
    simple: 'простая',
    moderate: 'умеренная',
    complex: 'сложная',
  }
  lines.push(`Сложность: ${complexityLabels[metrics.complexity]}`)

  return lines.join(' | ')
}

/**
 * Aggregate metrics from multiple proof verifications
 */
export function aggregateMetrics(metricsList: ProofMetrics[]): {
  totalProofs: number
  totalSteps: number
  totalDuration: number
  averageSteps: number
  averageDuration: number
  axiomUsageTotals: Map<AxiomId, number>
  complexityDistribution: Record<ProofComplexity, number>
} {
  const axiomUsageTotals = new Map<AxiomId, number>()
  const complexityDistribution: Record<ProofComplexity, number> = {
    trivial: 0,
    simple: 0,
    moderate: 0,
    complex: 0,
  }

  let totalSteps = 0
  let totalDuration = 0

  for (const metrics of metricsList) {
    totalSteps += metrics.totalSteps
    totalDuration += metrics.duration
    complexityDistribution[metrics.complexity]++

    for (const [axiomId, count] of metrics.axiomsUsed) {
      const existing = axiomUsageTotals.get(axiomId) ?? 0
      axiomUsageTotals.set(axiomId, existing + count)
    }
  }

  const totalProofs = metricsList.length

  return {
    totalProofs,
    totalSteps,
    totalDuration,
    averageSteps: totalProofs > 0 ? totalSteps / totalProofs : 0,
    averageDuration: totalProofs > 0 ? totalDuration / totalProofs : 0,
    axiomUsageTotals,
    complexityDistribution,
  }
}
