/**
 * Example: Interactive Proof Session
 *
 * This example demonstrates how to use the interactive proof mode
 * for step-by-step theorem proving with undo/redo support.
 *
 * Run: npx ts-node examples/interactive-proof.ts
 */

import { parseExpr } from '../src/core/parser'
import { toCanonicalString } from '../src/core/normalizer'
import {
  createProofSession,
  quickProof,
  getSuggestedSteps,
  STRATEGY_DESCRIPTIONS,
} from '../src/core/interactive'
import { createProverState } from '../src/core/prover'

console.log('='.repeat(60))
console.log('Interactive Proof Session Example')
console.log('='.repeat(60))
console.log()

// ============================================================================
// 1. Understanding proof strategies
// ============================================================================
console.log('1. PROOF STRATEGIES')
console.log('-'.repeat(40))

for (const [key, desc] of Object.entries(STRATEGY_DESCRIPTIONS)) {
  console.log(`  ${key}: ${desc.name}`)
  console.log(`    ${desc.description}`)
}
console.log()

// ============================================================================
// 2. Creating an interactive session
// ============================================================================
console.log('2. CREATING A SESSION')
console.log('-'.repeat(40))

// Create session with guided strategy
const session = createProofSession('guided')
console.log(`Session created with strategy: ${session.getStrategy()}`)
console.log(`Initial status: ${session.status}`)
console.log()

// ============================================================================
// 3. Adding goals
// ============================================================================
console.log('3. ADDING GOALS')
console.log('-'.repeat(40))

// Add goals from strings
session.addGoalFromString('∞ = ∞ -> ∞')
session.addGoalFromString('♂v = ♂v -> v')

console.log(`Goals added. Status: ${session.status}`)
console.log('Remaining goals:')
for (const goal of session.getRemainingGoals()) {
  console.log(`  - ${toCanonicalString(goal)}`)
}

// Current goal
const currentGoal = session.getCurrentGoal()
if (currentGoal) {
  console.log(`\nCurrent goal: ${toCanonicalString(currentGoal)}`)
}
console.log()

// ============================================================================
// 4. Getting available steps
// ============================================================================
console.log('4. AVAILABLE STEPS')
console.log('-'.repeat(40))

const availableSteps = session.getAvailableSteps()
console.log(`Found ${availableSteps.length} available steps:`)
for (const step of availableSteps.slice(0, 5)) {
  console.log(`  [${step.id.slice(0, 15)}...] ${step.description}`)
  console.log(`    Confidence: ${(step.confidence * 100).toFixed(0)}%`)
  if (step.axiom) {
    console.log(`    Axiom: ${step.axiom.id}`)
  }
}
console.log()

// ============================================================================
// 5. Applying steps manually
// ============================================================================
console.log('5. APPLYING STEPS')
console.log('-'.repeat(40))

// Apply the best step (highest confidence)
console.log('Applying best step...')
const result = session.applyBestStep()
console.log(`Step result: ${result.success ? 'success' : 'failed'}`)
if (result.result) {
  console.log(`  Message: ${result.result.message}`)
}
console.log(`Session status: ${session.status}`)
console.log(`Remaining goals: ${session.getRemainingGoals().length}`)
console.log()

// ============================================================================
// 6. History and undo/redo
// ============================================================================
console.log('6. HISTORY AND UNDO/REDO')
console.log('-'.repeat(40))

console.log('History:')
const history = session.getHistory()
for (const entry of history) {
  const date = new Date(entry.timestamp).toLocaleTimeString()
  console.log(`  [${entry.index}] ${entry.description} (${date})`)
}

console.log(`\nCan undo: ${session.canUndo()}`)
console.log(`Can redo: ${session.canRedo()}`)

if (session.canUndo()) {
  console.log('\nPerforming undo...')
  session.undo()
  console.log(`After undo - remaining goals: ${session.getRemainingGoals().length}`)
  console.log(`Can redo now: ${session.canRedo()}`)

  console.log('\nPerforming redo...')
  session.redo()
  console.log(`After redo - remaining goals: ${session.getRemainingGoals().length}`)
}
console.log()

// ============================================================================
// 7. Automatic proof mode
// ============================================================================
console.log('7. AUTOMATIC PROOF')
console.log('-'.repeat(40))

// Create a new session for automatic proof
const autoSession = createProofSession('automatic')
autoSession.addGoalFromString('∞ = ∞ -> ∞')

console.log('Running automatic proof...')
const autoResults = autoSession.runAutomatic()
console.log(`Automatic proof completed with ${autoResults.length} steps`)
console.log(`Final status: ${autoSession.status}`)

// Show all proof steps taken
console.log('\nProof steps:')
for (const step of autoSession.getProofSteps()) {
  console.log(`  [${step.index}] ${step.action}`)
}
console.log()

// ============================================================================
// 8. Quick proof utility
// ============================================================================
console.log('8. QUICK PROOF UTILITY')
console.log('-'.repeat(40))

const testGoals = ['∞ = ∞ -> ∞', '♂v = ♂v -> v', 'r♀ = r -> r♀']

for (const goalStr of testGoals) {
  const goal = parseExpr(goalStr)
  const state = createProverState()
  const quickResult = quickProof(goal, state)

  const status = quickResult.success ? '✓' : '✗'
  console.log(`${status} ${goalStr} (${quickResult.steps.length} steps)`)
}
console.log()

// ============================================================================
// 9. Getting step suggestions
// ============================================================================
console.log('9. STEP SUGGESTIONS')
console.log('-'.repeat(40))

const suggestionGoal = parseExpr('∞ = ∞ -> ∞')
const state = createProverState()
const suggestions = getSuggestedSteps(suggestionGoal, state, 3)

console.log(`Top 3 suggestions for "${toCanonicalString(suggestionGoal)}":`)
for (const suggestion of suggestions) {
  console.log(`  - ${suggestion.description} (${(suggestion.confidence * 100).toFixed(0)}%)`)
}
console.log()

console.log('='.repeat(60))
console.log('Interactive proof example completed!')
console.log('='.repeat(60))
