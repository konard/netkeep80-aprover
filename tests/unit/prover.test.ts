/**
 * Unit tests for МТС prover
 */

import { describe, it, expect } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import { normalize, toCanonicalString } from '../../src/core/normalizer'
import {
  createProverState,
  unify,
  applySubstitution,
  checkEquality,
  checkInequality,
  verify,
  AXIOMS,
  addProvenFact,
  addProvenImplication,
  tryModusPonens,
  applyModusPonens,
} from '../../src/core/prover'

describe('Prover', () => {
  const state = () => createProverState()

  describe('Unification', () => {
    it('should unify identical terms', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('a -> b'))
      expect(unify(a, b)).not.toBeNull()
    })

    it('should unify with variables', () => {
      const a = normalize(parseExpr('x -> y'))
      const b = normalize(parseExpr('a -> b'))
      const subst = unify(a, b)
      expect(subst).not.toBeNull()
      expect(subst!.get('x')).toBeDefined()
      expect(subst!.get('y')).toBeDefined()
    })

    it('should fail on conflicting structures', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('♂c'))
      expect(unify(a, b)).toBeNull()
    })

    it('should handle nested unification', () => {
      const a = normalize(parseExpr('(x -> y) -> z'))
      const b = normalize(parseExpr('(a -> b) -> c'))
      const subst = unify(a, b)
      expect(subst).not.toBeNull()
    })

    it('should fail occurs check', () => {
      // Can't unify x with (x -> a)
      const a = normalize(parseExpr('x'))
      const b = normalize(parseExpr('x -> a'))
      expect(unify(a, b)).toBeNull()
    })
  })

  describe('Substitution', () => {
    it('should apply substitution', () => {
      const node = normalize(parseExpr('x -> y'))
      const subst = new Map<string, any>()
      subst.set('x', { type: 'Identifier', name: 'a' })
      subst.set('y', { type: 'Identifier', name: 'b' })
      const result = applySubstitution(node, subst)
      expect((result as any).left.name).toBe('a')
      expect((result as any).right.name).toBe('b')
    })
  })

  describe('Equality checking', () => {
    it('should prove reflexivity', () => {
      const a = normalize(parseExpr('a'))
      const result = checkEquality(a, a, state())
      expect(result.success).toBe(true)
    })

    it('should prove structural equality', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('a -> b'))
      const result = checkEquality(a, b, state())
      expect(result.success).toBe(true)
    })

    it('should fail on different structures', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const a1 = normalize(parseExpr('aa -> bb'))
      const b1 = normalize(parseExpr('bb -> aa'))
      const result = checkEquality(a1, b1, state())
      expect(result.success).toBe(false)
    })

    it('should use ♂ axiom', () => {
      // ♂x = ♂x -> x
      const left = normalize(parseExpr('♂a'))
      const right = normalize(parseExpr('♂a -> a'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })

    it('should use ♀ axiom', () => {
      // x♀ = x -> x♀
      const left = normalize(parseExpr('a♀'))
      const right = normalize(parseExpr('a -> a♀'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })

    it('should use ∞ axiom', () => {
      // ∞ = ∞ -> ∞
      const left = normalize(parseExpr('∞'))
      const right = normalize(parseExpr('∞ -> ∞'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })
  })

  describe('Inequality checking', () => {
    it('should prove inequality when equality fails', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const aa = normalize(parseExpr('aa'))
      const bb = normalize(parseExpr('bb'))
      const result = checkInequality(aa, bb, state())
      expect(result.success).toBe(true)
    })

    it('should fail inequality when equality holds', () => {
      const a = normalize(parseExpr('a'))
      const b = normalize(parseExpr('a'))
      const result = checkInequality(a, b, state())
      expect(result.success).toBe(false)
    })
  })

  describe('Verify statements', () => {
    it('should verify equality statement', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify inequality statement', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const neq = normalize(parseExpr('aa != bb'))
      const result = verify(neq, state())
      expect(result.success).toBe(true)
    })

    it('should register definition', () => {
      const s = state()
      const def = normalize(parseExpr('mydef : a -> b'))
      const result = verify(def, s)
      expect(result.success).toBe(true)
      expect(s.definitions.has('mydef')).toBe(true)
    })
  })

  describe('MTL formulas tests', () => {
    // Tests based on tests/mtl_formulas.mtc

    it('should verify ab = a -> b', () => {
      // This is definitional, handled by parser
      const eq = normalize(parseExpr('a -> b = a -> b'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ♂v = ♂v -> v', () => {
      const eq = normalize(parseExpr('♂v = ♂v -> v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify r♀ = r -> r♀', () => {
      const eq = normalize(parseExpr('r♀ = r -> r♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ∞ = ∞ -> ∞', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify !♂x = x♀ (via normalization)', () => {
      // After normalization, !♂x becomes x♀
      const eq = normalize(parseExpr('!♂x = x♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify !x♀ = ♂x (via normalization)', () => {
      // After normalization, !x♀ becomes ♂x
      const eq = normalize(parseExpr('!x♀ = ♂x'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify left associativity: a->b->c = (a->b)->c', () => {
      const eq = normalize(parseExpr('a -> b -> c = (a -> b) -> c'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify power expansion: a^2 = a -> a', () => {
      const eq = normalize(parseExpr('a^2 = a -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify power expansion: a^3 = (a -> a) -> a', () => {
      const eq = normalize(parseExpr('a^3 = (a -> a) -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ∞ = ∞ (reflexivity)', () => {
      const eq = normalize(parseExpr('∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })
  })

  describe('Detailed proof steps', () => {
    it('should return proofSteps array for successful verification', () => {
      const eq = normalize(parseExpr('∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.proofSteps).toBeDefined()
      expect(result.proofSteps!.length).toBeGreaterThan(0)
    })

    it('should include normalization step', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const normStep = result.proofSteps!.find(s => s.action.includes('Нормализация'))
      expect(normStep).toBeDefined()
    })

    it('should include step index numbers', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      result.proofSteps!.forEach((step, idx) => {
        expect(step.index).toBe(idx + 1)
      })
    })

    it('should include before/after transformations when applicable', () => {
      const eq = normalize(parseExpr('♂a = ♂a -> a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const axiomStep = result.proofSteps!.find(s => s.axiom?.id === 'A5')
      expect(axiomStep).toBeDefined()
    })

    it('should include details in proof steps', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const hasDetails = result.proofSteps!.some(s => s.details !== undefined)
      expect(hasDetails).toBe(true)
    })
  })

  describe('Applied axioms tracking', () => {
    it('should track A1 for structural equality', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A1')).toBe(true)
    })

    it('should track A4 for infinity axiom', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should track A5 for male axiom', () => {
      const eq = normalize(parseExpr('♂a = ♂a -> a'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should track A6 for female axiom', () => {
      const eq = normalize(parseExpr('a♀ = a -> a♀'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should track A0 for definitions', () => {
      const def = normalize(parseExpr('mydef : a -> b'))
      const result = verify(def, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A0')).toBe(true)
    })

    it('should include axiom name and formula', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      const a1 = result.appliedAxioms!.find(a => a.id === 'A1')
      expect(a1).toBeDefined()
      expect(a1!.name).toBeDefined()
      expect(a1!.formula).toBeDefined()
    })
  })

  describe('Verification hints', () => {
    it('should return hints for failed verification', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const eq = normalize(parseExpr('♂∞ = ∞♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      expect(result.hints).toBeDefined()
      expect(result.hints!.length).toBeGreaterThan(0)
    })

    it('should suggest related axioms in hints', () => {
      // Male expression that can't be unified
      const eq = normalize(parseExpr('♂aa = bb'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      const axiomHint = result.hints!.find(h => h.relatedAxiom === 'A5')
      expect(axiomHint).toBeDefined()
    })

    it('should provide hint about duality for ♂ vs ♀', () => {
      const eq = normalize(parseExpr('♂∞ = ∞♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      const dualityHint = result.hints!.find(h => h.message.includes('дуальны'))
      expect(dualityHint).toBeDefined()
    })

    it('should provide structural hints for type mismatch', () => {
      const eq = normalize(parseExpr('∞ = ♂aa'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      expect(result.hints).toBeDefined()
    })

    it('should include hint type', () => {
      const eq = normalize(parseExpr('aa = bb'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      result.hints!.forEach(hint => {
        expect(['structural', 'definition', 'axiom', 'suggestion']).toContain(hint.type)
      })
    })
  })

  describe('AXIOMS constant', () => {
    it('should have all axioms defined', () => {
      expect(AXIOMS.A0).toBeDefined()
      expect(AXIOMS.A1).toBeDefined()
      expect(AXIOMS.A4).toBeDefined()
      expect(AXIOMS.A5).toBeDefined()
      expect(AXIOMS.A6).toBeDefined()
      expect(AXIOMS.A7).toBeDefined()
    })

    it('should have required properties for each axiom', () => {
      Object.values(AXIOMS).forEach(axiom => {
        expect(axiom.id).toBeDefined()
        expect(axiom.name).toBeDefined()
        expect(axiom.formula).toBeDefined()
        expect(axiom.description).toBeDefined()
      })
    })
  })

  describe('Infinity collapse (issue #51)', () => {
    it('should verify ∞ = ∞ -> ∞ -> ∞ (left-associative)', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ = (∞ -> ∞) -> ∞', () => {
      const eq = normalize(parseExpr('∞ = (∞ -> ∞) -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ = ∞ -> ∞ -> ∞ -> ∞ (3-level nesting)', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify (∞ -> ∞) -> ∞ = ∞ (reverse direction)', () => {
      const eq = normalize(parseExpr('(∞ -> ∞) -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ((∞ -> ∞) -> ∞) -> ∞ = ∞ (deep nesting)', () => {
      const eq = normalize(parseExpr('((∞ -> ∞) -> ∞) -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ -> ∞ -> ∞ -> ∞ -> ∞ = ∞ (4-level nesting)', () => {
      const eq = normalize(parseExpr('∞ -> ∞ -> ∞ -> ∞ -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify symmetric case: ∞ = ∞ -> ∞ and ∞ -> ∞ = ∞', () => {
      const eq1 = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result1 = verify(eq1, state())
      expect(result1.success).toBe(true)

      const eq2 = normalize(parseExpr('∞ -> ∞ = ∞'))
      const result2 = verify(eq2, state())
      expect(result2.success).toBe(true)
    })

    it('should still respect the original ∞ = ∞ -> ∞ case', () => {
      // This is a regression test to ensure the simple case still works
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })
  })

  describe('Male expansion (issue #53)', () => {
    it('should verify ♂v = ♂v -> v -> v -> v (left-associative)', () => {
      const eq = normalize(parseExpr('♂v = ♂v -> v -> v -> v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should verify ♂v = (♂v -> v) -> v', () => {
      const eq = normalize(parseExpr('♂v = (♂v -> v) -> v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should verify ♂v = ((♂v -> v) -> v) -> v', () => {
      const eq = normalize(parseExpr('♂v = ((♂v -> v) -> v) -> v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should verify (♂v -> v) -> v = ♂v (reverse direction)', () => {
      const eq = normalize(parseExpr('(♂v -> v) -> v = ♂v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should verify ((♂v -> v) -> v) -> v = ♂v (deep nesting)', () => {
      const eq = normalize(parseExpr('((♂v -> v) -> v) -> v = ♂v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should verify ♂a = ♂a -> a -> a -> a (3-level nesting)', () => {
      const eq = normalize(parseExpr('♂a = ♂a -> a -> a -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should still respect the original ♂x = ♂x -> x case', () => {
      // This is a regression test to ensure the simple case still works
      const eq = normalize(parseExpr('♂a = ♂a -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })
  })

  describe('Female expansion (issue #53)', () => {
    it('should verify r♀ = r -> (r -> r♀)', () => {
      const eq = normalize(parseExpr('r♀ = r -> (r -> r♀)'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should verify r♀ = r -> (r -> (r -> r♀))', () => {
      const eq = normalize(parseExpr('r♀ = r -> (r -> (r -> r♀))'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should verify r -> (r -> r♀) = r♀ (reverse direction)', () => {
      const eq = normalize(parseExpr('r -> (r -> r♀) = r♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should verify r -> (r -> (r -> r♀)) = r♀ (deep nesting)', () => {
      const eq = normalize(parseExpr('r -> (r -> (r -> r♀)) = r♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should still respect the original x♀ = x -> x♀ case', () => {
      // This is a regression test to ensure the simple case still works
      const eq = normalize(parseExpr('r♀ = r -> r♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })
  })

  describe('Extended resolution - Symmetry (A1)', () => {
    it('should use symmetry: if (a = b) is proven, then (b = a) is valid', () => {
      const s = state()
      // First prove a = b (will be stored in proven equalities)
      const eq1 = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result1 = verify(eq1, s)
      expect(result1.success).toBe(true)

      // Now the symmetric version should also work via transitivity/symmetry mechanism
      const eq2 = normalize(parseExpr('∞ -> ∞ = ∞'))
      const result2 = verify(eq2, s)
      expect(result2.success).toBe(true)
    })

    it('should track proven equalities in state', () => {
      const s = state()
      expect(s.provenEqualities.length).toBe(0)

      const eq = normalize(parseExpr('a = a'))
      verify(eq, s)
      expect(s.provenEqualities.length).toBeGreaterThanOrEqual(1)
    })

    it('should apply symmetry for complex expressions', () => {
      const s = state()
      // Prove ♂v = ♂v -> v
      const eq1 = normalize(parseExpr('♂v = ♂v -> v'))
      const result1 = verify(eq1, s)
      expect(result1.success).toBe(true)

      // Now ♂v -> v = ♂v should work via symmetry
      const eq2 = normalize(parseExpr('♂v -> v = ♂v'))
      const result2 = verify(eq2, s)
      expect(result2.success).toBe(true)
    })
  })

  describe('Extended resolution - Transitivity (A1)', () => {
    it('should prove transitivity: if (a = b) and (b = c) then (a = c)', () => {
      const s = state()

      // First prove a = b
      const eq1 = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result1 = verify(eq1, s)
      expect(result1.success).toBe(true)

      // Now prove that (∞ -> ∞) = some other form
      // Let's use the recursive collapse: ∞ -> ∞ -> ∞ also collapses to ∞
      const eq2 = normalize(parseExpr('∞ -> ∞ = ∞ -> ∞ -> ∞'))
      const result2 = verify(eq2, s)
      expect(result2.success).toBe(true)

      // Transitivity should allow us to conclude ∞ = ∞ -> ∞ -> ∞
      // This follows from ∞ = (∞ -> ∞) and (∞ -> ∞) = (∞ -> ∞ -> ∞)
      expect(s.provenEqualities.length).toBeGreaterThan(1)
    })

    it('should track multiple equalities for transitivity chains', () => {
      const s = state()

      // Prove several equalities
      verify(normalize(parseExpr('aa = aa')), s)
      verify(normalize(parseExpr('bb = bb')), s)
      verify(normalize(parseExpr('cc = cc')), s)

      // State should track all proven equalities
      expect(s.provenEqualities.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Extended resolution - Congruence (A2)', () => {
    it('should apply congruence: if (a = c) and (b = d) then (a -> b) = (c -> d)', () => {
      const s = state()

      // With reflexivity, if a=a and b=b, then (a -> b) = (a -> b)
      const eq = normalize(parseExpr('a -> b = a -> b'))
      const result = verify(eq, s)
      expect(result.success).toBe(true)
    })

    it('should use congruence for link expressions with identical components', () => {
      const s = state()

      // First prove ∞ = ∞ -> ∞
      const eq1 = normalize(parseExpr('∞ = ∞ -> ∞'))
      verify(eq1, s)

      // Then congruence can be used to prove (∞ -> x) = ((∞ -> ∞) -> x)
      // where the left parts are equal due to A4
      const eq2 = normalize(parseExpr('(∞ -> x) = ((∞ -> ∞) -> x)'))
      const result = verify(eq2, s)
      expect(result.success).toBe(true)
    })

    it('should use congruence with proven equalities', () => {
      const s = state()

      // Prove ♂a = ♂a -> a (using A5)
      const eq1 = normalize(parseExpr('♂a = ♂a -> a'))
      const result1 = verify(eq1, s)
      expect(result1.success).toBe(true)

      // Now try to use congruence with this equality
      // (♂a -> b) should equal ((♂a -> a) -> b) if we can use congruence
      const eq2 = normalize(parseExpr('(♂a -> b) = ((♂a -> a) -> b)'))
      const result2 = verify(eq2, s)
      expect(result2.success).toBe(true)
    })
  })

  describe('ProvenEquality tracking', () => {
    it('should not duplicate equalities', () => {
      const s = state()

      // Prove the same equality twice
      verify(normalize(parseExpr('x = x')), s)
      const countAfterFirst = s.provenEqualities.length

      verify(normalize(parseExpr('x = x')), s)
      const countAfterSecond = s.provenEqualities.length

      // Should not have added a duplicate
      expect(countAfterSecond).toBe(countAfterFirst)
    })

    it('should not add symmetric version as duplicate', () => {
      const s = state()

      // Prove a = b
      verify(normalize(parseExpr('∞ = ∞ -> ∞')), s)
      const countAfterFirst = s.provenEqualities.length

      // Prove b = a (symmetric)
      verify(normalize(parseExpr('∞ -> ∞ = ∞')), s)
      const countAfterSecond = s.provenEqualities.length

      // Should recognize this as the same equality and not duplicate
      expect(countAfterSecond).toBe(countAfterFirst)
    })

    it('should preserve proven equalities across multiple verifications', () => {
      const s = state()

      // Prove several distinct equalities
      verify(normalize(parseExpr('∞ = ∞ -> ∞')), s)
      verify(normalize(parseExpr('♂v = ♂v -> v')), s)
      verify(normalize(parseExpr('r♀ = r -> r♀')), s)

      // All should be tracked
      expect(s.provenEqualities.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Modus Ponens', () => {
    it('should register Link expressions as implications', () => {
      const s = state()

      // Register an implication P -> Q
      const impl = normalize(parseExpr('a -> b'))
      const result = verify(impl, s)

      expect(result.success).toBe(true)
      expect(s.provenImplications.length).toBeGreaterThan(0)
    })

    it('should track proven facts', () => {
      const s = state()

      // Register a fact and an implication
      const fact = normalize(parseExpr('∞'))
      const impl = normalize(parseExpr('∞ -> ∞'))

      verify(fact, s)
      verify(impl, s)

      // Fact should be tracked
      expect(s.provenFacts.length).toBeGreaterThan(0)
    })

    it('should apply Modus Ponens to derive new facts', () => {
      const s = state()

      // Add fact P (represented as a simple expression)
      const factP = normalize(parseExpr('♂∞'))

      // Register the fact manually using addProvenFact
      addProvenFact(s, factP)

      // Register implication P -> Q (♂∞ -> ∞♀)
      const implPQ = normalize(parseExpr('♂∞ -> ∞♀')) as any
      addProvenImplication(s, factP, implPQ.right, 'test implication')

      // Apply Modus Ponens
      applyModusPonens(s)

      // Q should be derived
      const qStr = toCanonicalString(normalize(parseExpr('∞♀')))
      expect(s.facts.has(qStr)).toBe(true)
    })

    it('should use tryModusPonens to prove consequent', () => {
      const s = state()

      // Add fact P
      const factP = normalize(parseExpr('♂∞'))
      addProvenFact(s, factP)

      // Register implication P -> Q
      const factQ = normalize(parseExpr('∞♀'))
      addProvenImplication(s, factP, factQ, 'test')

      // Try to prove Q using MP
      const result = tryModusPonens(factQ, s)
      expect(result.found).toBe(true)
    })

    it('should handle chains of implications', () => {
      const s = state()

      // P
      const factP = normalize(parseExpr('♂∞'))
      addProvenFact(s, factP)

      // P -> Q
      const factQ = normalize(parseExpr('∞♀'))
      addProvenImplication(s, factP, factQ, 'P -> Q')

      // Q -> R
      const factR = normalize(parseExpr('∞'))
      addProvenImplication(s, factQ, factR, 'Q -> R')

      // Apply MP twice to derive R
      applyModusPonens(s) // First pass: P, P->Q ⊢ Q
      applyModusPonens(s) // Second pass: Q, Q->R ⊢ R

      // R should be derived
      const rStr = toCanonicalString(factR)
      expect(s.facts.has(rStr)).toBe(true)
    })

    it('should include MP axiom in proof steps for implications', () => {
      const s = state()

      // Add some facts first
      const factP = normalize(parseExpr('♂∞'))
      addProvenFact(s, factP)

      // Register P -> Q implication
      const factQ = normalize(parseExpr('∞♀'))
      addProvenImplication(s, factP, factQ, 'test')

      // Verify an implication
      const impl = normalize(parseExpr('♂∞ -> ∞♀'))
      const result = verify(impl, s)

      expect(result.success).toBe(true)
      expect(result.proofSteps).toBeDefined()
      expect(result.proofSteps!.length).toBeGreaterThan(0)
    })

    it('should track implications from Link expressions', () => {
      const s = state()

      // Verify a Link expression
      const link = normalize(parseExpr('a -> b'))
      verify(link, s)

      // Check that implication is tracked
      expect(s.provenImplications.length).toBeGreaterThan(0)
      const impl = s.provenImplications[0]
      expect(impl.antecedent.type).toBe('Identifier')
      expect(impl.consequent.type).toBe('Identifier')
    })

    it('should not duplicate implications', () => {
      const s = state()

      // Verify the same Link expression twice
      const link1 = normalize(parseExpr('a -> b'))
      const link2 = normalize(parseExpr('a -> b'))

      verify(link1, s)
      const countAfterFirst = s.provenImplications.length

      verify(link2, s)
      const countAfterSecond = s.provenImplications.length

      // Should not duplicate
      expect(countAfterSecond).toBe(countAfterFirst)
    })

    it('should work with complex expressions', () => {
      const s = state()

      // Register complex implication
      const impl = normalize(parseExpr('(♂∞ -> ∞♀) -> (∞ -> ∞)'))
      verify(impl, s)

      // Implication should be tracked
      expect(s.provenImplications.length).toBeGreaterThan(0)
    })

    it('should derive facts from verified implications', () => {
      const s = state()

      // First establish P as a fact
      const factP = normalize(parseExpr('♂∞'))
      addProvenFact(s, factP)

      // Then verify the implication P -> Q
      const impl = normalize(parseExpr('♂∞ -> ∞♀'))
      const result = verify(impl, s)

      expect(result.success).toBe(true)

      // Check if MP was applied (if not immediately, check derived facts)
      const qStr = toCanonicalString(normalize(parseExpr('∞♀')))
      expect(s.facts.has(qStr)).toBe(true)
    })
  })
})
