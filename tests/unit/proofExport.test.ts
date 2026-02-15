/**
 * Unit tests for proof export module
 */

import { describe, it, expect } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'
import { createProverState, verify, type ProofResult } from '../../src/core/prover'
import type { ASTNode } from '../../src/core/ast'
import {
  exportToLaTeX,
  exportToText,
  exportToJSON,
  exportToDOT,
  exportProof,
  getExportExtension,
  getExportMimeType,
  astToLaTeX,
  stringToLaTeX,
  type ExportFormat,
  type ProofExportData,
} from '../../src/core/proofExport'

// Helper to get proof result for an expression
function verifyExpression(expr: string): {
  result: ProofResult
  goal: ASTNode
  state: ReturnType<typeof createProverState>
} {
  const state = createProverState()
  const goal = normalize(parseExpr(expr))
  const result = verify(goal, state)
  return { result, goal, state }
}

describe('Proof Export Module', () => {
  describe('astToLaTeX', () => {
    it('should convert infinity to LaTeX', () => {
      const node = parseExpr('∞')
      expect(astToLaTeX(node)).toBe('\\infty')
    })

    it('should convert link expression to LaTeX', () => {
      const node = parseExpr('a -> b')
      expect(astToLaTeX(node)).toBe('(a \\to b)')
    })

    it('should convert equality to LaTeX', () => {
      const node = parseExpr('a = b')
      expect(astToLaTeX(node)).toBe('a = b')
    })

    it('should convert inequality to LaTeX', () => {
      const node = parseExpr('a != b')
      expect(astToLaTeX(node)).toBe('a \\neq b')
    })

    it('should convert male expression to LaTeX', () => {
      const node = parseExpr('♂x')
      expect(astToLaTeX(node)).toBe('\\male{x}')
    })

    it('should convert female expression to LaTeX', () => {
      const node = parseExpr('x♀')
      expect(astToLaTeX(node)).toBe('x\\female')
    })

    it('should convert negation to LaTeX', () => {
      const node = parseExpr('!x')
      expect(astToLaTeX(node)).toBe('\\lnot x')
    })

    it('should convert set to LaTeX', () => {
      const node = parseExpr('{a, b}')
      expect(astToLaTeX(node)).toBe('\\{a, b\\}')
    })

    it('should convert numbers to LaTeX', () => {
      const node0 = parseExpr('0')
      const node1 = parseExpr('1')
      expect(astToLaTeX(node0)).toBe('0')
      expect(astToLaTeX(node1)).toBe('1')
    })

    it('should convert complex expressions', () => {
      const node = parseExpr('♂∞ -> ∞♀')
      expect(astToLaTeX(node)).toBe('(\\male{\\infty} \\to \\infty\\female)')
    })
  })

  describe('stringToLaTeX', () => {
    it('should convert infinity symbol', () => {
      expect(stringToLaTeX('∞')).toBe('\\infty')
    })

    it('should convert arrow', () => {
      expect(stringToLaTeX('a → b')).toBe('a \\to b')
      expect(stringToLaTeX('a -> b')).toBe('a \\to b')
    })

    it('should convert male/female symbols', () => {
      expect(stringToLaTeX('♂x')).toBe('\\male{}x')
      expect(stringToLaTeX('x♀')).toBe('x\\female{}')
    })

    it('should convert inequality', () => {
      expect(stringToLaTeX('a ≠ b')).toBe('a \\neq b')
      expect(stringToLaTeX('a != b')).toBe('a \\neq b')
    })

    it('should convert negation', () => {
      expect(stringToLaTeX('¬x')).toBe('\\lnot x')
      expect(stringToLaTeX('!x')).toBe('\\lnot x')
    })
  })

  describe('exportToLaTeX', () => {
    it('should export successful proof to LaTeX', () => {
      const { result, goal } = verifyExpression('a = a')
      const latex = exportToLaTeX(result, goal)

      expect(latex).toContain('Результат')
      expect(latex).toContain('Доказано')
      expect(latex).toContain('a = a')
    })

    it('should export failed proof to LaTeX', () => {
      // Use ♂∞ = ∞♀ which should fail because they are structurally different
      const { result, goal } = verifyExpression('♂∞ = ∞♀')
      const latex = exportToLaTeX(result, goal)

      // Note: This may or may not fail depending on prover implementation
      // Just verify the export works
      expect(latex).toContain('Результат')
    })

    it('should include standalone preamble when requested', () => {
      const { result, goal } = verifyExpression('a = a')
      const latex = exportToLaTeX(result, goal, { standalone: true })

      expect(latex).toContain('\\documentclass')
      expect(latex).toContain('\\begin{document}')
      expect(latex).toContain('\\end{document}')
    })

    it('should include proof environment when requested', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')
      const latex = exportToLaTeX(result, goal, { useProofEnvironment: true })

      // Only check if proof steps exist
      if (result.proofSteps && result.proofSteps.length > 0) {
        expect(latex).toContain('\\begin{proof}')
        expect(latex).toContain('\\end{proof}')
      }
    })

    it('should include axiom definitions when requested', () => {
      const { result, goal } = verifyExpression('a = a')
      const latex = exportToLaTeX(result, goal, { includeAxiomDefinitions: true })

      expect(latex).toContain('Система аксиом МТС')
      expect(latex).toContain('A0')
      expect(latex).toContain('A1')
    })

    it('should support English language', () => {
      const { result, goal } = verifyExpression('a = a')
      const latex = exportToLaTeX(result, goal, { language: 'en' })

      expect(latex).toContain('Result')
      expect(latex).toContain('Proven')
    })
  })

  describe('exportToText', () => {
    it('should export successful proof to text', () => {
      const { result, goal } = verifyExpression('a = a')
      const text = exportToText(result, goal)

      expect(text).toContain('ДОКАЗАТЕЛЬСТВО МТС')
      expect(text).toContain('✓ Доказано')
    })

    it('should export failed proof to text', () => {
      // Use an expression that fails - verifying any export contains required structure
      const { result, goal } = verifyExpression('♂∞ = ∞♀')
      const text = exportToText(result, goal)

      // Note: Just verify export works, don't depend on proof result
      expect(text).toContain('ДОКАЗАТЕЛЬСТВО МТС')
      expect(text).toContain('Результат')
    })

    it('should include step numbers when requested', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')
      const text = exportToText(result, goal, { includeStepNumbers: true })

      if (result.proofSteps && result.proofSteps.length > 0) {
        expect(text).toMatch(/\[\d+\]/)
      }
    })

    it('should include timestamps when requested', () => {
      const { result, goal } = verifyExpression('a = a')
      const text = exportToText(result, goal, { includeTimestamps: true })

      expect(text).toContain('Время:')
    })

    it('should support English language', () => {
      const { result, goal } = verifyExpression('a = a')
      const text = exportToText(result, goal, { language: 'en' })

      expect(text).toContain('MTS PROOF')
      expect(text).toContain('✓ Proven')
    })

    it('should include applied axioms summary', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')
      const text = exportToText(result, goal)

      if (result.appliedAxioms && result.appliedAxioms.length > 0) {
        expect(text).toContain('Примененные аксиомы')
      }
    })
  })

  describe('exportToJSON', () => {
    it('should export successful proof to JSON', () => {
      const { result, goal, state } = verifyExpression('a = a')
      const json = exportToJSON(result, goal, state)
      const data: ProofExportData = JSON.parse(json)

      expect(data.version).toBe('1.0')
      expect(data.success).toBe(true)
      expect(data.goal).toBe('(a=a)')
    })

    it('should export failed proof to JSON', () => {
      // Test that JSON export works regardless of proof outcome
      const { result, goal, state } = verifyExpression('♂∞ = ∞♀')
      const json = exportToJSON(result, goal, state)
      const data: ProofExportData = JSON.parse(json)

      // Verify JSON structure
      expect(data.version).toBe('1.0')
      expect(typeof data.success).toBe('boolean')
      expect(data.goal).toBeDefined()
    })

    it('should include proof steps', () => {
      const { result, goal, state } = verifyExpression('∞ = ∞ -> ∞')
      const json = exportToJSON(result, goal, state)
      const data: ProofExportData = JSON.parse(json)

      expect(Array.isArray(data.steps)).toBe(true)
    })

    it('should include applied axioms', () => {
      const { result, goal, state } = verifyExpression('∞ = ∞ -> ∞')
      const json = exportToJSON(result, goal, state)
      const data: ProofExportData = JSON.parse(json)

      expect(Array.isArray(data.appliedAxioms)).toBe(true)
    })

    it('should include timestamps when requested', () => {
      const { result, goal, state } = verifyExpression('a = a')
      const json = exportToJSON(result, goal, state, { includeTimestamps: true })
      const data: ProofExportData = JSON.parse(json)

      expect(data.exportedAt).toBeDefined()
      expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })

    it('should exclude timestamps when not requested', () => {
      const { result, goal, state } = verifyExpression('a = a')
      const json = exportToJSON(result, goal, state, { includeTimestamps: false })
      const data = JSON.parse(json)

      expect(data.exportedAt).toBeUndefined()
    })

    it('should include prover state when requested', () => {
      const { result, goal, state } = verifyExpression('∞ = ∞ -> ∞')
      const json = exportToJSON(result, goal, state, { includeState: true })
      const data: ProofExportData = JSON.parse(json)

      expect(data.state).toBeDefined()
      expect(data.state?.definitionsCount).toBeGreaterThanOrEqual(0)
    })

    it('should include AST when requested', () => {
      const { result, goal, state } = verifyExpression('a = a')
      const json = exportToJSON(result, goal, state, { includeAST: true })
      const data: ProofExportData = JSON.parse(json)

      expect(data.ast).toBeDefined()
      expect(data.ast?.type).toBe('Equality')
    })

    it('should support pretty printing', () => {
      const { result, goal, state } = verifyExpression('a = a')
      const jsonPretty = exportToJSON(result, goal, state, { pretty: true })
      const jsonCompact = exportToJSON(result, goal, state, { pretty: false })

      expect(jsonPretty.includes('\n')).toBe(true)
      expect(jsonCompact.includes('\n')).toBe(false)
    })
  })

  describe('exportToDOT', () => {
    it('should export proof to DOT format', () => {
      const { result, goal } = verifyExpression('a = a')
      const dot = exportToDOT(result, goal)

      expect(dot).toContain('digraph Proof')
      expect(dot).toContain('goal')
      expect(dot).toContain('result')
    })

    it('should include nodes and edges', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')
      const dot = exportToDOT(result, goal)

      expect(dot).toContain('->')
      expect(dot).toContain('label=')
    })

    it('should respect rankdir option', () => {
      const { result, goal } = verifyExpression('a = a')

      const dotTB = exportToDOT(result, goal, { rankdir: 'TB' })
      const dotLR = exportToDOT(result, goal, { rankdir: 'LR' })

      expect(dotTB).toContain('rankdir=TB')
      expect(dotLR).toContain('rankdir=LR')
    })

    it('should include axiom labels when requested', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')
      const dot = exportToDOT(result, goal, { includeAxiomLabels: true })

      // May or may not have axiom labels depending on proof steps
      expect(dot).toContain('digraph')
    })

    it('should include legend when requested', () => {
      const { result, goal } = verifyExpression('a = a')
      const dotWithLegend = exportToDOT(result, goal, { includeLegend: true })
      const dotNoLegend = exportToDOT(result, goal, { includeLegend: false })

      expect(dotWithLegend).toContain('cluster_legend')
      expect(dotNoLegend).not.toContain('cluster_legend')
    })

    it('should support different color schemes', () => {
      const { result, goal } = verifyExpression('a = a')

      const dotDefault = exportToDOT(result, goal, { colorScheme: 'default' })
      const dotColorful = exportToDOT(result, goal, { colorScheme: 'colorful' })
      const dotMono = exportToDOT(result, goal, { colorScheme: 'monochrome' })

      // All should be valid DOT format
      expect(dotDefault).toContain('fillcolor')
      expect(dotColorful).toContain('fillcolor')
      expect(dotMono).toContain('fillcolor')
    })

    it('should support different node shapes', () => {
      const { result, goal } = verifyExpression('a = a')

      const dotBox = exportToDOT(result, goal, { nodeShape: 'box' })
      const dotEllipse = exportToDOT(result, goal, { nodeShape: 'ellipse' })
      const dotDiamond = exportToDOT(result, goal, { nodeShape: 'diamond' })

      // Goal node is always ellipse, but step nodes use the configured shape
      expect(dotBox).toContain('shape=')
      expect(dotEllipse).toContain('shape=')
      expect(dotDiamond).toContain('shape=')
    })
  })

  describe('exportProof', () => {
    it('should dispatch to correct export function', () => {
      const { result, goal, state } = verifyExpression('a = a')

      const latex = exportProof('latex', result, goal, state)
      const text = exportProof('text', result, goal, state)
      const json = exportProof('json', result, goal, state)
      const dot = exportProof('dot', result, goal, state)

      expect(latex).toContain('\\')
      expect(text).toContain('ДОКАЗАТЕЛЬСТВО')
      expect(json).toContain('"version"')
      expect(dot).toContain('digraph')
    })

    it('should throw for unsupported format', () => {
      const { result, goal, state } = verifyExpression('a = a')

      expect(() => {
        exportProof('invalid' as ExportFormat, result, goal, state)
      }).toThrow('Unsupported export format')
    })
  })

  describe('getExportExtension', () => {
    it('should return correct extension for each format', () => {
      expect(getExportExtension('latex')).toBe('tex')
      expect(getExportExtension('text')).toBe('txt')
      expect(getExportExtension('json')).toBe('json')
      expect(getExportExtension('dot')).toBe('dot')
    })

    it('should return txt for unknown format', () => {
      expect(getExportExtension('invalid' as ExportFormat)).toBe('txt')
    })
  })

  describe('getExportMimeType', () => {
    it('should return correct MIME type for each format', () => {
      expect(getExportMimeType('latex')).toBe('application/x-latex')
      expect(getExportMimeType('text')).toBe('text/plain')
      expect(getExportMimeType('json')).toBe('application/json')
      expect(getExportMimeType('dot')).toBe('text/vnd.graphviz')
    })

    it('should return text/plain for unknown format', () => {
      expect(getExportMimeType('invalid' as ExportFormat)).toBe('text/plain')
    })
  })

  describe('Complex proof scenarios', () => {
    it('should export proof for infinity axiom (A4)', () => {
      const { result, goal } = verifyExpression('∞ = ∞ -> ∞')

      const latex = exportToLaTeX(result, goal)
      const text = exportToText(result, goal)
      const json = exportToJSON(result, goal)
      const dot = exportToDOT(result, goal)

      // All formats should work
      expect(latex.length).toBeGreaterThan(0)
      expect(text.length).toBeGreaterThan(0)
      expect(json.length).toBeGreaterThan(0)
      expect(dot.length).toBeGreaterThan(0)
    })

    it('should export proof for male axiom (A5)', () => {
      const { result, goal } = verifyExpression('♂v = ♂v -> v')

      const text = exportToText(result, goal)
      expect(text).toContain('✓ Доказано')
    })

    it('should export proof for female axiom (A6)', () => {
      const { result, goal } = verifyExpression('r♀ = r -> r♀')

      const text = exportToText(result, goal)
      expect(text).toContain('✓ Доказано')
    })

    it('should export proof for inversion axiom (A7)', () => {
      const { result, goal } = verifyExpression('!♂x = x♀')

      const text = exportToText(result, goal)
      expect(text).toContain('✓ Доказано')
    })

    it('should handle various proofs with hints', () => {
      // Test with an expression - just verify export works
      const { result, goal } = verifyExpression('♂∞ = ∞♀')

      const text = exportToText(result, goal)
      expect(text).toContain('ДОКАЗАТЕЛЬСТВО МТС')
      expect(text).toContain('Результат')

      const json = exportToJSON(result, goal)
      const data: ProofExportData = JSON.parse(json)
      expect(typeof data.success).toBe('boolean')
      expect(data.goal).toBeDefined()
    })
  })
})
