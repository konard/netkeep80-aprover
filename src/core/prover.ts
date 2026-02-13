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

/** Substitution: maps variable names to AST nodes */
export type Substitution = Map<string, ASTNode>

/** Axiom identifiers for МТС v0.1 */
export type AxiomId =
  | 'A0' // Definition
  | 'A1' // Identity
  | 'A4' // Infinity/aroot
  | 'A5' // Male self-closing
  | 'A6' // Female self-closing
  | 'A7' // Inversion
  | 'A11' // Left associativity
  | 'UNIFY' // Unification
  | 'STRUCT' // Structural comparison
  | 'DEF_EXPAND' // Definition expansion
  | 'NORMALIZE' // Normalization

/** Axiom metadata */
export interface AxiomInfo {
  id: AxiomId
  name: string
  formula: string
  description: string
}

/** Axiom registry */
export const AXIOMS: Record<AxiomId, AxiomInfo> = {
  A0: {
    id: 'A0',
    name: 'А0. Определение',
    formula: '(s : F) → (s = F)',
    description: 'Знак как запрос по форме',
  },
  A1: {
    id: 'A1',
    name: 'А1. Тождественность',
    formula: 'x = x',
    description: 'Рефлексивность равенства',
  },
  A4: {
    id: 'A4',
    name: 'А4. Смысл (акорень)',
    formula: '∞ : (∞ → ∞)',
    description: 'Полное самозамыкание',
  },
  A5: {
    id: 'A5',
    name: 'А5. Самозамыкание начала',
    formula: '♂x : (♂x → x)',
    description: 'Начало замкнуто на связь',
  },
  A6: {
    id: 'A6',
    name: 'А6. Самозамыкание конца',
    formula: 'x♀ : (x → x♀)',
    description: 'Конец замкнут на связь',
  },
  A7: {
    id: 'A7',
    name: 'А7. Инверсия',
    formula: '!(a → b) = (b → a), !!x = x',
    description: 'Дуальность инверсии',
  },
  A11: {
    id: 'A11',
    name: 'А11. Левоассоциативность',
    formula: '(a → b → c) = ((a → b) → c)',
    description: 'Порядок группировки',
  },
  UNIFY: {
    id: 'UNIFY',
    name: 'Унификация',
    formula: 'σ(A) = σ(B)',
    description: 'Структурная унификация с подстановкой',
  },
  STRUCT: {
    id: 'STRUCT',
    name: 'Структурное равенство',
    formula: 'A ≡ B',
    description: 'Прямое структурное сравнение',
  },
  DEF_EXPAND: {
    id: 'DEF_EXPAND',
    name: 'Раскрытие определения',
    formula: 's → F (где s : F)',
    description: 'Замена идентификатора на его определение',
  },
  NORMALIZE: {
    id: 'NORMALIZE',
    name: 'Нормализация',
    formula: 'norm(A) = norm(B)',
    description: 'Приведение к канонической форме',
  },
}

/** Detailed proof step */
export interface ProofStep {
  /** Step number (1-based) */
  number: number
  /** Action description */
  action: string
  /** Axiom applied (if any) */
  axiom?: AxiomInfo
  /** Expression before transformation */
  before?: string
  /** Expression after transformation */
  after?: string
  /** Additional details */
  details?: string
}

/** Hint for failed verification */
export interface ProofHint {
  /** Hint type */
  type: 'missing_definition' | 'structure_mismatch' | 'unification_failed' | 'suggestion'
  /** Hint message */
  message: string
  /** Suggested fix (if any) */
  suggestion?: string
}

/** Proof result */
export interface ProofResult {
  success: boolean
  message: string
  /** Legacy simple steps for backwards compatibility */
  steps?: string[]
  /** Detailed proof steps with axiom references */
  proofSteps?: ProofStep[]
  /** Hints for failed verification */
  hints?: ProofHint[]
  substitution?: Substitution
}

/** Prover state */
export interface ProverState {
  /** Built-in axioms as (P -> Q) links */
  axioms: ASTNode[]
  /** User-defined definitions: s : F */
  definitions: Map<string, ASTNode>
  /** Proven facts (canonical string form) */
  facts: Set<string>
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
 * Generate hints for failed equality proof
 */
function generateEqualityHints(
  left: ASTNode,
  right: ASTNode,
  expLeft: ASTNode,
  expRight: ASTNode,
  state: ProverState
): ProofHint[] {
  const hints: ProofHint[] = []
  const leftStr = toCanonicalString(left)
  const rightStr = toCanonicalString(right)
  const expLeftStr = toCanonicalString(expLeft)
  const expRightStr = toCanonicalString(expRight)

  // Check for undefined identifiers
  const findUndefinedIdents = (node: ASTNode): string[] => {
    const undefs: string[] = []
    const checkNode = (n: ASTNode) => {
      if (isIdentExpr(n) && !state.definitions.has(n.name) && n.name.length > 1) {
        undefs.push(n.name)
      }
      if (isLinkExpr(n)) {
        checkNode(n.left)
        checkNode(n.right)
      }
      if (isMaleExpr(n) || isFemaleExpr(n) || isNotExpr(n)) {
        checkNode(n.operand)
      }
    }
    checkNode(node)
    return [...new Set(undefs)]
  }

  const undefLeft = findUndefinedIdents(left)
  const undefRight = findUndefinedIdents(right)
  const allUndef = [...new Set([...undefLeft, ...undefRight])]

  if (allUndef.length > 0) {
    hints.push({
      type: 'missing_definition',
      message: `Идентификатор(ы) не определены: ${allUndef.join(', ')}`,
      suggestion: `Добавьте определение: ${allUndef[0]} : <форма>.`,
    })
  }

  // Check for structure mismatch
  if (left.type !== right.type && expLeft.type !== expRight.type) {
    hints.push({
      type: 'structure_mismatch',
      message: `Структуры не совпадают: ${left.type} ≠ ${right.type}`,
      suggestion: 'Проверьте, что обе стороны имеют одинаковую структуру.',
    })
  }

  // Suggest applicable axioms
  if (isMaleExpr(expLeft) || isMaleExpr(expRight)) {
    hints.push({
      type: 'suggestion',
      message: 'Присутствует ♂ символ. Рассмотрите аксиому А5: ♂x = (♂x → x).',
    })
  }

  if (isFemaleExpr(expLeft) || isFemaleExpr(expRight)) {
    hints.push({
      type: 'suggestion',
      message: 'Присутствует ♀ символ. Рассмотрите аксиому А6: x♀ = (x → x♀).',
    })
  }

  if (isInfinityExpr(expLeft) || isInfinityExpr(expRight)) {
    hints.push({
      type: 'suggestion',
      message: 'Присутствует ∞. Рассмотрите аксиому А4: ∞ = (∞ → ∞).',
    })
  }

  // Check if unification failed due to conflicting bindings
  if (leftStr !== rightStr && expLeftStr !== expRightStr) {
    hints.push({
      type: 'unification_failed',
      message: `Унификация не удалась: ${expLeftStr} ≠ ${expRightStr}`,
    })
  }

  return hints
}

/**
 * Check if equality holds using axioms and unification
 */
export function checkEquality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  const proofSteps: ProofStep[] = []
  let stepNum = 1

  // Helper to add a proof step
  const addStep = (
    action: string,
    axiom?: AxiomInfo,
    before?: string,
    after?: string,
    details?: string
  ) => {
    proofSteps.push({ number: stepNum++, action, axiom, before, after, details })
  }

  // Normalize both sides
  const normLeft = normalize(left)
  const normRight = normalize(right)
  const normLeftStr = toCanonicalString(normLeft)
  const normRightStr = toCanonicalString(normRight)

  addStep(
    'Нормализация выражений',
    AXIOMS.NORMALIZE,
    `${toCanonicalString(left)} = ${toCanonicalString(right)}`,
    `${normLeftStr} = ${normRightStr}`,
    'Приведение к канонической форме (раскрытие степеней, применение инверсий)'
  )

  state.trace.push(`Checking: ${normLeftStr} = ${normRightStr}`)

  // Direct structural equality
  if (astEqual(normLeft, normRight)) {
    addStep(
      'Структурное сравнение: выражения идентичны',
      AXIOMS.STRUCT,
      normLeftStr,
      normRightStr,
      'Левая и правая части совпадают после нормализации'
    )
    return {
      success: true,
      message: 'Доказано структурным равенством',
      steps: ['Direct structural comparison'],
      proofSteps,
    }
  }

  // Try expanding definitions
  const expLeft = expandDefinitions(normLeft, state)
  const expRight = expandDefinitions(normRight, state)
  const expLeftStr = toCanonicalString(expLeft)
  const expRightStr = toCanonicalString(expRight)

  const defExpanded = expLeftStr !== normLeftStr || expRightStr !== normRightStr
  if (defExpanded) {
    addStep(
      'Раскрытие определений',
      AXIOMS.DEF_EXPAND,
      `${normLeftStr} = ${normRightStr}`,
      `${expLeftStr} = ${expRightStr}`,
      'Замена идентификаторов на их определения'
    )
  }

  state.trace.push(`After expansion: ${expLeftStr} = ${expRightStr}`)

  if (astEqual(expLeft, expRight)) {
    addStep(
      'Структурное сравнение: выражения идентичны после раскрытия',
      AXIOMS.STRUCT,
      expLeftStr,
      expRightStr,
      'Равенство после раскрытия определений'
    )
    return {
      success: true,
      message: 'Доказано после раскрытия определений',
      steps: ['Expanded definitions', 'Structural comparison'],
      proofSteps,
    }
  }

  // Try unification
  const subst = unify(expLeft, expRight)
  if (subst) {
    const substEntries = Array.from(subst.entries())
      .map(([k, v]) => `${k} ↦ ${toCanonicalString(v)}`)
      .join(', ')
    addStep(
      'Унификация успешна',
      AXIOMS.UNIFY,
      `${expLeftStr} = ${expRightStr}`,
      'σ применена',
      substEntries ? `Подстановка: {${substEntries}}` : 'Пустая подстановка'
    )
    return {
      success: true,
      message: 'Доказано унификацией',
      steps: ['Unification'],
      proofSteps,
      substitution: subst,
    }
  }

  // Apply axiom schemas
  // ♂x = ♂x -> x
  if (isMaleExpr(expLeft)) {
    const maleExp = applyMaleAxiom(expLeft)
    if (maleExp && astEqual(maleExp, expRight)) {
      addStep(
        'Применение аксиомы А5 (♂)',
        AXIOMS.A5,
        expLeftStr,
        toCanonicalString(maleExp),
        '♂x : (♂x → x) — самозамыкание начала'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А5 (♂x → ♂x → x)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
      }
    }
  }
  if (isMaleExpr(expRight)) {
    const maleExp = applyMaleAxiom(expRight)
    if (maleExp && astEqual(expLeft, maleExp)) {
      addStep(
        'Применение аксиомы А5 (♂) — обратное направление',
        AXIOMS.A5,
        expRightStr,
        toCanonicalString(maleExp),
        '♂x : (♂x → x) — самозамыкание начала'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А5 (♂x → ♂x → x)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
      }
    }
  }

  // x♀ = x -> x♀
  if (isFemaleExpr(expLeft)) {
    const femaleExp = applyFemaleAxiom(expLeft)
    if (femaleExp && astEqual(femaleExp, expRight)) {
      addStep(
        'Применение аксиомы А6 (♀)',
        AXIOMS.A6,
        expLeftStr,
        toCanonicalString(femaleExp),
        'x♀ : (x → x♀) — самозамыкание конца'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А6 (x♀ → x → x♀)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
      }
    }
  }
  if (isFemaleExpr(expRight)) {
    const femaleExp = applyFemaleAxiom(expRight)
    if (femaleExp && astEqual(expLeft, femaleExp)) {
      addStep(
        'Применение аксиомы А6 (♀) — обратное направление',
        AXIOMS.A6,
        expRightStr,
        toCanonicalString(femaleExp),
        'x♀ : (x → x♀) — самозамыкание конца'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А6 (x♀ → x → x♀)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
      }
    }
  }

  // ∞ = ∞ -> ∞
  if (isInfinityExpr(expLeft)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' },
    }
    if (astEqual(infLink, expRight)) {
      addStep(
        'Применение аксиомы А4 (∞)',
        AXIOMS.A4,
        '∞',
        '(∞ → ∞)',
        '∞ : (∞ → ∞) — полное самозамыкание'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А4 (∞ → ∞ → ∞)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
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
      addStep(
        'Применение аксиомы А4 (∞) — обратное направление',
        AXIOMS.A4,
        '(∞ → ∞)',
        '∞',
        '∞ : (∞ → ∞) — полное самозамыкание'
      )
      return {
        success: true,
        message: 'Доказано по аксиоме А4 (∞ → ∞ → ∞)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
      }
    }
  }

  // Generate hints for failed proof
  const hints = generateEqualityHints(left, right, expLeft, expRight, state)

  addStep(
    'Доказательство не найдено',
    undefined,
    expLeftStr,
    expRightStr,
    'Не удалось применить ни одну аксиому для доказательства равенства'
  )

  return {
    success: false,
    message: 'Не удаётся доказать равенство',
    steps: state.trace,
    proofSteps,
    hints,
  }
}

/**
 * Check if inequality holds
 */
export function checkInequality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  const eqResult = checkEquality(left, right, state)
  const proofSteps: ProofStep[] = []
  let stepNum = 1

  if (!eqResult.success) {
    proofSteps.push({
      number: stepNum++,
      action: 'Проверка равенства',
      details: 'Пытаемся доказать равенство левой и правой части',
    })
    proofSteps.push({
      number: stepNum++,
      action: 'Равенство недоказуемо',
      before: toCanonicalString(left),
      after: toCanonicalString(right),
      details: 'Не найдено доказательство равенства',
    })
    proofSteps.push({
      number: stepNum++,
      action: 'Неравенство выполняется',
      details: 'Поскольку равенство недоказуемо, неравенство считается истинным',
    })
    return {
      success: true,
      message: 'Неравенство выполняется (равенство недоказуемо)',
      steps: ['Tried to prove equality', 'Failed', 'Therefore inequality holds'],
      proofSteps,
    }
  }

  proofSteps.push({
    number: stepNum++,
    action: 'Проверка равенства',
    details: 'Пытаемся доказать равенство левой и правой части',
  })
  proofSteps.push({
    number: stepNum++,
    action: 'Равенство доказано!',
    before: toCanonicalString(left),
    after: toCanonicalString(right),
    details: eqResult.message,
  })
  proofSteps.push({
    number: stepNum++,
    action: 'Неравенство не выполняется',
    details: 'Поскольку равенство доказуемо, неравенство ложно',
  })

  return {
    success: false,
    message: 'Неравенство не выполняется (равенство доказуемо)',
    steps: eqResult.steps,
    proofSteps,
    hints: [
      {
        type: 'suggestion',
        message: `Левая и правая части равны: ${eqResult.message}`,
      },
    ],
  }
}

/**
 * Verify a statement
 */
export function verify(node: ASTNode, state: ProverState): ProofResult {
  const normalized = normalize(node)

  if (isEqExpr(normalized)) {
    return checkEquality(normalized.left, normalized.right, state)
  }

  if (isNeqExpr(normalized)) {
    return checkInequality(normalized.left, normalized.right, state)
  }

  if (isDefExpr(normalized)) {
    // Add definition to state
    if (isIdentExpr(normalized.name)) {
      const name = normalized.name.name
      const formStr = toCanonicalString(normalized.form)
      state.definitions.set(name, normalized.form)
      return {
        success: true,
        message: `Определение добавлено: ${name}`,
        steps: ['Definition registered'],
        proofSteps: [
          {
            number: 1,
            action: 'Регистрация определения',
            axiom: AXIOMS.A0,
            details: `${name} : ${formStr}`,
          },
          {
            number: 2,
            action: 'Определение сохранено',
            details: `Идентификатор "${name}" теперь раскрывается как ${formStr}`,
          },
        ],
      }
    }
    return {
      success: false,
      message: 'Имя определения должно быть идентификатором',
      steps: [],
      proofSteps: [
        {
          number: 1,
          action: 'Ошибка определения',
          details: 'Левая часть определения должна быть простым идентификатором',
        },
      ],
      hints: [
        {
          type: 'suggestion',
          message: 'Используйте простой идентификатор слева от ":"',
          suggestion: 'mydef : <форма>.',
        },
      ],
    }
  }

  return {
    success: false,
    message: `Не удаётся верифицировать узел типа: ${node.type}`,
    steps: [],
    proofSteps: [
      {
        number: 1,
        action: 'Неподдерживаемый тип выражения',
        details: `Тип "${node.type}" не поддерживается для верификации`,
      },
    ],
    hints: [
      {
        type: 'suggestion',
        message: 'Поддерживаемые типы: равенство (=), неравенство (!=), определение (:)',
      },
    ],
  }
}

/**
 * Verify all statements in input
 * Note: Use parse() from parser.ts and verify() separately in browser
 */
export function verifyAll(_input: string): { results: ProofResult[]; state: ProverState } {
  // Import is handled by caller in browser context
  throw new Error('verifyAll not available - use parse() and verify() separately')
}
