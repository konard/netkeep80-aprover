/**
 * Example: Proof Export
 *
 * This example demonstrates how to export proofs to various formats:
 * - LaTeX (for academic papers)
 * - Plain text (for documentation)
 * - JSON (for machine processing)
 * - DOT (for Graphviz visualization)
 *
 * Run: npx ts-node examples/proof-export.ts
 */

import { parseExpr } from '../src/core/parser'
import { createProverState, verify } from '../src/core/prover'
import { toCanonicalString } from '../src/core/normalizer'
import {
  exportToLaTeX,
  exportToText,
  exportToJSON,
  exportToDOT,
  exportProof,
  getExportExtension,
  getExportMimeType,
  astToLaTeX,
} from '../src/core/proofExport'

console.log('='.repeat(60))
console.log('Proof Export Example')
console.log('='.repeat(60))
console.log()

// Create prover state and prove something
const state = createProverState()
const goal = parseExpr('∞ = ∞ -> ∞')
const result = verify(goal, state)

console.log(`Proving: ${toCanonicalString(goal)}`)
console.log(`Result: ${result.success ? 'Success' : 'Failed'}`)
console.log()

// ============================================================================
// 1. LaTeX Export
// ============================================================================
console.log('1. LATEX EXPORT')
console.log('-'.repeat(40))

// Basic LaTeX export
const latexBasic = exportToLaTeX(result, goal, {
  standalone: false,
  language: 'ru',
})
console.log('Basic LaTeX output:')
console.log(latexBasic.slice(0, 500) + '...\n')

// Standalone LaTeX document
const latexFull = exportToLaTeX(result, goal, {
  standalone: true,
  useProofEnvironment: true,
  includeAxiomDefinitions: true,
  language: 'ru',
})
console.log(`Full LaTeX document length: ${latexFull.length} characters`)
console.log()

// ============================================================================
// 2. Text Export
// ============================================================================
console.log('2. TEXT EXPORT')
console.log('-'.repeat(40))

const textOutput = exportToText(result, goal, {
  includeStepNumbers: true,
  includeTimestamps: true,
  includeAxiomDescriptions: true,
  language: 'ru',
})
console.log('Text output:')
console.log(textOutput)
console.log()

// ============================================================================
// 3. JSON Export
// ============================================================================
console.log('3. JSON EXPORT')
console.log('-'.repeat(40))

const jsonOutput = exportToJSON(result, goal, state, {
  pretty: true,
  includeAST: false,
  includeState: true,
  includeTimestamps: true,
})
console.log('JSON output (truncated):')
console.log(jsonOutput.slice(0, 800) + '...\n')
console.log()

// ============================================================================
// 4. DOT Graph Export
// ============================================================================
console.log('4. DOT GRAPH EXPORT')
console.log('-'.repeat(40))

const dotOutput = exportToDOT(result, goal, {
  rankdir: 'TB',
  includeAxiomLabels: true,
  nodeShape: 'box',
  colorScheme: 'colorful',
  includeLegend: true,
})
console.log('DOT output (for Graphviz):')
console.log(dotOutput.slice(0, 600) + '...\n')
console.log()

// ============================================================================
// 5. Using the universal export function
// ============================================================================
console.log('5. UNIVERSAL EXPORT FUNCTION')
console.log('-'.repeat(40))

const formats: Array<'latex' | 'text' | 'json' | 'dot'> = ['latex', 'text', 'json', 'dot']

for (const format of formats) {
  const ext = getExportExtension(format)
  const mime = getExportMimeType(format)
  const output = exportProof(format, result, goal, state, {})

  console.log(`Format: ${format}`)
  console.log(`  Extension: .${ext}`)
  console.log(`  MIME type: ${mime}`)
  console.log(`  Output length: ${output.length} characters`)
}
console.log()

// ============================================================================
// 6. Converting AST to LaTeX
// ============================================================================
console.log('6. AST TO LATEX CONVERSION')
console.log('-'.repeat(40))

const expressions = ['∞', '∞ -> ∞', '♂∞', '∞♀', '!x', 'a^3', '{x, y, z}']

console.log('Expression -> LaTeX:')
for (const exprStr of expressions) {
  const expr = parseExpr(exprStr)
  const latex = astToLaTeX(expr)
  console.log(`  ${exprStr} -> ${latex}`)
}
console.log()

// ============================================================================
// 7. Exporting failed proofs with hints
// ============================================================================
console.log('7. EXPORTING FAILED PROOFS')
console.log('-'.repeat(40))

// Try to prove something that fails
const failGoal = parseExpr('x = y')
const failResult = verify(failGoal, state)

console.log(`Attempting to prove: ${toCanonicalString(failGoal)}`)
console.log(`Result: ${failResult.success ? 'Success' : 'Failed'}`)

if (!failResult.success) {
  const failText = exportToText(failResult, failGoal, {
    includeStepNumbers: true,
    language: 'ru',
  })
  console.log('\nFailed proof export:')
  console.log(failText)
}
console.log()

console.log('='.repeat(60))
console.log('Proof export example completed!')
console.log('='.repeat(60))
