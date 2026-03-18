/**
 * Interactive proof mode for МТС (Meta-Theory of Links)
 *
 * This module provides:
 * - Step-by-step proof construction with rollback capability
 * - Proof strategy selection (automatic, manual, guided)
 * - Hints for available proof steps
 * - Proof history with navigation (undo/redo)
 */

import type { ASTNode } from './ast'
import { isLinkExpr, isEqExpr, isDefExpr, isMaleExpr, isFemaleExpr, isInfinityExpr } from './ast'
import {
  type ProverState,
  type ProofResult,
  type ProofStep,
  type AxiomInfo,
  createProverState,
  verify,
  AXIOMS,
} from './prover'
import { normalize, toCanonicalString } from './normalizer'
import { parseExpr } from './parser'

/**
 * Available proof strategies
 */
export type ProofStrategy = 'automatic' | 'manual' | 'guided'

/**
 * Description of proof strategies
 */
export const STRATEGY_DESCRIPTIONS: Record<ProofStrategy, { name: string; description: string }> = {
  automatic: {
    name: 'Автоматический',
    description: 'Прувер автоматически применяет все доступные правила вывода',
  },
  manual: {
    name: 'Ручной',
    description: 'Пользователь выбирает каждый шаг доказательства',
  },
  guided: {
    name: 'С подсказками',
    description: 'Прувер предлагает шаги, пользователь выбирает из вариантов',
  },
}

/**
 * Type of proof step that can be taken
 */
export type StepType =
  | 'axiom' // Apply an axiom
  | 'definition' // Apply a definition
  | 'modus_ponens' // Apply Modus Ponens
  | 'transitivity' // Apply transitivity of equality
  | 'symmetry' // Apply symmetry of equality
  | 'congruence' // Apply congruence
  | 'normalize' // Normalize expression
  | 'expand' // Expand definitions
  | 'unify' // Try unification

/**
 * An available proof step that can be taken
 */
export interface AvailableStep {
  /** Unique identifier for this step */
  id: string
  /** Type of step */
  type: StepType
  /** Human-readable description */
  description: string
  /** The axiom or rule being applied (if applicable) */
  axiom?: AxiomInfo
  /** Expression before the step */
  before: string
  /** Expected expression after the step */
  after: string
  /** Confidence score (0-1) for guided mode */
  confidence: number
  /** Additional details about the step */
  details?: string
}

/**
 * A snapshot of the proof state for undo/redo
 */
export interface ProofSnapshot {
  /** Timestamp of the snapshot */
  timestamp: number
  /** Deep copy of the prover state */
  state: ProverState
  /** Current goal being proved */
  currentGoal: ASTNode | null
  /** List of remaining goals */
  goals: ASTNode[]
  /** Proof steps taken so far */
  steps: ProofStep[]
  /** Description of the action that led to this state */
  actionDescription: string
}

/**
 * Result of applying a proof step
 */
export interface StepResult {
  /** Whether the step was successful */
  success: boolean
  /** The proof result from the step */
  result?: ProofResult
  /** New goals created by the step */
  newGoals?: ASTNode[]
  /** Goals that were closed by the step */
  closedGoals?: ASTNode[]
  /** Error message if unsuccessful */
  error?: string
}

/**
 * Status of the proof session
 */
export type SessionStatus = 'initial' | 'in_progress' | 'completed' | 'failed'

/**
 * Interactive proof session
 *
 * Manages an interactive proof session with:
 * - Multiple goals to prove
 * - Step-by-step execution with undo/redo
 * - Available step suggestions
 * - Strategy-based automation
 */
export class ProofSession {
  /** Current prover state */
  private state: ProverState

  /** Current proof strategy */
  private strategy: ProofStrategy

  /** List of goals to prove */
  private goals: ASTNode[]

  /** Current goal index */
  private currentGoalIndex: number

  /** History of proof snapshots for undo */
  private history: ProofSnapshot[]

  /** Current position in history */
  private historyIndex: number

  /** Future snapshots for redo */
  private future: ProofSnapshot[]

  /** All proof steps taken */
  private allSteps: ProofStep[]

  /** Step counter for unique IDs */
  private stepCounter: number

  /** Session status */
  private _status: SessionStatus

  /** Cached available steps for the current goal */
  private cachedSteps: AvailableStep[] | null = null

  /** Goal string for which steps are cached */
  private cachedGoalStr: string | null = null

  constructor(strategy: ProofStrategy = 'guided') {
    this.state = createProverState()
    this.strategy = strategy
    this.goals = []
    this.currentGoalIndex = -1
    this.history = []
    this.historyIndex = -1
    this.future = []
    this.allSteps = []
    this.stepCounter = 0
    this._status = 'initial'
    this.cachedSteps = null
    this.cachedGoalStr = null

    // Save initial state
    this.saveSnapshot('Начало сессии')
  }

  /**
   * Get the current session status
   */
  get status(): SessionStatus {
    return this._status
  }

  /**
   * Get the current strategy
   */
  getStrategy(): ProofStrategy {
    return this.strategy
  }

  /**
   * Set the proof strategy
   */
  setStrategy(strategy: ProofStrategy): void {
    this.saveSnapshot(`Изменение стратегии на: ${STRATEGY_DESCRIPTIONS[strategy].name}`)
    this.strategy = strategy
  }

  /**
   * Get the current goal
   */
  getCurrentGoal(): ASTNode | null {
    if (this.currentGoalIndex < 0 || this.currentGoalIndex >= this.goals.length) {
      return null
    }
    return this.goals[this.currentGoalIndex]
  }

  /**
   * Get all remaining goals
   */
  getRemainingGoals(): ASTNode[] {
    return [...this.goals]
  }

  /**
   * Get the number of completed goals
   */
  getCompletedGoalsCount(): number {
    return this.allSteps.filter(s => s.details?.includes('Goal completed')).length
  }

  /**
   * Get all proof steps taken so far
   */
  getProofSteps(): ProofStep[] {
    return [...this.allSteps]
  }

  /**
   * Get the current prover state
   */
  getState(): ProverState {
    return this.state
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.history.length > 1 && this.historyIndex > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1 || this.future.length > 0
  }

  /**
   * Get history for display
   */
  getHistory(): { index: number; description: string; timestamp: number }[] {
    return this.history.map((snapshot, index) => ({
      index,
      description: snapshot.actionDescription,
      timestamp: snapshot.timestamp,
    }))
  }

  /**
   * Add a goal to prove
   */
  addGoal(goal: ASTNode): void {
    const normalized = normalize(goal)
    this.goals.push(normalized)

    if (this.currentGoalIndex < 0) {
      this.currentGoalIndex = 0
    }

    if (this._status === 'initial') {
      this._status = 'in_progress'
    }

    this.invalidateStepsCache()
    this.saveSnapshot(`Добавлена цель: ${toCanonicalString(normalized)}`)
  }

  /**
   * Add multiple goals from a parsed file or expression
   */
  addGoals(goals: ASTNode[]): void {
    goals.forEach(goal => {
      const normalized = normalize(goal)
      this.goals.push(normalized)
    })

    if (this.currentGoalIndex < 0 && this.goals.length > 0) {
      this.currentGoalIndex = 0
    }

    if (this._status === 'initial') {
      this._status = 'in_progress'
    }

    this.invalidateStepsCache()
    this.saveSnapshot(`Добавлено ${goals.length} целей`)
  }

  /**
   * Parse and add a goal from a string
   */
  addGoalFromString(input: string): void {
    const expr = parseExpr(input)
    this.addGoal(expr)
  }

  /**
   * Invalidate cached steps (called when goal changes)
   */
  private invalidateStepsCache(): void {
    this.cachedSteps = null
    this.cachedGoalStr = null
  }

  /**
   * Get available proof steps for the current goal
   */
  getAvailableSteps(): AvailableStep[] {
    const goal = this.getCurrentGoal()
    if (!goal) return []

    const goalStr = toCanonicalString(goal)

    // Return cached steps if available and goal hasn't changed
    if (this.cachedSteps !== null && this.cachedGoalStr === goalStr) {
      return this.cachedSteps
    }

    const steps: AvailableStep[] = []

    // Normalization step (always available)
    steps.push({
      id: this.generateStepId(),
      type: 'normalize',
      description: 'Нормализовать выражение',
      before: goalStr,
      after: goalStr,
      confidence: 0.5,
      details: 'Применить правила нормализации: !!x→x, !(♂x)→x♀, !(x♀)→♂x',
    })

    // Check for equality expressions
    if (isEqExpr(goal)) {
      // Reflexivity check (A1)
      if (toCanonicalString(goal.left) === toCanonicalString(goal.right)) {
        steps.push({
          id: this.generateStepId(),
          type: 'axiom',
          axiom: AXIOMS.A1,
          description: 'Применить рефлексивность (А1: x = x)',
          before: goalStr,
          after: '✓ Доказано',
          confidence: 1.0,
        })
      }

      // Male axiom (A5)
      if (isMaleExpr(goal.left) || isMaleExpr(goal.right)) {
        steps.push({
          id: this.generateStepId(),
          type: 'axiom',
          axiom: AXIOMS.A5,
          description: 'Применить аксиому ♂x = (♂x → x)',
          before: goalStr,
          after: 'Раскрыть ♂x как (♂x → x)',
          confidence: 0.8,
          details: 'Аксиома А5: самозамыкание начала',
        })
      }

      // Female axiom (A6)
      if (isFemaleExpr(goal.left) || isFemaleExpr(goal.right)) {
        steps.push({
          id: this.generateStepId(),
          type: 'axiom',
          axiom: AXIOMS.A6,
          description: 'Применить аксиому x♀ = (x → x♀)',
          before: goalStr,
          after: 'Раскрыть x♀ как (x → x♀)',
          confidence: 0.8,
          details: 'Аксиома А6: самозамыкание конца',
        })
      }

      // Infinity axiom (A4)
      if (isInfinityExpr(goal.left) || isInfinityExpr(goal.right)) {
        steps.push({
          id: this.generateStepId(),
          type: 'axiom',
          axiom: AXIOMS.A4,
          description: 'Применить аксиому ∞ = (∞ → ∞)',
          before: goalStr,
          after: 'Раскрыть ∞ как (∞ → ∞)',
          confidence: 0.8,
          details: 'Аксиома А4: акорень (полное самозамыкание)',
        })
      }

      // Symmetry (A1)
      steps.push({
        id: this.generateStepId(),
        type: 'symmetry',
        axiom: AXIOMS.A1,
        description: 'Применить симметрию равенства',
        before: `${toCanonicalString(goal.left)} = ${toCanonicalString(goal.right)}`,
        after: `${toCanonicalString(goal.right)} = ${toCanonicalString(goal.left)}`,
        confidence: 0.3,
        details: 'Аксиома А1: (x = y) → (y = x)',
      })

      // Expand definitions (A0)
      steps.push({
        id: this.generateStepId(),
        type: 'expand',
        axiom: AXIOMS.A0,
        description: 'Раскрыть определения',
        before: goalStr,
        after: 'Применить все известные определения',
        confidence: 0.6,
        details: 'Аксиома А0: s : F означает s = F',
      })

      // Unification
      steps.push({
        id: this.generateStepId(),
        type: 'unify',
        axiom: AXIOMS.A1,
        description: 'Попробовать унификацию',
        before: goalStr,
        after: 'Найти подстановку переменных',
        confidence: 0.7,
        details: 'Структурное сравнение с подстановкой переменных',
      })

      // Congruence (A2) for Link expressions
      if (isLinkExpr(goal.left) && isLinkExpr(goal.right)) {
        steps.push({
          id: this.generateStepId(),
          type: 'congruence',
          axiom: AXIOMS.A2,
          description: 'Применить конгруэнцию',
          before: goalStr,
          after: 'Разбить на подцели для компонентов связи',
          confidence: 0.6,
          details: 'Аксиома А2: {(a = c), (b = d)} → ((a → b) = (c → d))',
        })
      }

      // Transitivity (A1)
      if (this.state.provenEqualities.length > 0) {
        steps.push({
          id: this.generateStepId(),
          type: 'transitivity',
          axiom: AXIOMS.A1,
          description: 'Применить транзитивность',
          before: goalStr,
          after: 'Использовать ранее доказанные равенства',
          confidence: 0.5,
          details: 'Аксиома А1: {(x = y), (y = z)} → (x = z)',
        })
      }
    }

    // Check for Link expressions (implications)
    if (isLinkExpr(goal)) {
      // Modus Ponens
      if (this.state.provenFacts.length > 0) {
        steps.push({
          id: this.generateStepId(),
          type: 'modus_ponens',
          axiom: AXIOMS.MP,
          description: 'Применить Modus Ponens',
          before: goalStr,
          after: 'Попробовать вывести через MP',
          confidence: 0.7,
          details: 'Правило вывода: из P и (P → Q) следует Q',
        })
      }

      // Register as implication
      steps.push({
        id: this.generateStepId(),
        type: 'axiom',
        description: 'Зарегистрировать как импликацию',
        before: goalStr,
        after: 'Добавить в базу импликаций для MP',
        confidence: 0.5,
        details: 'Импликация будет использована для последующего применения MP',
      })
    }

    // Check for definition expressions
    if (isDefExpr(goal)) {
      steps.push({
        id: this.generateStepId(),
        type: 'definition',
        axiom: AXIOMS.A0,
        description: 'Зарегистрировать определение',
        before: goalStr,
        after: '✓ Определение добавлено',
        confidence: 1.0,
        details: 'Аксиома А0: определение регистрируется в состоянии прувера',
      })
    }

    // Sort by confidence (highest first)
    steps.sort((a, b) => b.confidence - a.confidence)

    // Cache the steps
    this.cachedSteps = steps
    this.cachedGoalStr = goalStr

    return steps
  }

  /**
   * Apply a specific step by ID
   */
  applyStep(stepId: string): StepResult {
    const availableSteps = this.getAvailableSteps()
    const step = availableSteps.find(s => s.id === stepId)

    if (!step) {
      return { success: false, error: `Шаг с ID ${stepId} не найден` }
    }

    return this.applyStepInternal(step)
  }

  /**
   * Apply the best available step (for automatic mode)
   */
  applyBestStep(): StepResult {
    const steps = this.getAvailableSteps()
    if (steps.length === 0) {
      return { success: false, error: 'Нет доступных шагов' }
    }

    // Apply the step with highest confidence
    return this.applyStepInternal(steps[0])
  }

  /**
   * Apply a step and update state
   */
  private applyStepInternal(step: AvailableStep): StepResult {
    const goal = this.getCurrentGoal()
    if (!goal) {
      return { success: false, error: 'Нет текущей цели' }
    }

    this.saveSnapshot(`Применение: ${step.description}`)
    this.invalidateStepsCache()

    // Verify the goal using the prover
    const result = verify(goal, this.state)

    // Create a proof step record
    const proofStep: ProofStep = {
      index: this.allSteps.length + 1,
      action: step.description,
      before: step.before,
      after: result.success ? '✓ Доказано' : step.after,
      axiom: step.axiom,
      details: step.details,
    }

    this.allSteps.push(proofStep)

    if (result.success) {
      // Goal completed - remove from goals
      this.goals.splice(this.currentGoalIndex, 1)

      // Update current goal index
      if (this.goals.length === 0) {
        this.currentGoalIndex = -1
        this._status = 'completed'
      } else if (this.currentGoalIndex >= this.goals.length) {
        this.currentGoalIndex = this.goals.length - 1
      }

      return {
        success: true,
        result,
        closedGoals: [goal],
      }
    }

    // If step type is congruence, we might create subgoals
    if (
      step.type === 'congruence' &&
      isEqExpr(goal) &&
      isLinkExpr(goal.left) &&
      isLinkExpr(goal.right)
    ) {
      // Create two subgoals: prove left parts equal and right parts equal
      const leftGoal: ASTNode = {
        type: 'Equality',
        left: goal.left.left,
        right: goal.right.left,
      }
      const rightGoal: ASTNode = {
        type: 'Equality',
        left: goal.left.right,
        right: goal.right.right,
      }

      // Replace current goal with subgoals
      this.goals.splice(this.currentGoalIndex, 1, normalize(leftGoal), normalize(rightGoal))

      return {
        success: true,
        result,
        newGoals: [normalize(leftGoal), normalize(rightGoal)],
      }
    }

    return {
      success: true,
      result,
    }
  }

  /**
   * Run automatic proof for the current goal
   */
  runAutomatic(): StepResult[] {
    const results: StepResult[] = []
    let iterations = 0
    const maxIterations = 100 // Prevent infinite loops

    while (this.getCurrentGoal() && iterations < maxIterations) {
      const result = this.applyBestStep()
      results.push(result)

      if (!result.success) {
        break
      }

      iterations++
    }

    return results
  }

  /**
   * Undo the last action
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false
    }

    // Save current state to future for redo
    const currentSnapshot = this.createSnapshot('Текущее состояние')
    this.future.unshift(currentSnapshot)

    // Restore previous state
    this.historyIndex--
    const snapshot = this.history[this.historyIndex]
    this.restoreSnapshot(snapshot)

    return true
  }

  /**
   * Redo the previously undone action
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false
    }

    // Move to next state
    const snapshot = this.future.shift()!
    this.restoreSnapshot(snapshot)
    this.historyIndex++

    return true
  }

  /**
   * Jump to a specific point in history
   */
  jumpToHistory(index: number): boolean {
    if (index < 0 || index >= this.history.length) {
      return false
    }

    // Save everything after this point to future
    if (index < this.historyIndex) {
      const toFuture = this.history.slice(index + 1, this.historyIndex + 1)
      this.future = toFuture.concat(this.future)
    }

    this.historyIndex = index
    this.restoreSnapshot(this.history[index])

    return true
  }

  /**
   * Reset the session to initial state
   */
  reset(): void {
    this.state = createProverState()
    this.goals = []
    this.currentGoalIndex = -1
    this.history = []
    this.historyIndex = -1
    this.future = []
    this.allSteps = []
    this.stepCounter = 0
    this._status = 'initial'
  }

  /**
   * Create a snapshot of the current state
   */
  private createSnapshot(actionDescription: string): ProofSnapshot {
    return {
      timestamp: Date.now(),
      state: this.cloneState(this.state),
      currentGoal: this.getCurrentGoal(),
      goals: [...this.goals],
      steps: [...this.allSteps],
      actionDescription,
    }
  }

  /**
   * Save a snapshot to history
   */
  private saveSnapshot(actionDescription: string): void {
    const snapshot = this.createSnapshot(actionDescription)

    // Remove any future states (new branch of history)
    this.future = []

    // Add to history
    this.history.push(snapshot)
    this.historyIndex = this.history.length - 1

    // Limit history size
    const maxHistory = 100
    if (this.history.length > maxHistory) {
      this.history.shift()
      this.historyIndex--
    }
  }

  /**
   * Restore state from a snapshot
   */
  private restoreSnapshot(snapshot: ProofSnapshot): void {
    this.state = this.cloneState(snapshot.state)
    this.goals = [...snapshot.goals]
    this.currentGoalIndex = snapshot.currentGoal
      ? this.goals.findIndex(g => toCanonicalString(g) === toCanonicalString(snapshot.currentGoal!))
      : -1
    this.allSteps = [...snapshot.steps]

    if (this.goals.length === 0) {
      this._status = this.allSteps.length > 0 ? 'completed' : 'initial'
    } else {
      this._status = 'in_progress'
    }
  }

  /**
   * Deep clone the prover state
   */
  private cloneState(state: ProverState): ProverState {
    return {
      axioms: [...state.axioms],
      definitions: new Map(state.definitions),
      facts: new Set(state.facts),
      provenFacts: [...state.provenFacts],
      provenEqualities: state.provenEqualities.map(eq => ({
        left: eq.left,
        right: eq.right,
        normalized: eq.normalized,
      })),
      provenImplications: state.provenImplications.map(impl => ({
        antecedent: impl.antecedent,
        consequent: impl.consequent,
        source: impl.source,
      })),
      trace: [...state.trace],
    }
  }

  /**
   * Generate a unique step ID
   */
  private generateStepId(): string {
    return `step-${++this.stepCounter}-${Date.now()}`
  }
}

/**
 * Create a new interactive proof session
 */
export function createProofSession(strategy: ProofStrategy = 'guided'): ProofSession {
  return new ProofSession(strategy)
}

/**
 * Get suggested next steps for a goal
 * This is a convenience function for quick access to suggestions
 */
export function getSuggestedSteps(
  goal: ASTNode,
  state: ProverState,
  maxSteps: number = 5
): AvailableStep[] {
  const session = new ProofSession('guided')
  // Copy state
  session['state'] = session['cloneState'](state)
  session.addGoal(goal)
  return session.getAvailableSteps().slice(0, maxSteps)
}

/**
 * Quick proof attempt - try to prove a goal automatically
 */
export function quickProof(
  goal: ASTNode,
  state?: ProverState
): {
  success: boolean
  steps: ProofStep[]
  finalState: ProverState
} {
  const session = new ProofSession('automatic')
  if (state) {
    session['state'] = session['cloneState'](state)
  }
  session.addGoal(goal)
  session.runAutomatic()

  return {
    success: session.status === 'completed',
    steps: session.getProofSteps(),
    finalState: session.getState(),
  }
}
