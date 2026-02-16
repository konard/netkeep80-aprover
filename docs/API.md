# API Documentation

This document describes the public API for the aprover library, which implements a theorem prover for the Meta-Theory of Links (МТС) formal notation.

## Installation and Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Core Modules

### 1. AST Module (`src/core/ast.ts`)

The AST module defines the abstract syntax tree nodes for МТС expressions.

#### Types

```typescript
import type {
  ASTNode,
  SourceLocation,
  LinkExpr,
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
  File
} from './core/ast'
```

| Type | Description | Example |
|------|-------------|---------|
| `LinkExpr` | Link expression `a -> b` | `(∞ -> ∞)` |
| `DefExpr` | Definition `s : F` | `x : (x -> y)` |
| `EqExpr` | Equality `A = B` | `∞ = (∞ -> ∞)` |
| `NeqExpr` | Inequality `A != B` | `x != y` |
| `MaleExpr` | Self-closing start `♂x` | `♂∞` |
| `FemaleExpr` | Self-closing end `x♀` | `∞♀` |
| `NotExpr` | Negation `!x` | `!∞` |
| `PowerExpr` | Power `a^n` | `x^3` |
| `SetExpr` | Set `{A, B}` | `{x, y, z}` |
| `InfinityExpr` | Infinity `∞` | `∞` |
| `NumExpr` | Number (0 or 1) | `1` |
| `IdentExpr` | Identifier | `variable` |

#### Type Guards

```typescript
import {
  isLinkExpr,
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
  isBracketExpr
} from './core/ast'

// Example
if (isLinkExpr(node)) {
  console.log(node.left, node.right)
}
```

#### Utility Functions

```typescript
import { astToString } from './core/ast'

// Convert AST to string representation
const str = astToString(node) // "(∞ -> ∞)"
```

---

### 2. Lexer Module (`src/core/lexer.ts`)

The lexer converts source code into tokens.

#### Classes

```typescript
import { Lexer, LexerError } from './core/lexer'

// Create lexer
const lexer = new Lexer('∞ -> ∞')

// Get tokens
const tokens = lexer.tokenize()
```

#### Functions

```typescript
import { tokenize } from './core/lexer'

// Convenience function
const tokens = tokenize('∞ = ∞ -> ∞')
```

#### Token Types

```typescript
type TokenType =
  | 'ARROW'        // ->
  | 'NOT_ARROW'    // !->
  | 'DEFINE'       // :
  | 'EQUAL'        // =
  | 'NOT_EQUAL'    // !=
  | 'MALE'         // ♂
  | 'FEMALE'       // ♀
  | 'NOT'          // !
  | 'POWER'        // ^
  | 'INFINITY'     // ∞
  | 'ZERO'         // 0
  | 'ONE'          // 1
  | 'LPAREN'       // (
  | 'RPAREN'       // )
  | 'LBRACE'       // {
  | 'RBRACE'       // }
  | 'LBRACKET'     // [
  | 'RBRACKET'     // ]
  | 'COMMA'        // ,
  | 'DOT'          // .
  | 'ABIT_LIT'     // '...'
  | 'STRING_LIT'   // "..."
  | 'ID'           // identifier
  | 'NAT'          // natural number
  | 'EOF'
```

---

### 3. Parser Module (`src/core/parser.ts`)

The parser converts tokens into an abstract syntax tree.

#### Classes

```typescript
import { Parser, ParseError } from './core/parser'

const tokens = tokenize('∞ = ∞ -> ∞')
const parser = new Parser(tokens)
const file = parser.parseFile()
```

#### Functions

```typescript
import { parse, parseWithRecovery, parseExpr } from './core/parser'

// Parse a complete file
const file = parse('x : (x -> y)\n∞ = ∞ -> ∞')

// Parse with error recovery (returns partial AST on error)
const result = parseWithRecovery('∞ = ∞ -> ∞')
if (result.error) {
  console.error(result.error.message)
}

// Parse a single expression
const expr = parseExpr('∞ -> ∞')
```

---

### 4. Normalizer Module (`src/core/normalizer.ts`)

The normalizer transforms AST nodes to canonical form.

#### Functions

```typescript
import {
  normalize,
  normalizeFile,
  toCanonicalString,
  astEqual,
  clearNormalizationCache,
  setNormalizationCacheEnabled,
  getNormalizationCacheStats
} from './core/normalizer'

// Normalize a single expression
const normalized = normalize(expr)

// Normalize an entire file
const normalizedFile = normalizeFile(file)

// Convert AST to canonical string (for comparison)
const canonical = toCanonicalString(expr) // "(∞->∞)"

// Check structural equality
const equal = astEqual(expr1, expr2)

// Cache management
clearNormalizationCache()
setNormalizationCacheEnabled(true)
const stats = getNormalizationCacheStats()
// stats: { size: number, hits: number, misses: number, hitRate: number }
```

#### Normalization Options

```typescript
interface NormalizerOptions {
  desugarNotLink?: boolean     // Convert !-> to !(a -> b)
  expandPower?: boolean        // Expand a^n
  canonicalize?: boolean       // Apply canonical form rules
  checkGuardedRecursion?: boolean  // Check recursion safety
}

// Example with options
const normalized = normalize(expr, {
  expandPower: false,  // Keep power expressions
  canonicalize: true
})
```

---

### 5. Prover Module (`src/core/prover.ts`)

The main theorem prover implementing МТС axioms.

#### Types

```typescript
import type {
  ProverState,
  ProofResult,
  ProofStep,
  AxiomInfo,
  AxiomId,
  Substitution,
  ProvenEquality,
  ProvenImplication,
  VerificationHint
} from './core/prover'
```

#### Constants

```typescript
import { AXIOMS } from './core/prover'

// Access axiom information
const a4 = AXIOMS.A4
// { id: 'A4', name: 'Смысл (акорень)', formula: '∞ : (∞ → ∞)', description: '...' }
```

#### Functions

```typescript
import {
  createProverState,
  verify,
  checkEquality,
  checkInequality,
  unify,
  applySubstitution,
  expandDefinitions,
  addProvenFact,
  addProvenImplication,
  addProvenEquality,
  tryModusPonens,
  applyModusPonens
} from './core/prover'

// Create a new prover state with built-in axioms
const state = createProverState()

// Verify an expression
const result = verify(expr, state)
if (result.success) {
  console.log('Proven:', result.message)
  console.log('Steps:', result.proofSteps)
  console.log('Axioms used:', result.appliedAxioms)
} else {
  console.log('Failed:', result.message)
  console.log('Hints:', result.hints)
}

// Check equality directly
const eqResult = checkEquality(left, right, state)

// Unification
const subst = unify(expr1, expr2)
if (subst) {
  const applied = applySubstitution(expr, subst)
}

// Modus Ponens
addProvenFact(state, factExpr)
addProvenImplication(state, antecedent, consequent, 'source')
const mpResult = tryModusPonens(goal, state)
const derivedFacts = applyModusPonens(state)
```

#### Complete Example

```typescript
import { parse, parseExpr } from './core/parser'
import { createProverState, verify } from './core/prover'

// Create prover state
const state = createProverState()

// Parse and verify expressions
const file = parse(`
// Define a custom relation
myLink : (x -> y)

// Verify equality (Axiom A4: ∞ = (∞ -> ∞))
∞ = ∞ -> ∞

// Verify Male axiom (A5: ♂x = (♂x -> x))
♂v = ♂v -> v

// Verify Female axiom (A6: x♀ = (x -> x♀))
r♀ = r -> r♀
`)

for (const stmt of file.statements) {
  const result = verify(stmt.expr, state)
  console.log(`${result.success ? '✓' : '✗'} ${result.message}`)
}
```

---

### 6. Interactive Module (`src/core/interactive.ts`)

Interactive proof session management with step-by-step control.

#### Types

```typescript
import type {
  ProofStrategy,
  StepType,
  AvailableStep,
  ProofSnapshot,
  StepResult,
  SessionStatus
} from './core/interactive'
```

#### Classes

```typescript
import { ProofSession } from './core/interactive'

// Create session with strategy
const session = new ProofSession('guided') // 'automatic' | 'manual' | 'guided'

// Add goals
session.addGoal(expr)
session.addGoalFromString('∞ = ∞ -> ∞')

// Get available steps
const steps = session.getAvailableSteps()
for (const step of steps) {
  console.log(`${step.description} (confidence: ${step.confidence})`)
}

// Apply a step
const result = session.applyStep(steps[0].id)

// Or apply best step automatically
const result = session.applyBestStep()

// Run automatic proof
const results = session.runAutomatic()

// Undo/Redo
session.undo()
session.redo()

// Navigate history
const history = session.getHistory()
session.jumpToHistory(2)

// Check status
console.log(session.status) // 'initial' | 'in_progress' | 'completed' | 'failed'

// Reset
session.reset()
```

#### Functions

```typescript
import {
  createProofSession,
  getSuggestedSteps,
  quickProof,
  STRATEGY_DESCRIPTIONS
} from './core/interactive'

// Create session
const session = createProofSession('guided')

// Get step suggestions
const suggestions = getSuggestedSteps(goal, state, 5)

// Quick automatic proof
const result = quickProof(goal, state)
if (result.success) {
  console.log('Proof steps:', result.steps)
}
```

---

### 7. Proof Export Module (`src/core/proofExport.ts`)

Export proofs to various formats.

#### Types

```typescript
import type {
  ExportFormat,
  LaTeXExportOptions,
  TextExportOptions,
  JSONExportOptions,
  DOTExportOptions,
  ProofExportData
} from './core/proofExport'
```

#### Functions

```typescript
import {
  exportToLaTeX,
  exportToText,
  exportToJSON,
  exportToDOT,
  exportProof,
  astToLaTeX,
  stringToLaTeX,
  getExportExtension,
  getExportMimeType
} from './core/proofExport'

// Export to LaTeX
const latex = exportToLaTeX(result, goal, {
  standalone: true,
  useProofEnvironment: true,
  includeAxiomDefinitions: true,
  language: 'ru'
})

// Export to human-readable text
const text = exportToText(result, goal, {
  includeStepNumbers: true,
  includeTimestamps: false,
  includeAxiomDescriptions: true,
  language: 'ru'
})

// Export to JSON
const json = exportToJSON(result, goal, state, {
  pretty: true,
  includeAST: true,
  includeState: true
})

// Export to DOT (Graphviz)
const dot = exportToDOT(result, goal, {
  rankdir: 'TB',
  includeAxiomLabels: true,
  nodeShape: 'box',
  colorScheme: 'colorful',
  includeLegend: true
})

// Universal export function
const output = exportProof('latex', result, goal, state, options)

// Get file extension and MIME type
const ext = getExportExtension('latex') // 'tex'
const mime = getExportMimeType('latex') // 'application/x-latex'

// Convert AST to LaTeX
const latexExpr = astToLaTeX(expr) // "\\infty \\to \\infty"
```

---

### 8. String Aнumber Module (`src/core/stringAnum.ts`)

Parse and convert string aнumbers (.astr files).

#### Functions

```typescript
import {
  parseStringAnum,
  parseStringAnumLine,
  parseStringAnumExpr,
  toStringAnum,
  isStringAnumExpr,
  stringAnumToFormal,
  stringAnumFileToMtl,
  visualizeConversion,
  getStringAnumStats
} from './core/stringAnum'

// Parse .astr content
const file = parseStringAnum('связь\nlink\nHello')

// Convert to formal notation
const formal = stringAnumToFormal('связь') // "(∞ -> с) -> в) -> ..."

// Visualize conversion steps
const steps = visualizeConversion('test')
for (const step of steps) {
  console.log(`${step.char}: ${step.formal}`)
}

// Get statistics
const stats = getStringAnumStats('Hello')
// { length: 5, chars: ['H','e','l','l','o'], codePoints: [...] }
```

---

### 9. Quaternary Aнumber Module (`src/core/quatAnum.ts`)

Parse and convert quaternary (abit) aнumbers (.anum files).

#### Functions

```typescript
import {
  parseQuatAnum,
  parseQuatAnumLine,
  parseQuatAnumExpr,
  toQuatAnum,
  isQuatAnumExpr,
  quatAnumToFormal,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  isValidAbit,
  validateQuatAnum,
  cleanQuatAnum,
  isQuatAnumContent
} from './core/quatAnum'

// Parse .anum content
const file = parseQuatAnum('1\n0\n[]\n0101')

// Convert to formal notation
const formal = quatAnumToFormal('01') // "(∞♀ -> ♂∞) -> (♂∞ -> ∞♀)"

// Visualize conversion
const steps = visualizeQuatConversion('01[]')
for (const step of steps) {
  console.log(`${step.abit}: ${step.formal} (${step.description})`)
}

// Get statistics
const stats = getQuatAnumStats('[01]')
// { zeros: 1, ones: 1, opens: 1, closes: 1, depth: 1, balanced: true }

// Validate content
const { valid, error } = validateQuatAnum('[01]')
```

---

### 10. File I/O Module (`src/core/fileIO.ts`)

File operations for loading and saving.

#### Functions

```typescript
import {
  readFileContent,
  isSupportedFile,
  getFileExtension,
  getFilePreview,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  saveAutosave,
  loadAutosave,
  formatResultsForExport,
  downloadFile,
  openFileDialog
} from './core/fileIO'

// Check if file is supported
const supported = isSupportedFile('example.mtl') // true

// Get file extension
const ext = getFileExtension('example.mtl') // 'mtl'

// Read file content (browser)
const content = await readFileContent(file)

// Recent files management
const recent = getRecentFiles()
addRecentFile('example.mtl', 'file content preview...')
removeRecentFile('example.mtl')

// Autosave
saveAutosave('current editor content')
const saved = loadAutosave()

// Download file
downloadFile('content', 'example.mtl')
```

---

## Complete Usage Example

```typescript
import { parse, parseExpr } from './core/parser'
import { normalize, toCanonicalString } from './core/normalizer'
import { createProverState, verify, AXIOMS } from './core/prover'
import { createProofSession } from './core/interactive'
import { exportToLaTeX, exportToJSON } from './core/proofExport'

// 1. Parse input
const input = `
// МТС Axioms verification
∞ = ∞ -> ∞
♂v = ♂v -> v
r♀ = r -> r♀
`
const file = parse(input)

// 2. Create prover state
const state = createProverState()

// 3. Verify each statement
const results = []
for (const stmt of file.statements) {
  const normalized = normalize(stmt.expr)
  const result = verify(normalized, state)
  results.push({
    expression: toCanonicalString(normalized),
    result
  })
}

// 4. Export results
for (const { expression, result } of results) {
  console.log(`${result.success ? '✓' : '✗'} ${expression}`)

  if (result.success) {
    // Export to LaTeX
    const latex = exportToLaTeX(result, parseExpr(expression), {
      standalone: false,
      language: 'ru'
    })
    console.log('LaTeX:', latex)

    // Export to JSON
    const json = exportToJSON(result, parseExpr(expression), state, {
      pretty: true
    })
    console.log('JSON:', json)
  }
}

// 5. Interactive proof session
const session = createProofSession('guided')
session.addGoalFromString('∞ = ∞ -> ∞')

// Get suggestions
const steps = session.getAvailableSteps()
console.log('Available steps:')
for (const step of steps.slice(0, 3)) {
  console.log(`  - ${step.description} (${step.confidence.toFixed(2)})`)
}

// Run automatic proof
const autoResults = session.runAutomatic()
console.log(`Session status: ${session.status}`)
```

---

## Axiom System Reference

The prover implements the МТС v0.1 axiom system:

| ID | Name | Formula | Description |
|----|------|---------|-------------|
| A0 | Определение | `(s : F) → (s = F)` | Definition as form query |
| A1 | Тождественность | `x = x` | Reflexivity, symmetry, transitivity |
| A2 | Конгруэнция | `{(a = c), (b = d)} → ((a → b) = (c → d))` | Structural transparency |
| A3 | Связь | `be : (b → e)` | Basic constructor |
| A4 | Акорень | `∞ : (∞ → ∞)` | Complete self-closure |
| A5 | Самозамыкание начала | `♂x : (♂x → x)` | Start self-closure |
| A6 | Самозамыкание конца | `x♀ : (x → x♀)` | End self-closure |
| A7 | Инверсия | `!(a → b) = (b → a)` | Duality |
| A8 | Единица смысла | `1 : (♂∞ → ∞♀)` | Directed link |
| A9 | Нуль смысла | `0 : !1` | Unit inverse |
| A10 | Абиты | `'[' : ♂∞, ']' : ∞♀` | Quaternary system |
| A11 | Левоассоциативность | `(a → b → c) = ((a → b) → c)` | Grouping order |
| MP | Modus Ponens | `P, (P → Q) ⊢ Q` | Inference rule |

---

## Error Handling

All modules provide typed errors for better debugging:

```typescript
import { LexerError } from './core/lexer'
import { ParseError } from './core/parser'
import { NormalizationError } from './core/normalizer'

try {
  const tokens = tokenize('invalid $$$ syntax')
} catch (e) {
  if (e instanceof LexerError) {
    console.error(`Lexer error at ${e.line}:${e.column}: ${e.message}`)
  }
}

try {
  const file = parse('∞ = (')
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`Parse error at ${e.token.loc.start.line}: ${e.message}`)
  }
}
```

---

## TypeScript Support

All modules are written in TypeScript with full type definitions. Import types using:

```typescript
import type { ASTNode, LinkExpr } from './core/ast'
import type { ProverState, ProofResult } from './core/prover'
import type { ProofSession, AvailableStep } from './core/interactive'
```
