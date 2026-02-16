/**
 * Example: Using aprover as a library
 *
 * This example demonstrates how to use the aprover library programmatically
 * for parsing, normalizing, and verifying МТС expressions.
 *
 * Run: npx ts-node examples/library-usage.ts
 */

// Import core modules
import { parse, parseExpr } from '../src/core/parser'
import { normalize, toCanonicalString } from '../src/core/normalizer'
import { createProverState, verify, AXIOMS } from '../src/core/prover'
import { astToString } from '../src/core/ast'

console.log('='.repeat(60))
console.log('aprover Library Usage Example')
console.log('='.repeat(60))
console.log()

// ============================================================================
// 1. Parsing МТС expressions
// ============================================================================
console.log('1. PARSING EXPRESSIONS')
console.log('-'.repeat(40))

// Parse a single expression
const expr1 = parseExpr('∞ -> ∞')
console.log('Parsed expression:', astToString(expr1))
console.log('Expression type:', expr1.type)

// Parse multiple statements from a file
const fileContent = `
// This is a comment
∞ = ∞ -> ∞
♂v = ♂v -> v
r♀ = r -> r♀
`
const file = parse(fileContent)
console.log(`\nParsed file with ${file.statements.length} statements:`)
for (const stmt of file.statements) {
  console.log(`  - ${astToString(stmt.expr)}`)
}
console.log()

// ============================================================================
// 2. Normalizing expressions
// ============================================================================
console.log('2. NORMALIZING EXPRESSIONS')
console.log('-'.repeat(40))

// The normalizer applies canonical form rules
const beforeNorm = parseExpr('!!x')
const afterNorm = normalize(beforeNorm)
console.log(`!!x normalizes to: ${astToString(afterNorm)}`)

// Power expansion
const power = parseExpr('a^3')
const expandedPower = normalize(power)
console.log(`a^3 expands to: ${astToString(expandedPower)}`)

// Male/Female inversion
const maleInv = parseExpr('!(♂x)')
const femaleResult = normalize(maleInv)
console.log(`!(♂x) normalizes to: ${astToString(femaleResult)}`)

// Canonical string representation (for comparison)
const canonical1 = toCanonicalString(parseExpr('∞ -> ∞'))
const canonical2 = toCanonicalString(parseExpr('(∞ -> ∞)'))
console.log(`\nCanonical forms are equal: ${canonical1 === canonical2}`)
console.log()

// ============================================================================
// 3. Creating and using the prover
// ============================================================================
console.log('3. PROVING THEOREMS')
console.log('-'.repeat(40))

// Create a prover state with built-in axioms
const state = createProverState()

// Verify various expressions
const tests = [
  '∞ = ∞ -> ∞', // Axiom A4
  '♂v = ♂v -> v', // Axiom A5
  'r♀ = r -> r♀', // Axiom A6
  '!∞ = ∞', // Axiom A7
  '!!x = x', // Double negation elimination
]

for (const test of tests) {
  const expr = parseExpr(test)
  const result = verify(expr, state)
  const status = result.success ? '✓' : '✗'
  console.log(`${status} ${test}`)
  if (result.success && result.appliedAxioms) {
    const axiomIds = [...new Set(result.appliedAxioms.map((a) => a.id))]
    console.log(`  Applied: ${axiomIds.join(', ')}`)
  }
}
console.log()

// ============================================================================
// 4. Working with definitions
// ============================================================================
console.log('4. WORKING WITH DEFINITIONS')
console.log('-'.repeat(40))

// Add a custom definition
const defExpr = parseExpr('myLink : (x -> y)')
const defResult = verify(defExpr, state)
console.log(`Definition added: ${defResult.success}`)
console.log(`Definitions in state: ${Array.from(state.definitions.keys()).join(', ')}`)
console.log()

// ============================================================================
// 5. Accessing axiom information
// ============================================================================
console.log('5. AXIOM INFORMATION')
console.log('-'.repeat(40))

console.log('Available axioms:')
for (const [id, axiom] of Object.entries(AXIOMS)) {
  console.log(`  ${id}: ${axiom.name}`)
  console.log(`      ${axiom.formula}`)
}
console.log()

// ============================================================================
// 6. Detailed proof steps
// ============================================================================
console.log('6. DETAILED PROOF STEPS')
console.log('-'.repeat(40))

const detailedExpr = parseExpr('∞ = ∞ -> ∞')
const detailedResult = verify(detailedExpr, state)

if (detailedResult.proofSteps) {
  console.log('Proof steps for "∞ = ∞ -> ∞":')
  for (const step of detailedResult.proofSteps) {
    console.log(`  [${step.index}] ${step.action}`)
    if (step.axiom) {
      console.log(`      Axiom: ${step.axiom.id} - ${step.axiom.name}`)
    }
    if (step.details) {
      console.log(`      Details: ${step.details}`)
    }
  }
}
console.log()

// ============================================================================
// 7. Error handling
// ============================================================================
console.log('7. ERROR HANDLING')
console.log('-'.repeat(40))

import { LexerError } from '../src/core/lexer'
import { ParseError } from '../src/core/parser'

// Lexer error
try {
  parseExpr('$$invalid$$')
} catch (e) {
  if (e instanceof LexerError) {
    console.log(`Lexer error: ${e.message}`)
  }
}

// Parse error
try {
  parseExpr('∞ = (')
} catch (e) {
  if (e instanceof ParseError) {
    console.log(`Parse error: ${e.message}`)
  }
}

console.log()
console.log('='.repeat(60))
console.log('Example completed!')
console.log('='.repeat(60))
