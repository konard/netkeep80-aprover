/**
 * Unit tests for interactive proof mode
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'
import {
  ProofSession,
  createProofSession,
  getSuggestedSteps,
  quickProof,
  STRATEGY_DESCRIPTIONS,
  type ProofStrategy,
} from '../../src/core/interactive'
import { createProverState } from '../../src/core/prover'

describe('Interactive Proof Mode', () => {
  describe('ProofSession creation', () => {
    it('should create a session with default guided strategy', () => {
      const session = createProofSession()
      expect(session.getStrategy()).toBe('guided')
    })

    it('should create a session with specified strategy', () => {
      const session = createProofSession('automatic')
      expect(session.getStrategy()).toBe('automatic')
    })

    it('should start with initial status', () => {
      const session = createProofSession()
      expect(session.status).toBe('initial')
    })

    it('should have empty goals initially', () => {
      const session = createProofSession()
      expect(session.getRemainingGoals()).toHaveLength(0)
      expect(session.getCurrentGoal()).toBeNull()
    })
  })

  describe('Strategy management', () => {
    it('should change strategy', () => {
      const session = createProofSession('manual')
      expect(session.getStrategy()).toBe('manual')
      session.setStrategy('automatic')
      expect(session.getStrategy()).toBe('automatic')
    })

    it('should have descriptions for all strategies', () => {
      const strategies: ProofStrategy[] = ['automatic', 'manual', 'guided']
      strategies.forEach(s => {
        expect(STRATEGY_DESCRIPTIONS[s]).toBeDefined()
        expect(STRATEGY_DESCRIPTIONS[s].name).toBeDefined()
        expect(STRATEGY_DESCRIPTIONS[s].description).toBeDefined()
      })
    })
  })

  describe('Goal management', () => {
    let session: ProofSession

    beforeEach(() => {
      session = createProofSession()
    })

    it('should add a goal', () => {
      const goal = normalize(parseExpr('a = a'))
      session.addGoal(goal)
      expect(session.getRemainingGoals()).toHaveLength(1)
      expect(session.getCurrentGoal()).not.toBeNull()
    })

    it('should add goal from string', () => {
      session.addGoalFromString('∞ = ∞ -> ∞')
      expect(session.getRemainingGoals()).toHaveLength(1)
    })

    it('should add multiple goals', () => {
      const goals = [
        normalize(parseExpr('a = a')),
        normalize(parseExpr('b = b')),
        normalize(parseExpr('c = c')),
      ]
      session.addGoals(goals)
      expect(session.getRemainingGoals()).toHaveLength(3)
    })

    it('should change status to in_progress when goals added', () => {
      expect(session.status).toBe('initial')
      session.addGoalFromString('a = a')
      expect(session.status).toBe('in_progress')
    })
  })

  describe('Available steps', () => {
    let session: ProofSession

    beforeEach(() => {
      session = createProofSession()
    })

    it('should return empty steps when no goal', () => {
      const steps = session.getAvailableSteps()
      expect(steps).toHaveLength(0)
    })

    it('should suggest normalize step for any goal', () => {
      session.addGoalFromString('a = a')
      const steps = session.getAvailableSteps()
      const normalizeStep = steps.find(s => s.type === 'normalize')
      expect(normalizeStep).toBeDefined()
    })

    it('should suggest reflexivity for x = x', () => {
      session.addGoalFromString('a = a')
      const steps = session.getAvailableSteps()
      const reflexivityStep = steps.find(s => s.type === 'axiom' && s.axiom?.id === 'A1')
      expect(reflexivityStep).toBeDefined()
      expect(reflexivityStep!.confidence).toBe(1.0)
    })

    it('should suggest A5 axiom for male expressions', () => {
      session.addGoalFromString('♂v = ♂v -> v')
      const steps = session.getAvailableSteps()
      const maleStep = steps.find(s => s.axiom?.id === 'A5')
      expect(maleStep).toBeDefined()
    })

    it('should suggest A6 axiom for female expressions', () => {
      session.addGoalFromString('r♀ = r -> r♀')
      const steps = session.getAvailableSteps()
      const femaleStep = steps.find(s => s.axiom?.id === 'A6')
      expect(femaleStep).toBeDefined()
    })

    it('should suggest A4 axiom for infinity expressions', () => {
      session.addGoalFromString('∞ = ∞ -> ∞')
      const steps = session.getAvailableSteps()
      const infinityStep = steps.find(s => s.axiom?.id === 'A4')
      expect(infinityStep).toBeDefined()
    })

    it('should suggest congruence for link equalities', () => {
      session.addGoalFromString('(a -> b) = (a -> b)')
      const steps = session.getAvailableSteps()
      const congruenceStep = steps.find(s => s.type === 'congruence')
      expect(congruenceStep).toBeDefined()
    })

    it('should sort steps by confidence (highest first)', () => {
      session.addGoalFromString('a = a')
      const steps = session.getAvailableSteps()
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i - 1].confidence).toBeGreaterThanOrEqual(steps[i].confidence)
      }
    })

    it('should have unique IDs for all steps', () => {
      session.addGoalFromString('♂∞ = ♂∞ -> ∞')
      const steps = session.getAvailableSteps()
      const ids = steps.map(s => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('Step application', () => {
    let session: ProofSession

    beforeEach(() => {
      session = createProofSession()
    })

    it('should apply step by ID', () => {
      session.addGoalFromString('a = a')
      // Get steps - they are now cached
      const steps = session.getAvailableSteps()
      expect(steps.length).toBeGreaterThan(0)
      const step = steps[0] // First step is highest confidence after sorting
      expect(step).toBeDefined()
      expect(step.id).toBeDefined()

      // Apply using the step ID - works because steps are cached
      const result = session.applyStep(step.id)
      expect(result.success).toBe(true)
    })

    it('should fail for invalid step ID', () => {
      session.addGoalFromString('a = a')
      const result = session.applyStep('invalid-id')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should apply best step', () => {
      session.addGoalFromString('a = a')
      const result = session.applyBestStep()
      expect(result.success).toBe(true)
    })

    it('should complete goal on successful proof', () => {
      session.addGoalFromString('a = a')
      expect(session.getRemainingGoals()).toHaveLength(1)

      const result = session.applyBestStep()
      expect(result.success).toBe(true)
      expect(result.closedGoals).toBeDefined()
      expect(result.closedGoals!.length).toBe(1)
      expect(session.getRemainingGoals()).toHaveLength(0)
    })

    it('should update status to completed when all goals done', () => {
      session.addGoalFromString('a = a')
      session.applyBestStep()
      expect(session.status).toBe('completed')
    })

    it('should track proof steps', () => {
      session.addGoalFromString('a = a')
      expect(session.getProofSteps()).toHaveLength(0)

      session.applyBestStep()
      expect(session.getProofSteps()).toHaveLength(1)
    })
  })

  describe('Automatic mode', () => {
    it('should run automatic proof for simple goal', () => {
      const session = createProofSession('automatic')
      session.addGoalFromString('∞ = ∞')
      const results = session.runAutomatic()

      expect(results.length).toBeGreaterThan(0)
      expect(session.status).toBe('completed')
    })

    it('should handle multiple goals in automatic mode', () => {
      const session = createProofSession('automatic')
      session.addGoalFromString('a = a')
      session.addGoalFromString('b = b')
      session.addGoalFromString('c = c')

      session.runAutomatic()
      expect(session.status).toBe('completed')
      expect(session.getRemainingGoals()).toHaveLength(0)
    })

    it('should stop at max iterations', () => {
      const session = createProofSession('automatic')
      // Add a goal that might take many iterations
      session.addGoalFromString('(aa -> bb) = (cc -> dd)')
      const results = session.runAutomatic()

      // Should eventually stop even if not proved
      expect(results.length).toBeLessThanOrEqual(100)
    })
  })

  describe('Undo/Redo', () => {
    let session: ProofSession

    beforeEach(() => {
      session = createProofSession()
    })

    it('should not allow undo initially', () => {
      expect(session.canUndo()).toBe(false)
    })

    it('should not allow redo initially', () => {
      expect(session.canRedo()).toBe(false)
    })

    it('should allow undo after adding goal', () => {
      session.addGoalFromString('a = a')
      expect(session.canUndo()).toBe(true)
    })

    it('should undo goal addition', () => {
      session.addGoalFromString('a = a')
      expect(session.getRemainingGoals()).toHaveLength(1)

      const result = session.undo()
      expect(result).toBe(true)
      expect(session.getRemainingGoals()).toHaveLength(0)
    })

    it('should allow redo after undo', () => {
      session.addGoalFromString('a = a')
      session.undo()
      expect(session.canRedo()).toBe(true)
    })

    it('should redo goal addition', () => {
      session.addGoalFromString('a = a')
      session.undo()
      session.redo()
      expect(session.getRemainingGoals()).toHaveLength(1)
    })

    it('should undo step application', () => {
      session.addGoalFromString('a = a')
      session.applyBestStep()
      expect(session.status).toBe('completed')

      session.undo()
      expect(session.status).toBe('in_progress')
      expect(session.getRemainingGoals()).toHaveLength(1)
    })

    it('should clear future after new action', () => {
      session.addGoalFromString('a = a')
      session.undo()
      expect(session.canRedo()).toBe(true)

      session.addGoalFromString('b = b')
      expect(session.canRedo()).toBe(false)
    })

    it('should return false for undo when not possible', () => {
      expect(session.undo()).toBe(false)
    })

    it('should return false for redo when not possible', () => {
      expect(session.redo()).toBe(false)
    })
  })

  describe('History navigation', () => {
    let session: ProofSession

    beforeEach(() => {
      session = createProofSession()
      session.addGoalFromString('a = a')
      session.addGoalFromString('b = b')
      session.addGoalFromString('c = c')
    })

    it('should track history', () => {
      const history = session.getHistory()
      expect(history.length).toBeGreaterThan(0)
    })

    it('should have timestamps in history', () => {
      const history = session.getHistory()
      history.forEach(h => {
        expect(h.timestamp).toBeGreaterThan(0)
      })
    })

    it('should have descriptions in history', () => {
      const history = session.getHistory()
      history.forEach(h => {
        expect(h.description).toBeDefined()
        expect(h.description.length).toBeGreaterThan(0)
      })
    })

    it('should jump to specific history point', () => {
      // Verify history exists before jumping
      expect(session.getHistory().length).toBeGreaterThan(0)
      const targetIndex = 1 // Second action

      const result = session.jumpToHistory(targetIndex)
      expect(result).toBe(true)
    })

    it('should fail for invalid history index', () => {
      expect(session.jumpToHistory(-1)).toBe(false)
      expect(session.jumpToHistory(1000)).toBe(false)
    })
  })

  describe('Reset', () => {
    it('should reset session to initial state', () => {
      const session = createProofSession()
      session.addGoalFromString('a = a')
      session.applyBestStep()

      session.reset()

      expect(session.status).toBe('initial')
      expect(session.getRemainingGoals()).toHaveLength(0)
      expect(session.getProofSteps()).toHaveLength(0)
      expect(session.canUndo()).toBe(false)
      expect(session.canRedo()).toBe(false)
    })
  })

  describe('Utility functions', () => {
    describe('getSuggestedSteps', () => {
      it('should return suggested steps for a goal', () => {
        const goal = normalize(parseExpr('∞ = ∞'))
        const state = createProverState()
        const steps = getSuggestedSteps(goal, state)

        expect(steps.length).toBeGreaterThan(0)
        expect(steps.length).toBeLessThanOrEqual(5) // Default max
      })

      it('should respect maxSteps parameter', () => {
        const goal = normalize(parseExpr('♂v = ♂v -> v'))
        const state = createProverState()
        const steps = getSuggestedSteps(goal, state, 2)

        expect(steps.length).toBeLessThanOrEqual(2)
      })
    })

    describe('quickProof', () => {
      it('should prove simple goals', () => {
        const goal = normalize(parseExpr('a = a'))
        const result = quickProof(goal)

        expect(result.success).toBe(true)
        expect(result.steps.length).toBeGreaterThan(0)
      })

      it('should prove ∞ = ∞ -> ∞', () => {
        const goal = normalize(parseExpr('∞ = ∞ -> ∞'))
        const result = quickProof(goal)

        expect(result.success).toBe(true)
      })

      it('should prove ♂v = ♂v -> v', () => {
        const goal = normalize(parseExpr('♂v = ♂v -> v'))
        const result = quickProof(goal)

        expect(result.success).toBe(true)
      })

      it('should return final state', () => {
        const goal = normalize(parseExpr('a = a'))
        const result = quickProof(goal)

        expect(result.finalState).toBeDefined()
        expect(result.finalState.provenEqualities).toBeDefined()
      })

      it('should accept initial state', () => {
        const state = createProverState()
        const goal = normalize(parseExpr('a = a'))
        const result = quickProof(goal, state)

        expect(result.success).toBe(true)
      })
    })
  })

  describe('Complex proofs', () => {
    it('should handle definition registration', () => {
      const session = createProofSession()
      session.addGoalFromString('mydef : a -> b')
      session.applyBestStep()

      expect(session.status).toBe('completed')
      const state = session.getState()
      expect(state.definitions.has('mydef')).toBe(true)
    })

    it('should handle link expressions', () => {
      const session = createProofSession()
      session.addGoalFromString('a -> b')
      session.applyBestStep()

      const state = session.getState()
      expect(state.provenImplications.length).toBeGreaterThan(0)
    })

    it('should prove with A5 axiom expansion', () => {
      const session = createProofSession()
      session.addGoalFromString('♂v = (♂v -> v) -> v')
      session.runAutomatic()

      expect(session.status).toBe('completed')
    })

    it('should prove with A6 axiom expansion', () => {
      const session = createProofSession()
      session.addGoalFromString('r♀ = r -> (r -> r♀)')
      session.runAutomatic()

      expect(session.status).toBe('completed')
    })

    it('should prove with A4 axiom recursive collapse', () => {
      const session = createProofSession()
      session.addGoalFromString('∞ = (∞ -> ∞) -> ∞')
      session.runAutomatic()

      expect(session.status).toBe('completed')
    })
  })

  describe('Proof step tracking', () => {
    it('should track step indices', () => {
      const session = createProofSession()
      session.addGoalFromString('a = a')
      session.addGoalFromString('b = b')

      session.applyBestStep()
      session.applyBestStep()

      const steps = session.getProofSteps()
      expect(steps[0].index).toBe(1)
      expect(steps[1].index).toBe(2)
    })

    it('should include axiom info in steps', () => {
      const session = createProofSession()
      session.addGoalFromString('a = a')
      session.applyBestStep()

      const steps = session.getProofSteps()
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[0].action).toBeDefined()
    })
  })
})
