/**
 * Prover kernel for МТС (Meta-Theory of Links)
 *
 * The prover implements a minimal kernel based on:
 * - Modus Ponens: if P and (P -> Q) then Q
 * - Structural unification for equality checking
 * - Built-in axioms from МТС v0.1
 */

import type { ASTNode, LinkExpr, EqExpr } from './ast'
import {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isBracketExpr,
} from './ast'
import { parseExpr } from './parser'
import { normalize, toCanonicalString, astEqual } from './normalizer'
import type { ProofMetrics, MetricsCollector } from './proofMetrics'
import { createMetricsCollector } from './proofMetrics'

/** Substitution: maps variable names to AST nodes */
export type Substitution = Map<string, ASTNode>

/**
 * Axiom identifiers for МТС v0.1
 */
export type AxiomId =
  | 'A0' // Definition: (s : F) -> (s = F)
  | 'A1' // Identity: x = x, symmetry, transitivity
  | 'A2' // Congruence: {(a = c), (b = d)} -> ((a -> b) = (c -> d))
  | 'A3' // Link: be : (b -> e)
  | 'A4' // Смысл (акорень): ∞ : (∞ -> ∞)
  | 'A5' // Самозамыкание начала: ♂x : (♂x -> x)
  | 'A6' // Самозамыкание конца: x♀ : (x -> x♀)
  | 'A7' // Инверсия: !(a -> b) = (b -> a), !(♂x) = x♀, !(x♀) = ♂x, !∞ = ∞, !!x = x
  | 'A8' // Единица смысла: 1 : (♂∞ -> ∞♀)
  | 'A9' // Нуль смысла: 0 : !1
  | 'A10' // Абиты: '[' : ♂∞, ']' : ∞♀, '1' : 1, '0' : 0
  | 'A11' // Левоассоциативность: (a -> b -> c) = ((a -> b) -> c)
  | 'MP' // Modus Ponens: если P и (P → Q), то Q

/**
 * Axiom information for display
 */
export interface AxiomInfo {
  id: AxiomId
  name: string
  formula: string
  description: string
}

/**
 * All axioms with their descriptions
 */
export const AXIOMS: Record<AxiomId, AxiomInfo> = {
  A0: {
    id: 'A0',
    name: 'Определение',
    formula: '(s : F) → (s = F)',
    description: 'Знак как запрос по форме',
  },
  A1: {
    id: 'A1',
    name: 'Тождественность',
    formula: 'x = x',
    description: 'Рефлексивность, симметрия, транзитивность',
  },
  A2: {
    id: 'A2',
    name: 'Конгруэнция',
    formula: '{(a = c), (b = d)} → ((a → b) = (c → d))',
    description: 'Структурная прозрачность',
  },
  A3: {
    id: 'A3',
    name: 'Связь',
    formula: 'be : (b → e)',
    description: 'Базовый конструктор',
  },
  A4: {
    id: 'A4',
    name: 'Смысл (акорень)',
    formula: '∞ : (∞ → ∞)',
    description: 'Полное самозамыкание',
  },
  A5: {
    id: 'A5',
    name: 'Самозамыкание начала',
    formula: '♂x : (♂x → x)',
    description: 'Начало замкнуто на связь',
  },
  A6: {
    id: 'A6',
    name: 'Самозамыкание конца',
    formula: 'x♀ : (x → x♀)',
    description: 'Конец замкнут на связь',
  },
  A7: {
    id: 'A7',
    name: 'Инверсия',
    formula: '!(a → b) = (b → a), !(♂x) = x♀, !(x♀) = ♂x, !∞ = ∞, !!x = x',
    description: 'Дуальность',
  },
  A8: {
    id: 'A8',
    name: 'Единица смысла',
    formula: '1 : (♂∞ → ∞♀)',
    description: 'Направленная связь',
  },
  A9: {
    id: 'A9',
    name: 'Нуль смысла',
    formula: '0 : !1',
    description: 'Инверсия единицы',
  },
  A10: {
    id: 'A10',
    name: 'Абиты',
    formula: "'[' : ♂∞, ']' : ∞♀, '1' : 1, '0' : 0",
    description: 'Четверичная система',
  },
  A11: {
    id: 'A11',
    name: 'Левоассоциативность',
    formula: '(a → b → c) = ((a → b) → c)',
    description: 'Порядок группировки',
  },
  MP: {
    id: 'MP',
    name: 'Modus Ponens',
    formula: 'P, (P → Q) ⊢ Q',
    description: 'Правило вывода: из P и (P → Q) следует Q',
  },
}

/**
 * Single proof step with detailed information
 */
export interface ProofStep {
  /** Step number (1-based) */
  index: number
  /** Description of the action performed */
  action: string
  /** Expression before transformation (optional) */
  before?: string
  /** Expression after transformation (optional) */
  after?: string
  /** Applied axiom (if any) */
  axiom?: AxiomInfo
  /** Additional details */
  details?: string
}

/**
 * Hint for failed verification
 */
export interface VerificationHint {
  /** Type of hint */
  type: 'structural' | 'definition' | 'axiom' | 'suggestion'
  /** Hint message */
  message: string
  /** Related axiom (if any) */
  relatedAxiom?: AxiomId
}

/** Proof result */
export interface ProofResult {
  success: boolean
  message: string
  /** Legacy steps (string array) for backward compatibility */
  steps?: string[]
  /** Detailed proof steps */
  proofSteps?: ProofStep[]
  /** Applied axioms */
  appliedAxioms?: AxiomInfo[]
  /** Hints for failed verification */
  hints?: VerificationHint[]
  substitution?: Substitution
  /** Proof metrics (steps, axioms, timing, complexity) */
  metrics?: ProofMetrics
}

/** Proven equality pair for transitivity/congruence resolution */
export interface ProvenEquality {
  left: ASTNode
  right: ASTNode
  normalized: boolean
}

/** Proven implication for Modus Ponens */
export interface ProvenImplication {
  antecedent: ASTNode // P in (P → Q)
  consequent: ASTNode // Q in (P → Q)
  source: string // Where this implication came from
}

/** Prover state */
export interface ProverState {
  /** Built-in axioms as (P -> Q) links */
  axioms: ASTNode[]
  /** User-defined definitions: s : F */
  definitions: Map<string, ASTNode>
  /** Proven facts (canonical string form) */
  facts: Set<string>
  /** Proven facts as AST nodes for Modus Ponens */
  provenFacts: ASTNode[]
  /** Proven equalities for transitivity/congruence */
  provenEqualities: ProvenEquality[]
  /** Proven implications for Modus Ponens */
  provenImplications: ProvenImplication[]
  /** Proof trace for debugging */
  trace: string[]
}

/**
 * Create initial prover state with built-in axioms
 */
export function createProverState(): ProverState {
  const state: ProverState = {
    axioms: [],
    definitions: new Map(),
    facts: new Set(),
    provenFacts: [],
    provenEqualities: [],
    provenImplications: [],
    trace: [],
  }

  // Add built-in axioms from МТС v0.1

  // А0. Definition: (s : F) -> (s = F)
  // This is a meta-axiom, handled specially

  // А1. Identity reflexivity: x = x
  state.facts.add('(x=x)')

  // А4. Смысл (акорень): ∞ : (∞ -> ∞)
  state.definitions.set('∞', parseAndNormalize('∞ -> ∞'))

  // А5. Самозамыкание начала: ♂x : (♂x -> x)
  // Schema: for any x, ♂x = (♂x -> x)

  // А6. Самозамыкание конца: x♀ : (x -> x♀)
  // Schema: for any x, x♀ = (x -> x♀)

  // А7. Инверсия: various rules
  // !(a -> b) = (b -> a) - handled by normalizer
  // !!x = x - handled by normalizer
  // !∞ = ∞
  addAxiomEq(state, '!∞', '∞')

  // А8. Единица смысла: 1 : (♂∞ -> ∞♀)
  state.definitions.set('1', parseAndNormalize('♂∞ -> ∞♀'))

  // А9. Нуль смысла: 0 : !1
  state.definitions.set('0', parseAndNormalize('!1'))

  // А10. Абиты
  state.definitions.set('[', parseAndNormalize('♂∞'))
  state.definitions.set(']', parseAndNormalize('∞♀'))

  // А11. Левоассоциативность: (a -> b -> c) = ((a -> b) -> c)
  // This is built into the parser

  return state
}

/** Helper to parse and normalize expression */
function parseAndNormalize(input: string): ASTNode {
  return normalize(parseExpr(input))
}

/** Helper to add equality axiom */
function addAxiomEq(state: ProverState, left: string, right: string): void {
  const l = parseAndNormalize(left)
  const r = parseAndNormalize(right)
  const eq: EqExpr = {
    type: 'Equality',
    left: l,
    right: r,
  }
  state.facts.add(toCanonicalString(eq))
}

/**
 * Try to unify two AST nodes
 * Returns substitution if successful, null if failed
 */
export function unify(
  a: ASTNode,
  b: ASTNode,
  subst: Substitution = new Map()
): Substitution | null {
  // Apply existing substitutions
  a = applySubstitution(a, subst)
  b = applySubstitution(b, subst)

  // Identical nodes
  if (toCanonicalString(a) === toCanonicalString(b)) {
    return subst
  }

  // Variable unification
  if (isIdentExpr(a) && isVariable(a.name)) {
    return unifyVar(a.name, b, subst)
  }
  if (isIdentExpr(b) && isVariable(b.name)) {
    return unifyVar(b.name, a, subst)
  }

  // Structural unification
  if (isLinkExpr(a) && isLinkExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isMaleExpr(a) && isMaleExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isFemaleExpr(a) && isFemaleExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isNotExpr(a) && isNotExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isSetExpr(a) && isSetExpr(b)) {
    if (a.elements.length !== b.elements.length) return null
    let s = subst
    for (let i = 0; i < a.elements.length; i++) {
      const s1 = unify(a.elements[i], b.elements[i], s)
      if (!s1) return null
      s = s1
    }
    return s
  }

  if (isEqExpr(a) && isEqExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isNeqExpr(a) && isNeqExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isDefExpr(a) && isDefExpr(b)) {
    const s1 = unify(a.name, b.name, subst)
    if (!s1) return null
    return unify(a.form, b.form, s1)
  }

  // Constants must be equal
  if (isInfinityExpr(a) && isInfinityExpr(b)) {
    return subst
  }

  if (isNumExpr(a) && isNumExpr(b) && a.value === b.value) {
    return subst
  }

  if (isBracketExpr(a) && isBracketExpr(b) && a.side === b.side) {
    return subst
  }

  return null
}

/** Check if name is a variable (lowercase single letter) */
function isVariable(name: string): boolean {
  return /^[a-z]$/.test(name)
}

/** Unify variable with term */
function unifyVar(varName: string, term: ASTNode, subst: Substitution): Substitution | null {
  // Check if already bound
  if (subst.has(varName)) {
    return unify(subst.get(varName)!, term, subst)
  }

  // Occurs check
  if (occursIn(varName, term)) {
    return null
  }

  // Bind variable
  const newSubst = new Map(subst)
  newSubst.set(varName, term)
  return newSubst
}

/** Check if variable occurs in term */
function occursIn(varName: string, term: ASTNode): boolean {
  if (isIdentExpr(term)) {
    return term.name === varName
  }

  if (isLinkExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right)
  }

  if (isMaleExpr(term) || isFemaleExpr(term) || isNotExpr(term)) {
    return occursIn(varName, term.operand)
  }

  if (isSetExpr(term)) {
    return term.elements.some(el => occursIn(varName, el))
  }

  if (isEqExpr(term) || isNeqExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right)
  }

  if (isDefExpr(term)) {
    return occursIn(varName, term.name) || occursIn(varName, term.form)
  }

  return false
}

/** Apply substitution to AST node */
export function applySubstitution(node: ASTNode, subst: Substitution): ASTNode {
  if (subst.size === 0) return node

  if (isIdentExpr(node)) {
    if (subst.has(node.name)) {
      return applySubstitution(subst.get(node.name)!, subst)
    }
    return node
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => applySubstitution(el, subst)),
    }
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isDefExpr(node)) {
    return {
      ...node,
      name: applySubstitution(node.name, subst),
      form: applySubstitution(node.form, subst),
    }
  }

  return node
}

/**
 * Expand definitions in AST node
 */
export function expandDefinitions(node: ASTNode, state: ProverState): ASTNode {
  if (isIdentExpr(node)) {
    if (state.definitions.has(node.name)) {
      return expandDefinitions(state.definitions.get(node.name)!, state)
    }
    return node
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => expandDefinitions(el, state)),
    }
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  return node
}

/**
 * Apply axiom schema: ♂x : (♂x -> x)
 */
function applyMaleAxiom(node: ASTNode): ASTNode | null {
  if (isMaleExpr(node)) {
    const x = node.operand
    return {
      type: 'Link',
      left: node,
      right: x,
    } as LinkExpr
  }
  return null
}

/**
 * Apply axiom schema: x♀ : (x -> x♀)
 */
function applyFemaleAxiom(node: ASTNode): ASTNode | null {
  if (isFemaleExpr(node)) {
    const x = node.operand
    return {
      type: 'Link',
      left: x,
      right: node,
    } as LinkExpr
  }
  return null
}

/**
 * Recursively collapse infinity expressions using axiom A4: ∞ = (∞ -> ∞)
 *
 * This function repeatedly applies A4 in reverse to reduce expressions like:
 * - (∞ -> ∞) -> ∞
 * - ((∞ -> ∞) -> ∞) -> ∞
 * - etc.
 *
 * All of these should collapse to ∞ because:
 * 1. ∞ = (∞ -> ∞) by A4
 * 2. Substituting left ∞: (∞ -> ∞) = ((∞ -> ∞) -> ∞)
 * 3. Therefore: ∞ = ((∞ -> ∞) -> ∞)
 * 4. And so on recursively...
 */
function collapseInfinity(node: ASTNode): ASTNode {
  // Base case: already ∞
  if (isInfinityExpr(node)) {
    return node
  }

  // Recursive case: (a -> b) where both a and b can collapse to ∞
  if (isLinkExpr(node)) {
    const collapsedLeft = collapseInfinity(node.left)
    const collapsedRight = collapseInfinity(node.right)

    // If both sides collapse to ∞, then (∞ -> ∞) collapses to ∞ by A4
    if (isInfinityExpr(collapsedLeft) && isInfinityExpr(collapsedRight)) {
      return { type: 'Infinity' }
    }

    // Otherwise, return with collapsed children
    if (collapsedLeft !== node.left || collapsedRight !== node.right) {
      return {
        type: 'Link',
        left: collapsedLeft,
        right: collapsedRight,
      } as LinkExpr
    }
  }

  // Other node types: return as-is
  return node
}

/**
 * Recursively expand Male expressions using axiom A5: ♂x = (♂x -> x)
 *
 * This function repeatedly applies A5 to expand expressions like:
 * - ♂v
 * - (♂v -> v) -> v
 * - ((♂v -> v) -> v) -> v
 * - etc.
 *
 * All of these can be unified with ♂v because:
 * 1. ♂v = (♂v -> v) by A5
 * 2. Substituting ♂v: ♂v = ((♂v -> v) -> v)
 * 3. Therefore: ♂v = (((♂v -> v) -> v) -> v)
 * 4. And so on recursively...
 */
function expandMale(node: ASTNode): ASTNode {
  // Base case: ♂x expression
  if (isMaleExpr(node)) {
    return node
  }

  // Recursive case: (a -> b) where a can expand to the full ♂x -> x pattern
  if (isLinkExpr(node)) {
    // Try to collapse this link to ♂x if it matches the pattern (♂x -> x)
    // and recursively if it matches ((♂x -> x) -> x), etc.
    const collapsedLeft = expandMale(node.left)

    // Check if left is ♂x and right is x (the operand of ♂x)
    if (isMaleExpr(collapsedLeft)) {
      const x = collapsedLeft.operand
      if (astEqual(node.right, x)) {
        // This is (♂x -> x), which equals ♂x by A5
        return collapsedLeft
      }
    }

    // Recursively try to collapse children
    const collapsedRight = expandMale(node.right)
    if (collapsedLeft !== node.left || collapsedRight !== node.right) {
      return {
        type: 'Link',
        left: collapsedLeft,
        right: collapsedRight,
      } as LinkExpr
    }
  }

  // Other node types: return as-is
  return node
}

/**
 * Recursively expand Female expressions using axiom A6: x♀ = (x -> x♀)
 *
 * This function repeatedly applies A6 to expand expressions like:
 * - r♀
 * - r -> r♀
 * - r -> (r -> r♀)
 * - etc.
 *
 * All of these can be unified with r♀ because:
 * 1. r♀ = (r -> r♀) by A6
 * 2. Substituting r♀: r♀ = (r -> (r -> r♀))
 * 3. Therefore: r♀ = (r -> (r -> (r -> r♀)))
 * 4. And so on recursively...
 */
function expandFemale(node: ASTNode): ASTNode {
  // Base case: x♀ expression
  if (isFemaleExpr(node)) {
    return node
  }

  // Recursive case: (a -> b) where b can expand to the full x -> x♀ pattern
  if (isLinkExpr(node)) {
    // Try to collapse this link to x♀ if it matches the pattern (x -> x♀)
    // and recursively if it matches (x -> (x -> x♀)), etc.
    const collapsedRight = expandFemale(node.right)

    // Check if right is x♀ and left is x (the operand of x♀)
    if (isFemaleExpr(collapsedRight)) {
      const x = collapsedRight.operand
      if (astEqual(node.left, x)) {
        // This is (x -> x♀), which equals x♀ by A6
        return collapsedRight
      }
    }

    // Recursively try to collapse children
    const collapsedLeft = expandFemale(node.left)
    if (collapsedLeft !== node.left || collapsedRight !== node.right) {
      return {
        type: 'Link',
        left: collapsedLeft,
        right: collapsedRight,
      } as LinkExpr
    }
  }

  // Other node types: return as-is
  return node
}

/**
 * Generate hints for failed equality verification
 */
function generateEqualityHints(
  left: ASTNode,
  right: ASTNode,
  expLeft: ASTNode,
  expRight: ASTNode
): VerificationHint[] {
  const hints: VerificationHint[] = []

  // Check for structural differences
  if (left.type !== right.type) {
    hints.push({
      type: 'structural',
      message: `Разные типы выражений: ${left.type} ≠ ${right.type}`,
    })
  }

  // Check if one side is Male and the other is Female
  if (
    (isMaleExpr(expLeft) && isFemaleExpr(expRight)) ||
    (isFemaleExpr(expLeft) && isMaleExpr(expRight))
  ) {
    hints.push({
      type: 'suggestion',
      message: '♂ и ♀ операторы дуальны, но не взаимозаменяемы',
      relatedAxiom: 'A7',
    })
  }

  // Check if Male expression could use A5
  if (isMaleExpr(expLeft) || isMaleExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А5: ♂x = (♂x → x)',
      relatedAxiom: 'A5',
    })
  }

  // Check if Female expression could use A6
  if (isFemaleExpr(expLeft) || isFemaleExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А6: x♀ = (x → x♀)',
      relatedAxiom: 'A6',
    })
  }

  // Check if Infinity expression could use A4
  if (isInfinityExpr(expLeft) || isInfinityExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А4: ∞ = (∞ → ∞)',
      relatedAxiom: 'A4',
    })
  }

  // Check for Link expressions
  if (isLinkExpr(expLeft) && isLinkExpr(expRight)) {
    hints.push({
      type: 'suggestion',
      message: 'Проверьте структуру связей: левая и правая части должны совпадать',
    })
  }

  // Generic hint if no specific hints were generated
  if (hints.length === 0) {
    hints.push({
      type: 'suggestion',
      message: 'Выражения имеют разную структуру и не могут быть унифицированы',
    })
  }

  return hints
}

/**
 * Check if two nodes are equal considering proven equalities in the state.
 * This uses symmetry: if (x = y) is proven, then (y = x) is also valid.
 */
function checkWithProvenEqualities(
  left: ASTNode,
  right: ASTNode,
  state: ProverState
): { found: boolean; symmetric: boolean } {
  const leftStr = toCanonicalString(left)
  const rightStr = toCanonicalString(right)

  for (const eq of state.provenEqualities) {
    const eqLeftStr = toCanonicalString(eq.left)
    const eqRightStr = toCanonicalString(eq.right)

    // Direct match
    if (leftStr === eqLeftStr && rightStr === eqRightStr) {
      return { found: true, symmetric: false }
    }

    // Symmetric match (A1: symmetry)
    if (leftStr === eqRightStr && rightStr === eqLeftStr) {
      return { found: true, symmetric: true }
    }
  }

  return { found: false, symmetric: false }
}

/**
 * Try to prove equality using transitivity.
 * If we have proven (a = b) and (b = c), then we can prove (a = c).
 * A1: {(x = y), (y = z)} → (x = z)
 */
function tryTransitivity(
  left: ASTNode,
  right: ASTNode,
  state: ProverState
): { found: boolean; intermediate?: ASTNode } {
  const leftStr = toCanonicalString(left)
  const rightStr = toCanonicalString(right)

  // For each proven equality (a = b), check if:
  // - left matches a and we have (b = right) proven
  // - left matches b and we have (a = right) proven (using symmetry)
  for (const eq1 of state.provenEqualities) {
    const eq1LeftStr = toCanonicalString(eq1.left)
    const eq1RightStr = toCanonicalString(eq1.right)

    // Case 1: left = eq1.left, and eq1.right = right
    if (leftStr === eq1LeftStr) {
      const intermediate = eq1.right
      const intermediateStr = eq1RightStr

      for (const eq2 of state.provenEqualities) {
        const eq2LeftStr = toCanonicalString(eq2.left)
        const eq2RightStr = toCanonicalString(eq2.right)

        if (intermediateStr === eq2LeftStr && rightStr === eq2RightStr) {
          return { found: true, intermediate }
        }
        // Also check symmetric version of eq2
        if (intermediateStr === eq2RightStr && rightStr === eq2LeftStr) {
          return { found: true, intermediate }
        }
      }
    }

    // Case 2: left = eq1.right (using symmetry for eq1)
    if (leftStr === eq1RightStr) {
      const intermediate = eq1.left
      const intermediateStr = eq1LeftStr

      for (const eq2 of state.provenEqualities) {
        const eq2LeftStr = toCanonicalString(eq2.left)
        const eq2RightStr = toCanonicalString(eq2.right)

        if (intermediateStr === eq2LeftStr && rightStr === eq2RightStr) {
          return { found: true, intermediate }
        }
        if (intermediateStr === eq2RightStr && rightStr === eq2LeftStr) {
          return { found: true, intermediate }
        }
      }
    }
  }

  return { found: false }
}

/**
 * Try to prove equality using congruence.
 * A2: {(a = c), (b = d)} → ((a → b) = (c → d))
 *
 * If left and right are both Link expressions, and we can prove
 * their components are equal, then we can prove the links are equal.
 */
function tryCongruence(
  left: ASTNode,
  right: ASTNode,
  state: ProverState
): {
  found: boolean
  leftParts?: { a: ASTNode; b: ASTNode }
  rightParts?: { c: ASTNode; d: ASTNode }
} {
  if (!isLinkExpr(left) || !isLinkExpr(right)) {
    return { found: false }
  }

  const a = left.left
  const b = left.right
  const c = right.left
  const d = right.right

  // Check if (a = c) is proven or can be trivially shown
  const acEqual =
    astEqual(a, c) ||
    checkWithProvenEqualities(a, c, state).found ||
    checkWithProvenEqualities(c, a, state).found

  // Check if (b = d) is proven or can be trivially shown
  const bdEqual =
    astEqual(b, d) ||
    checkWithProvenEqualities(b, d, state).found ||
    checkWithProvenEqualities(d, b, state).found

  if (acEqual && bdEqual) {
    return {
      found: true,
      leftParts: { a, b },
      rightParts: { c, d },
    }
  }

  return { found: false }
}

/**
 * Add a proven equality to the state for future transitivity/congruence resolution
 */
export function addProvenEquality(state: ProverState, left: ASTNode, right: ASTNode): void {
  const normLeft = normalize(left)
  const normRight = normalize(right)

  // Check if this equality is already proven
  const leftStr = toCanonicalString(normLeft)
  const rightStr = toCanonicalString(normRight)

  for (const eq of state.provenEqualities) {
    const eqLeftStr = toCanonicalString(eq.left)
    const eqRightStr = toCanonicalString(eq.right)

    // Already have this equality (or its symmetric version)
    if (
      (leftStr === eqLeftStr && rightStr === eqRightStr) ||
      (leftStr === eqRightStr && rightStr === eqLeftStr)
    ) {
      return
    }
  }

  state.provenEqualities.push({
    left: normLeft,
    right: normRight,
    normalized: true,
  })
}

/**
 * Add a proven fact to the state for Modus Ponens
 */
export function addProvenFact(state: ProverState, fact: ASTNode): void {
  const normFact = normalize(fact)
  const factStr = toCanonicalString(normFact)

  // Check if this fact is already proven
  if (state.facts.has(factStr)) {
    return
  }

  state.facts.add(factStr)
  state.provenFacts.push(normFact)

  // If this is a Link expression (implication), add it to implications
  if (isLinkExpr(normFact)) {
    addProvenImplication(state, normFact.left, normFact.right, 'proven fact')
  }
}

/**
 * Add a proven implication to the state for Modus Ponens
 */
export function addProvenImplication(
  state: ProverState,
  antecedent: ASTNode,
  consequent: ASTNode,
  source: string
): void {
  const normAnt = normalize(antecedent)
  const normCons = normalize(consequent)
  const antStr = toCanonicalString(normAnt)
  const consStr = toCanonicalString(normCons)

  // Check if this implication already exists
  for (const impl of state.provenImplications) {
    const implAntStr = toCanonicalString(impl.antecedent)
    const implConsStr = toCanonicalString(impl.consequent)
    if (antStr === implAntStr && consStr === implConsStr) {
      return
    }
  }

  state.provenImplications.push({
    antecedent: normAnt,
    consequent: normCons,
    source,
  })
}

/**
 * Try to prove a fact using Modus Ponens.
 * If we have proven P and (P → Q), then we can prove Q.
 *
 * This function searches for matching implications and applies MP.
 */
export function tryModusPonens(
  goal: ASTNode,
  state: ProverState
): {
  found: boolean
  antecedent?: ASTNode
  implication?: ProvenImplication
  chain?: { fact: ASTNode; implication: ProvenImplication }[]
} {
  const normGoal = normalize(goal)
  const goalStr = toCanonicalString(normGoal)

  // Check if goal is already a proven fact
  if (state.facts.has(goalStr)) {
    return { found: true }
  }

  // Search for an implication (P → goal) where P is proven
  for (const impl of state.provenImplications) {
    const consStr = toCanonicalString(impl.consequent)

    // Check if consequent matches goal
    if (consStr === goalStr || astEqual(impl.consequent, normGoal)) {
      // Check if antecedent is proven
      const antStr = toCanonicalString(impl.antecedent)
      if (state.facts.has(antStr)) {
        return {
          found: true,
          antecedent: impl.antecedent,
          implication: impl,
        }
      }

      // Try to prove antecedent recursively (with depth limit to avoid infinite loops)
      const antResult = tryModusPonensChain(impl.antecedent, state, 5)
      if (antResult.found) {
        return {
          found: true,
          antecedent: impl.antecedent,
          implication: impl,
          chain: antResult.chain,
        }
      }
    }

    // Also try unification
    const subst = unify(impl.consequent, normGoal)
    if (subst && subst.size > 0) {
      const substAnt = applySubstitution(impl.antecedent, subst)
      const substAntStr = toCanonicalString(normalize(substAnt))
      if (state.facts.has(substAntStr)) {
        return {
          found: true,
          antecedent: substAnt,
          implication: impl,
        }
      }
    }
  }

  return { found: false }
}

/**
 * Try to prove a fact using a chain of Modus Ponens applications.
 * This allows proving P → Q → R when we have P and (P → Q) and (Q → R).
 */
function tryModusPonensChain(
  goal: ASTNode,
  state: ProverState,
  maxDepth: number
): {
  found: boolean
  chain?: { fact: ASTNode; implication: ProvenImplication }[]
} {
  if (maxDepth <= 0) {
    return { found: false }
  }

  const normGoal = normalize(goal)
  const goalStr = toCanonicalString(normGoal)

  // Base case: goal is already proven
  if (state.facts.has(goalStr)) {
    return { found: true, chain: [] }
  }

  // Search for an implication (P → goal)
  for (const impl of state.provenImplications) {
    const consStr = toCanonicalString(impl.consequent)

    if (consStr === goalStr || astEqual(impl.consequent, normGoal)) {
      // Try to prove antecedent recursively
      const antResult = tryModusPonensChain(impl.antecedent, state, maxDepth - 1)
      if (antResult.found) {
        const chain = antResult.chain || []
        chain.push({ fact: impl.antecedent, implication: impl })
        return { found: true, chain }
      }
    }
  }

  return { found: false }
}

/**
 * Apply Modus Ponens to derive new facts from proven implications.
 * Returns the list of newly derived facts.
 */
export function applyModusPonens(state: ProverState): ASTNode[] {
  const derivedFacts: ASTNode[] = []
  let changed = true

  // Keep applying MP until no new facts can be derived
  while (changed) {
    changed = false

    for (const impl of state.provenImplications) {
      const antStr = toCanonicalString(impl.antecedent)
      const consStr = toCanonicalString(impl.consequent)

      // If antecedent is proven and consequent is not, derive consequent
      if (state.facts.has(antStr) && !state.facts.has(consStr)) {
        state.facts.add(consStr)
        state.provenFacts.push(impl.consequent)
        derivedFacts.push(impl.consequent)
        changed = true

        // If the derived fact is itself an implication, add it
        if (isLinkExpr(impl.consequent)) {
          addProvenImplication(state, impl.consequent.left, impl.consequent.right, 'derived via MP')
        }
      }
    }
  }

  return derivedFacts
}

/**
 * Check if equality holds using axioms and unification
 */
export function checkEquality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  // Normalize both sides
  const normLeft = normalize(left)
  const normRight = normalize(right)
  const proofSteps: ProofStep[] = []
  const appliedAxioms: AxiomInfo[] = []

  const leftStr = toCanonicalString(normLeft)
  const rightStr = toCanonicalString(normRight)

  proofSteps.push({
    index: 1,
    action: 'Нормализация выражений',
    before: `${toCanonicalString(left)} = ${toCanonicalString(right)}`,
    after: `${leftStr} = ${rightStr}`,
    details: 'Применены правила нормализации: !!x→x, !(♂x)→x♀, !(x♀)→♂x',
  })

  state.trace.push(`Checking: ${leftStr} = ${rightStr}`)

  // Direct structural equality
  if (astEqual(normLeft, normRight)) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: 2,
      action: 'Структурное сравнение',
      details: 'Выражения идентичны после нормализации',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Структурное равенство (А1: тождественность)',
      steps: ['Direct structural comparison'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try expanding definitions
  const expLeft = expandDefinitions(normLeft, state)
  const expRight = expandDefinitions(normRight, state)
  const expLeftStr = toCanonicalString(expLeft)
  const expRightStr = toCanonicalString(expRight)

  if (leftStr !== expLeftStr || rightStr !== expRightStr) {
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Раскрытие определений',
      before: `${leftStr} = ${rightStr}`,
      after: `${expLeftStr} = ${expRightStr}`,
      axiom: AXIOMS.A0,
      details: 'Применена аксиома А0: определения раскрываются по форме',
    })
    appliedAxioms.push(AXIOMS.A0)
  }

  state.trace.push(`After expansion: ${expLeftStr} = ${expRightStr}`)

  if (astEqual(expLeft, expRight)) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Структурное сравнение после раскрытия',
      details: 'Выражения идентичны после раскрытия определений',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Равенство после раскрытия определений (А0, А1)',
      steps: ['Expanded definitions', 'Structural comparison'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try unification
  const subst = unify(expLeft, expRight)
  if (subst) {
    const substEntries = Array.from(subst.entries())
    const substStr = substEntries.map(([k, v]) => `${k} ↦ ${toCanonicalString(v)}`).join(', ')
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Унификация',
      details: substStr ? `Подстановка: {${substStr}}` : 'Прямая унификация',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Унификация успешна (А1: тождественность)',
      steps: ['Unification'],
      proofSteps,
      appliedAxioms,
      substitution: subst,
    }
  }

  // Apply axiom schemas
  // ♂x = ♂x -> x
  if (isMaleExpr(expLeft)) {
    const maleExp = applyMaleAxiom(expLeft)
    if (maleExp && astEqual(maleExp, expRight)) {
      appliedAxioms.push(AXIOMS.A5)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А5',
        before: expLeftStr,
        after: toCanonicalString(maleExp),
        axiom: AXIOMS.A5,
        details: '♂x раскрывается как (♂x → x)',
      })
      return {
        success: true,
        message: 'Применена аксиома А5: ♂x = (♂x → x)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isMaleExpr(expRight)) {
    const maleExp = applyMaleAxiom(expRight)
    if (maleExp && astEqual(expLeft, maleExp)) {
      appliedAxioms.push(AXIOMS.A5)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А5 (обратное)',
        before: expRightStr,
        after: toCanonicalString(maleExp),
        axiom: AXIOMS.A5,
        details: '♂x раскрывается как (♂x → x)',
      })
      return {
        success: true,
        message: 'Применена аксиома А5 (обратное направление)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // x♀ = x -> x♀
  if (isFemaleExpr(expLeft)) {
    const femaleExp = applyFemaleAxiom(expLeft)
    if (femaleExp && astEqual(femaleExp, expRight)) {
      appliedAxioms.push(AXIOMS.A6)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А6',
        before: expLeftStr,
        after: toCanonicalString(femaleExp),
        axiom: AXIOMS.A6,
        details: 'x♀ раскрывается как (x → x♀)',
      })
      return {
        success: true,
        message: 'Применена аксиома А6: x♀ = (x → x♀)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isFemaleExpr(expRight)) {
    const femaleExp = applyFemaleAxiom(expRight)
    if (femaleExp && astEqual(expLeft, femaleExp)) {
      appliedAxioms.push(AXIOMS.A6)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А6 (обратное)',
        before: expRightStr,
        after: toCanonicalString(femaleExp),
        axiom: AXIOMS.A6,
        details: 'x♀ раскрывается как (x → x♀)',
      })
      return {
        success: true,
        message: 'Применена аксиома А6 (обратное направление)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // Try recursive expansion for Male expressions using axiom A5: ♂x = (♂x -> x)
  const expandedMaleLeft = expandMale(expLeft)
  const expandedMaleRight = expandMale(expRight)
  const maleLeftWasExpanded = !astEqual(expLeft, expandedMaleLeft)
  const maleRightWasExpanded = !astEqual(expRight, expandedMaleRight)

  if (maleLeftWasExpanded || maleRightWasExpanded) {
    // Build detailed explanation of expansion steps
    let details = ''
    if (maleLeftWasExpanded && maleRightWasExpanded) {
      details = `Обе стороны сворачиваются в ♂x:\n  ${expLeftStr} → ${toCanonicalString(expandedMaleLeft)}\n  ${expRightStr} → ${toCanonicalString(expandedMaleRight)}`
    } else if (maleLeftWasExpanded) {
      details = `Левая сторона сворачивается в ♂x: ${expLeftStr} → ${toCanonicalString(expandedMaleLeft)}`
    } else {
      details = `Правая сторона сворачивается в ♂x: ${expRightStr} → ${toCanonicalString(expandedMaleRight)}`
    }

    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Рекурсивное свёртывание по А5',
      before: `${expLeftStr} = ${expRightStr}`,
      after: `${toCanonicalString(expandedMaleLeft)} = ${toCanonicalString(expandedMaleRight)}`,
      axiom: AXIOMS.A5,
      details,
    })

    // Check equality after expansion
    if (astEqual(expandedMaleLeft, expandedMaleRight)) {
      appliedAxioms.push(AXIOMS.A5)
      return {
        success: true,
        message: 'Применена аксиома А5: ♂x = (♂x → x) с рекурсивным свёртыванием',
        steps: ['♂x : (♂x -> x) recursively applied'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // Try recursive expansion for Female expressions using axiom A6: x♀ = (x -> x♀)
  const expandedFemaleLeft = expandFemale(expLeft)
  const expandedFemaleRight = expandFemale(expRight)
  const femaleLeftWasExpanded = !astEqual(expLeft, expandedFemaleLeft)
  const femaleRightWasExpanded = !astEqual(expRight, expandedFemaleRight)

  if (femaleLeftWasExpanded || femaleRightWasExpanded) {
    // Build detailed explanation of expansion steps
    let details = ''
    if (femaleLeftWasExpanded && femaleRightWasExpanded) {
      details = `Обе стороны сворачиваются в x♀:\n  ${expLeftStr} → ${toCanonicalString(expandedFemaleLeft)}\n  ${expRightStr} → ${toCanonicalString(expandedFemaleRight)}`
    } else if (femaleLeftWasExpanded) {
      details = `Левая сторона сворачивается в x♀: ${expLeftStr} → ${toCanonicalString(expandedFemaleLeft)}`
    } else {
      details = `Правая сторона сворачивается в x♀: ${expRightStr} → ${toCanonicalString(expandedFemaleRight)}`
    }

    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Рекурсивное свёртывание по А6',
      before: `${expLeftStr} = ${expRightStr}`,
      after: `${toCanonicalString(expandedFemaleLeft)} = ${toCanonicalString(expandedFemaleRight)}`,
      axiom: AXIOMS.A6,
      details,
    })

    // Check equality after expansion
    if (astEqual(expandedFemaleLeft, expandedFemaleRight)) {
      appliedAxioms.push(AXIOMS.A6)
      return {
        success: true,
        message: 'Применена аксиома А6: x♀ = (x → x♀) с рекурсивным свёртыванием',
        steps: ['x♀ : (x -> x♀) recursively applied'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // ∞ = ∞ -> ∞ (with recursive collapse support)
  // Try to collapse both sides using axiom A4: ∞ = (∞ -> ∞)
  const collapsedLeft = collapseInfinity(expLeft)
  const collapsedRight = collapseInfinity(expRight)

  // Check if one or both sides involve infinity and can be collapsed
  const leftIsInfinity = isInfinityExpr(collapsedLeft)
  const rightIsInfinity = isInfinityExpr(collapsedRight)
  const leftWasCollapsed = !astEqual(expLeft, collapsedLeft)
  const rightWasCollapsed = !astEqual(expRight, collapsedRight)

  if ((leftIsInfinity || rightIsInfinity) && (leftWasCollapsed || rightWasCollapsed)) {
    // Build detailed explanation of collapse steps
    let details = ''
    if (leftWasCollapsed && rightWasCollapsed) {
      details = `Обе стороны сворачиваются в ∞:\n  ${expLeftStr} → ${toCanonicalString(collapsedLeft)}\n  ${expRightStr} → ${toCanonicalString(collapsedRight)}`
    } else if (leftWasCollapsed) {
      details = `Левая сторона сворачивается в ∞: ${expLeftStr} → ${toCanonicalString(collapsedLeft)}`
    } else {
      details = `Правая сторона сворачивается в ∞: ${expRightStr} → ${toCanonicalString(collapsedRight)}`
    }

    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Рекурсивное свёртывание по А4',
      before: `${expLeftStr} = ${expRightStr}`,
      after: `${toCanonicalString(collapsedLeft)} = ${toCanonicalString(collapsedRight)}`,
      axiom: AXIOMS.A4,
      details,
    })

    // Check equality after collapse
    if (astEqual(collapsedLeft, collapsedRight)) {
      appliedAxioms.push(AXIOMS.A4)
      return {
        success: true,
        message: 'Применена аксиома А4: ∞ = (∞ → ∞) с рекурсивным свёртыванием',
        steps: ['∞ : (∞ -> ∞) recursively applied'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // Original simple cases (for backward compatibility and clarity in proof steps)
  if (isInfinityExpr(expLeft)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' },
    }
    if (astEqual(infLink, expRight)) {
      appliedAxioms.push(AXIOMS.A4)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А4',
        before: '∞',
        after: '(∞ → ∞)',
        axiom: AXIOMS.A4,
        details: '∞ (акорень) раскрывается как (∞ → ∞)',
      })
      return {
        success: true,
        message: 'Применена аксиома А4: ∞ = (∞ → ∞)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isInfinityExpr(expRight)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' },
    }
    if (astEqual(expLeft, infLink)) {
      appliedAxioms.push(AXIOMS.A4)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А4 (обратное)',
        before: '(∞ → ∞)',
        after: '∞',
        axiom: AXIOMS.A4,
        details: '(∞ → ∞) сворачивается в ∞ (акорень)',
      })
      return {
        success: true,
        message: 'Применена аксиома А4 (обратное направление)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // Try using previously proven equalities with symmetry (A1)
  const provenCheck = checkWithProvenEqualities(expLeft, expRight, state)
  if (provenCheck.found) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: provenCheck.symmetric
        ? 'Применение симметрии равенства (А1)'
        : 'Использование ранее доказанного равенства',
      details: provenCheck.symmetric
        ? `Из (${toCanonicalString(expRight)} = ${toCanonicalString(expLeft)}) следует (${toCanonicalString(expLeft)} = ${toCanonicalString(expRight)})`
        : `Равенство уже было доказано ранее`,
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: provenCheck.symmetric
        ? 'Применена симметрия равенства (А1)'
        : 'Использовано ранее доказанное равенство',
      steps: ['Previously proven equality'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try transitivity (A1): if (a = b) and (b = c) then (a = c)
  const transitivityResult = tryTransitivity(expLeft, expRight, state)
  if (transitivityResult.found && transitivityResult.intermediate) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Применение транзитивности равенства (А1)',
      details: `Из (${toCanonicalString(expLeft)} = ${toCanonicalString(transitivityResult.intermediate)}) и (${toCanonicalString(transitivityResult.intermediate)} = ${toCanonicalString(expRight)}) следует (${toCanonicalString(expLeft)} = ${toCanonicalString(expRight)})`,
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Применена транзитивность равенства (А1)',
      steps: ['Transitivity'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try congruence (A2): if (a = c) and (b = d) then (a -> b) = (c -> d)
  const congruenceResult = tryCongruence(expLeft, expRight, state)
  if (congruenceResult.found && congruenceResult.leftParts && congruenceResult.rightParts) {
    appliedAxioms.push(AXIOMS.A2)
    const { a, b } = congruenceResult.leftParts
    const { c, d } = congruenceResult.rightParts
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Применение конгруэнции (А2)',
      details: `Из (${toCanonicalString(a)} = ${toCanonicalString(c)}) и (${toCanonicalString(b)} = ${toCanonicalString(d)}) следует ((${toCanonicalString(a)} → ${toCanonicalString(b)}) = (${toCanonicalString(c)} → ${toCanonicalString(d)}))`,
      axiom: AXIOMS.A2,
    })
    return {
      success: true,
      message: 'Применена конгруэнция (А2)',
      steps: ['Congruence'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Generate hints for failed verification
  const hints = generateEqualityHints(left, right, expLeft, expRight)

  proofSteps.push({
    index: proofSteps.length + 1,
    action: 'Верификация не удалась',
    details: 'Не найдена последовательность аксиом для доказательства равенства',
  })

  return {
    success: false,
    message: 'Невозможно доказать равенство',
    steps: state.trace,
    proofSteps,
    appliedAxioms,
    hints,
  }
}

/**
 * Check if inequality holds
 */
export function checkInequality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  const eqResult = checkEquality(left, right, state)
  const proofSteps: ProofStep[] = []

  proofSteps.push({
    index: 1,
    action: 'Попытка доказать равенство',
    details: `Проверяем: ${toCanonicalString(left)} = ${toCanonicalString(right)}`,
  })

  if (!eqResult.success) {
    proofSteps.push({
      index: 2,
      action: 'Равенство не доказано',
      details: 'Не найдена последовательность аксиом для доказательства равенства',
    })
    proofSteps.push({
      index: 3,
      action: 'Неравенство выполняется',
      details: 'Если равенство не может быть доказано, неравенство считается истинным',
    })

    return {
      success: true,
      message: 'Неравенство выполняется (равенство не может быть доказано)',
      steps: ['Tried to prove equality', 'Failed', 'Therefore inequality holds'],
      proofSteps,
      appliedAxioms: [],
    }
  }

  proofSteps.push({
    index: 2,
    action: 'Равенство доказано',
    details: eqResult.message,
  })
  proofSteps.push({
    index: 3,
    action: 'Неравенство не выполняется',
    details: 'Поскольку равенство может быть доказано, неравенство ложно',
  })

  const hints: VerificationHint[] = [
    {
      type: 'suggestion',
      message: 'Выражения равны, поэтому неравенство не выполняется',
    },
  ]

  return {
    success: false,
    message: 'Неравенство не выполняется (равенство может быть доказано)',
    steps: eqResult.steps,
    proofSteps,
    appliedAxioms: eqResult.appliedAxioms,
    hints,
  }
}

/**
 * Attach metrics to a proof result by analyzing the result's proof steps and axioms,
 * combined with timing data from the metrics collector.
 */
function attachMetrics(result: ProofResult, collector: MetricsCollector): ProofResult {
  // Record steps from proof result
  if (result.proofSteps) {
    for (const step of result.proofSteps) {
      collector.recordStep()
      if (step.axiom) {
        collector.recordAxiomUse(step.axiom.id)
      }
    }
  }

  // Record unification attempts from proof steps
  if (result.proofSteps) {
    for (const step of result.proofSteps) {
      if (step.action === 'Унификация') {
        collector.recordUnificationAttempt(true)
      }
    }
  }

  // Track depth from step count
  if (result.proofSteps) {
    collector.recordDepth(result.proofSteps.length)
  }

  result.metrics = collector.getMetrics()
  return result
}

/**
 * Verify a statement
 */
export function verify(node: ASTNode, state: ProverState): ProofResult {
  const collector = createMetricsCollector()
  collector.start()

  const normalized = normalize(node)

  if (isEqExpr(normalized)) {
    const result = checkEquality(normalized.left, normalized.right, state)
    // If equality was proven, add it to the state for future transitivity/congruence
    if (result.success) {
      addProvenEquality(state, normalized.left, normalized.right)
    }
    // Collect metrics from result
    collector.stop()
    return attachMetrics(result, collector)
  }

  if (isNeqExpr(normalized)) {
    const result = checkInequality(normalized.left, normalized.right, state)
    collector.stop()
    return attachMetrics(result, collector)
  }

  if (isDefExpr(normalized)) {
    // Add definition to state
    if (isIdentExpr(normalized.name)) {
      state.definitions.set(normalized.name.name, normalized.form)
      const proofSteps: ProofStep[] = [
        {
          index: 1,
          action: 'Регистрация определения',
          details: `${normalized.name.name} : ${toCanonicalString(normalized.form)}`,
          axiom: AXIOMS.A0,
        },
      ]
      collector.stop()
      return attachMetrics(
        {
          success: true,
          message: `Добавлено определение: ${normalized.name.name}`,
          steps: ['Definition registered'],
          proofSteps,
          appliedAxioms: [AXIOMS.A0],
        },
        collector
      )
    }
    const hints: VerificationHint[] = [
      {
        type: 'structural',
        message: 'Имя определения должно быть идентификатором',
      },
    ]
    collector.stop()
    return attachMetrics(
      {
        success: false,
        message: 'Имя определения должно быть идентификатором',
        steps: [],
        proofSteps: [],
        appliedAxioms: [],
        hints,
      },
      collector
    )
  }

  // Handle Link expressions (implications) using Modus Ponens
  if (isLinkExpr(normalized)) {
    const proofSteps: ProofStep[] = []
    const appliedAxioms: AxiomInfo[] = []

    // Register this implication in the state
    addProvenImplication(state, normalized.left, normalized.right, 'input expression')
    addProvenFact(state, normalized)

    proofSteps.push({
      index: 1,
      action: 'Регистрация импликации',
      details: `(${toCanonicalString(normalized.left)} → ${toCanonicalString(normalized.right)})`,
    })

    // Try to apply Modus Ponens to derive new facts
    const derivedFacts = applyModusPonens(state)

    if (derivedFacts.length > 0) {
      appliedAxioms.push(AXIOMS.MP)
      proofSteps.push({
        index: 2,
        action: 'Применение Modus Ponens',
        details: `Выведено ${derivedFacts.length} новых фактов: ${derivedFacts.map(f => toCanonicalString(f)).join(', ')}`,
        axiom: AXIOMS.MP,
      })
    }

    // Check if the consequent can be proven via MP
    const mpResult = tryModusPonens(normalized.right, state)
    if (mpResult.found && mpResult.antecedent) {
      appliedAxioms.push(AXIOMS.MP)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение Modus Ponens',
        details: `Из ${toCanonicalString(mpResult.antecedent)} и импликации выводится ${toCanonicalString(normalized.right)}`,
        axiom: AXIOMS.MP,
      })
    }

    collector.stop()
    return attachMetrics(
      {
        success: true,
        message: `Импликация зарегистрирована: (${toCanonicalString(normalized.left)} → ${toCanonicalString(normalized.right)})`,
        steps: ['Implication registered'],
        proofSteps,
        appliedAxioms,
      },
      collector
    )
  }

  const hints: VerificationHint[] = [
    {
      type: 'suggestion',
      message: `Поддерживаемые типы выражений: равенство (=), неравенство (!=), определение (:), импликация (→)`,
    },
  ]

  collector.stop()
  return attachMetrics(
    {
      success: false,
      message: `Невозможно верифицировать выражение типа: ${node.type}`,
      steps: [],
      proofSteps: [],
      appliedAxioms: [],
      hints,
    },
    collector
  )
}
