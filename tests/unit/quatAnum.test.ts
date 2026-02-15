/**
 * Unit tests for quaternary anumbers (abits) parser (МТС)
 */

import { describe, it, expect } from 'vitest'
import {
  isValidAbit,
  validateQuatAnum,
  cleanQuatAnum,
  parseAbitToAST,
  quatAnumToFormal,
  quatAnumToStringAnum,
  parseQuatAnumLine,
  parseQuatAnum,
  parseQuatAnumExpr,
  toQuatAnum,
  isQuatAnumExpr,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  isQuatAnumContent,
  QuatAnumError,
  ABIT_DEFINITIONS,
  VALID_ABITS,
} from '../../src/core/quatAnum'
import type { LinkExpr, InfinityExpr, CharLitExpr } from '../../src/core/ast'

describe('QuatAnum Core Functions', () => {
  describe('isValidAbit', () => {
    it('should return true for valid abits', () => {
      expect(isValidAbit('0')).toBe(true)
      expect(isValidAbit('1')).toBe(true)
      expect(isValidAbit('[')).toBe(true)
      expect(isValidAbit(']')).toBe(true)
    })

    it('should return false for invalid characters', () => {
      expect(isValidAbit('a')).toBe(false)
      expect(isValidAbit('2')).toBe(false)
      expect(isValidAbit('(')).toBe(false)
      expect(isValidAbit('∞')).toBe(false)
      expect(isValidAbit(' ')).toBe(false)
    })
  })

  describe('validateQuatAnum', () => {
    it('should validate empty content', () => {
      const result = validateQuatAnum('')
      expect(result.valid).toBe(true)
    })

    it('should validate simple abit sequences', () => {
      expect(validateQuatAnum('0101').valid).toBe(true)
      expect(validateQuatAnum('[]').valid).toBe(true)
      expect(validateQuatAnum('[01]').valid).toBe(true)
    })

    it('should validate nested brackets', () => {
      expect(validateQuatAnum('[[]]').valid).toBe(true)
      expect(validateQuatAnum('[0[1]0]').valid).toBe(true)
      expect(validateQuatAnum('01[00[11]01]10').valid).toBe(true)
    })

    it('should reject invalid characters', () => {
      const result = validateQuatAnum('01a10')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid character')
      expect(result.errorOffset).toBe(2)
    })

    it('should reject unmatched opening bracket', () => {
      const result = validateQuatAnum('[01')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unmatched opening bracket')
    })

    it('should reject unmatched closing bracket', () => {
      const result = validateQuatAnum('01]')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unmatched closing bracket')
    })

    it('should ignore whitespace', () => {
      expect(validateQuatAnum('0 1 0 1').valid).toBe(true)
      expect(validateQuatAnum('[ 0 1 ]').valid).toBe(true)
      expect(validateQuatAnum('0\n1\n0\n1').valid).toBe(true)
    })

    it('should ignore comments', () => {
      expect(validateQuatAnum('01 // comment\n01').valid).toBe(true)
      expect(validateQuatAnum('// full comment line\n01').valid).toBe(true)
    })
  })

  describe('cleanQuatAnum', () => {
    it('should remove whitespace', () => {
      expect(cleanQuatAnum('0 1 0 1')).toBe('0101')
      expect(cleanQuatAnum('[ 0 1 ]')).toBe('[01]')
      expect(cleanQuatAnum('\t0\t1\t')).toBe('01')
    })

    it('should remove comments', () => {
      expect(cleanQuatAnum('01 // comment')).toBe('01')
      expect(cleanQuatAnum('// comment\n01')).toBe('01')
    })

    it('should handle multiple lines', () => {
      expect(cleanQuatAnum('01\n10')).toBe('0110')
    })

    it('should preserve abit characters only', () => {
      expect(cleanQuatAnum('0[1]')).toBe('0[1]')
    })
  })

  describe('ABIT_DEFINITIONS', () => {
    it('should have correct formal definitions', () => {
      expect(ABIT_DEFINITIONS['[']).toBe('♂∞')
      expect(ABIT_DEFINITIONS[']']).toBe('∞♀')
      expect(ABIT_DEFINITIONS['1']).toBe('(♂∞ -> ∞♀)')
      expect(ABIT_DEFINITIONS['0']).toBe('(∞♀ -> ♂∞)')
    })
  })

  describe('VALID_ABITS', () => {
    it('should contain exactly 4 abits', () => {
      expect(VALID_ABITS).toHaveLength(4)
      expect(VALID_ABITS).toContain('0')
      expect(VALID_ABITS).toContain('1')
      expect(VALID_ABITS).toContain('[')
      expect(VALID_ABITS).toContain(']')
    })
  })
})

describe('QuatAnum AST Parsing', () => {
  describe('parseAbitToAST', () => {
    it('should parse [ to Male(Infinity)', () => {
      const ast = parseAbitToAST('[')
      expect(ast.type).toBe('Male')
      expect((ast as { operand: { type: string } }).operand.type).toBe('Infinity')
    })

    it('should parse ] to Female(Infinity)', () => {
      const ast = parseAbitToAST(']')
      expect(ast.type).toBe('Female')
      expect((ast as { operand: { type: string } }).operand.type).toBe('Infinity')
    })

    it('should parse 1 to Link(Male(∞), Female(∞))', () => {
      const ast = parseAbitToAST('1')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Male')
      expect(link.right.type).toBe('Female')
    })

    it('should parse 0 to Link(Female(∞), Male(∞))', () => {
      const ast = parseAbitToAST('0')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Female')
      expect(link.right.type).toBe('Male')
    })
  })

  describe('parseQuatAnumLine', () => {
    it('should parse empty string to infinity', () => {
      const ast = parseQuatAnumLine('')
      expect(ast.type).toBe('Infinity')
    })

    it('should parse single abit', () => {
      const ast = parseQuatAnumLine('0')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('CharLit')
      expect((link.right as CharLitExpr).char).toBe('0')
    })

    it('should parse abit sequence as left-associative chain', () => {
      const ast = parseQuatAnumLine('01')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      // Right should be '1'
      expect(link.right.type).toBe('CharLit')
      expect((link.right as CharLitExpr).char).toBe('1')
      // Left should be (∞ -> '0')
      expect(link.left.type).toBe('Link')
    })

    it('should handle brackets in sequence', () => {
      const ast = parseQuatAnumLine('[]')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect((link.right as CharLitExpr).char).toBe(']')
    })
  })

  describe('parseQuatAnum', () => {
    it('should parse empty content', () => {
      const file = parseQuatAnum('')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(0)
    })

    it('should parse single line', () => {
      const file = parseQuatAnum('0101')
      expect(file.statements.length).toBe(1)
      expect(file.statements[0].type).toBe('Statement')
    })

    it('should parse multiple lines as separate statements', () => {
      const file = parseQuatAnum('01\n10')
      expect(file.statements.length).toBe(2)
    })

    it('should skip empty lines by default', () => {
      const file = parseQuatAnum('01\n\n10')
      expect(file.statements.length).toBe(2)
    })

    it('should skip comment lines by default', () => {
      const file = parseQuatAnum('// comment\n01')
      expect(file.statements.length).toBe(1)
    })

    it('should throw on invalid content in strict mode', () => {
      expect(() => parseQuatAnum('[01', { strictBrackets: true })).toThrow(QuatAnumError)
    })
  })

  describe('parseQuatAnumExpr', () => {
    it('should parse entire content as single expression', () => {
      const ast = parseQuatAnumExpr('0101')
      expect(ast.type).toBe('Link')
    })

    it('should throw on invalid content', () => {
      expect(() => parseQuatAnumExpr('[01')).toThrow(QuatAnumError)
    })
  })
})

describe('QuatAnum Conversion', () => {
  describe('quatAnumToFormal', () => {
    it('should convert empty to ∞', () => {
      expect(quatAnumToFormal('')).toBe('∞')
    })

    it('should convert single abits', () => {
      expect(quatAnumToFormal('[')).toBe('(∞ -> ♂∞)')
      expect(quatAnumToFormal(']')).toBe('(∞ -> ∞♀)')
      expect(quatAnumToFormal('1')).toBe('(∞ -> (♂∞ -> ∞♀))')
      expect(quatAnumToFormal('0')).toBe('(∞ -> (∞♀ -> ♂∞))')
    })

    it('should convert abit sequences', () => {
      expect(quatAnumToFormal('01')).toBe('((∞ -> (∞♀ -> ♂∞)) -> (♂∞ -> ∞♀))')
      expect(quatAnumToFormal('[]')).toBe('((∞ -> ♂∞) -> ∞♀)')
    })

    it('should ignore whitespace', () => {
      expect(quatAnumToFormal('0 1')).toBe('((∞ -> (∞♀ -> ♂∞)) -> (♂∞ -> ∞♀))')
    })
  })

  describe('quatAnumToStringAnum', () => {
    it('should clean and return as string', () => {
      expect(quatAnumToStringAnum('0101')).toBe('0101')
      expect(quatAnumToStringAnum('0 1 0 1')).toBe('0101')
      expect(quatAnumToStringAnum('[01]')).toBe('[01]')
    })
  })

  describe('toQuatAnum', () => {
    it('should convert infinity to empty string', () => {
      const ast: InfinityExpr = { type: 'Infinity' }
      expect(toQuatAnum(ast)).toBe('')
    })

    it('should convert abit chain to string', () => {
      const ast = parseQuatAnumLine('01')
      expect(toQuatAnum(ast)).toBe('01')
    })

    it('should return null for non-quaternary AST', () => {
      const ast = { type: 'Num', value: 0 }
      expect(toQuatAnum(ast)).toBeNull()
    })

    it('should return null if non-abit characters present', () => {
      // Create AST with non-abit character
      const ast = {
        type: 'Link',
        left: { type: 'Infinity' },
        right: { type: 'CharLit', char: 'a' },
      }
      expect(toQuatAnum(ast)).toBeNull()
    })

    it('should handle round-trip', () => {
      const original = '01[10]01'
      const ast = parseQuatAnumLine(original)
      expect(toQuatAnum(ast)).toBe(original)
    })
  })

  describe('isQuatAnumExpr', () => {
    it('should return true for valid quaternary anumber', () => {
      const ast = parseQuatAnumLine('0101')
      expect(isQuatAnumExpr(ast)).toBe(true)
    })

    it('should return true for empty (infinity)', () => {
      const ast = parseQuatAnumLine('')
      expect(isQuatAnumExpr(ast)).toBe(true)
    })

    it('should return false for non-quaternary AST', () => {
      const ast = {
        type: 'Equality',
        left: { type: 'Num', value: 1 },
        right: { type: 'Num', value: 1 },
      }
      expect(isQuatAnumExpr(ast)).toBe(false)
    })
  })
})

describe('QuatAnum File Operations', () => {
  describe('quatAnumFileToMtl', () => {
    it('should convert simple file', () => {
      const result = quatAnumFileToMtl('01')
      expect(result).toContain('// Generated from .anum file')
      expect(result).toContain('((∞ -> (∞♀ -> ♂∞)) -> (♂∞ -> ∞♀)).')
    })

    it('should preserve comments', () => {
      const result = quatAnumFileToMtl('// my comment\n01')
      expect(result).toContain('// my comment')
    })

    it('should add abit legend in header', () => {
      const result = quatAnumFileToMtl('01')
      expect(result).toContain('Abits:')
      expect(result).toContain('♂∞')
    })

    it('should handle multiple lines', () => {
      const result = quatAnumFileToMtl('01\n10')
      expect(result).toContain('((∞ -> (∞♀ -> ♂∞)) -> (♂∞ -> ∞♀)).')
      expect(result).toContain('((∞ -> (♂∞ -> ∞♀)) -> (∞♀ -> ♂∞)).')
    })
  })

  describe('isQuatAnumContent', () => {
    it('should return true for valid content', () => {
      expect(isQuatAnumContent('0101')).toBe(true)
      expect(isQuatAnumContent('[01]')).toBe(true)
      expect(isQuatAnumContent('')).toBe(true)
    })

    it('should return false for invalid content', () => {
      expect(isQuatAnumContent('abc')).toBe(false)
      expect(isQuatAnumContent('[01')).toBe(false)
    })
  })
})

describe('QuatAnum Visualization', () => {
  describe('visualizeQuatConversion', () => {
    it('should show infinity for empty sequence', () => {
      const steps = visualizeQuatConversion('')
      expect(steps.length).toBe(1)
      expect(steps[0].formal).toBe('∞')
    })

    it('should show all steps for conversion', () => {
      const steps = visualizeQuatConversion('01')
      expect(steps.length).toBe(3) // initial (∞) + 2 abits
      expect(steps[0].formal).toBe('∞')
      expect(steps[1].abit).toBe('0')
      expect(steps[1].definition).toBe('(∞♀ -> ♂∞)')
      expect(steps[2].abit).toBe('1')
      expect(steps[2].definition).toBe('(♂∞ -> ∞♀)')
    })

    it('should include step descriptions', () => {
      const steps = visualizeQuatConversion('0')
      expect(steps[0].description).toContain('akorern')
      expect(steps[1].description).toContain('zero')
    })

    it('should handle all abit types', () => {
      const steps = visualizeQuatConversion('01[]')
      expect(steps[1].description).toContain('zero')
      expect(steps[2].description).toContain('one')
      expect(steps[3].description).toContain('opening bracket')
      expect(steps[4].description).toContain('closing bracket')
    })
  })
})

describe('QuatAnum Statistics', () => {
  describe('getQuatAnumStats', () => {
    it('should count abits correctly', () => {
      const stats = getQuatAnumStats('0011')
      expect(stats.abitCount).toBe(4)
    })

    it('should count each abit type', () => {
      const stats = getQuatAnumStats('01[]')
      expect(stats.abitCounts['0']).toBe(1)
      expect(stats.abitCounts['1']).toBe(1)
      expect(stats.abitCounts['[']).toBe(1)
      expect(stats.abitCounts[']']).toBe(1)
    })

    it('should calculate link count', () => {
      const stats = getQuatAnumStats('0101')
      expect(stats.linkCount).toBe(4)
    })

    it('should calculate max depth', () => {
      const stats = getQuatAnumStats('0[1[0]1]0')
      expect(stats.maxDepth).toBe(2)
    })

    it('should check balance', () => {
      expect(getQuatAnumStats('[]').balanced).toBe(true)
      expect(getQuatAnumStats('[[]]').balanced).toBe(true)
      expect(getQuatAnumStats('[').balanced).toBe(false)
    })

    it('should handle empty content', () => {
      const stats = getQuatAnumStats('')
      expect(stats.abitCount).toBe(0)
      expect(stats.balanced).toBe(true)
    })

    it('should ignore whitespace and comments', () => {
      const stats = getQuatAnumStats('0 1 // comment\n0 1')
      expect(stats.abitCount).toBe(4)
    })
  })
})

describe('QuatAnum Integration', () => {
  it('should correctly model МТС abit definitions', () => {
    // From docs: [ = ♂∞, ] = ∞♀, 1 = ♂∞ -> ∞♀, 0 = ∞♀ -> ♂∞
    expect(quatAnumToFormal('[')).toContain('♂∞')
    expect(quatAnumToFormal(']')).toContain('∞♀')
    expect(quatAnumToFormal('1')).toContain('♂∞ -> ∞♀')
    expect(quatAnumToFormal('0')).toContain('∞♀ -> ♂∞')
  })

  it('should handle the example from specification', () => {
    // From spec: 01010001[010100[1001]010]...
    const content = '01010001[010100[1001]010]'
    const validation = validateQuatAnum(content)
    expect(validation.valid).toBe(true)

    const stats = getQuatAnumStats(content)
    expect(stats.maxDepth).toBe(2)
    expect(stats.balanced).toBe(true)
  })

  it('should round-trip arbitrary abit sequences', () => {
    const testSequences = ['', '0', '1', '[]', '0101', '[01]', '[[]]', '0[1[0]1]0']

    for (const seq of testSequences) {
      const ast = parseQuatAnumExpr(seq)
      const recovered = toQuatAnum(ast)
      expect(recovered).toBe(cleanQuatAnum(seq))
    }
  })

  it('should properly nest contexts', () => {
    const content = '[0[1]0]'
    const stats = getQuatAnumStats(content)
    expect(stats.maxDepth).toBe(2)
    expect(stats.balanced).toBe(true)
  })
})

describe('QuatAnum Error Handling', () => {
  describe('QuatAnumError', () => {
    it('should contain offset information', () => {
      const error = new QuatAnumError('test error', 5, 'x')
      expect(error.offset).toBe(5)
      expect(error.char).toBe('x')
      expect(error.message).toContain('position 5')
    })
  })

  it('should provide helpful error messages for common mistakes', () => {
    // Unmatched brackets
    const result1 = validateQuatAnum('[01')
    expect(result1.error).toContain('Unmatched')

    // Invalid character
    const result2 = validateQuatAnum('012')
    expect(result2.error).toContain('Invalid character')
    expect(result2.error).toContain("'2'")
  })
})
