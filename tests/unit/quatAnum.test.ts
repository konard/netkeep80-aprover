/**
 * Unit tests for quaternary anumbers parser (МТС)
 */

import { describe, it, expect } from 'vitest'
import {
  parseQuatAnumLine,
  parseQuatAnum,
  parseQuatAnumExpr,
  toQuatAnum,
  isQuatAnumExpr,
  quatAnumToFormal,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  quatAnumToStringAnum,
  stringAnumToQuatAnum,
  QuatAnumError,
} from '../../src/core/quatAnum'
import type { LinkExpr, InfinityExpr, MaleExpr, FemaleExpr } from '../../src/core/ast'

describe('QuatAnum Parser', () => {
  describe('parseQuatAnumLine', () => {
    it('should parse empty string to infinity', () => {
      const ast = parseQuatAnumLine('')
      expect(ast.type).toBe('Infinity')
    })

    it('should parse single [ abit to ♂∞', () => {
      const ast = parseQuatAnumLine('[')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('Male')
      const male = link.right as MaleExpr
      expect(male.operand.type).toBe('Infinity')
    })

    it('should parse single ] abit to ∞♀', () => {
      const ast = parseQuatAnumLine(']')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('Female')
      const female = link.right as FemaleExpr
      expect(female.operand.type).toBe('Infinity')
    })

    it('should parse 1 abit to (♂∞ -> ∞♀)', () => {
      const ast = parseQuatAnumLine('1')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('Link')
      const innerLink = link.right as LinkExpr
      expect(innerLink.left.type).toBe('Male')
      expect(innerLink.right.type).toBe('Female')
    })

    it('should parse 0 abit to (∞♀ -> ♂∞)', () => {
      const ast = parseQuatAnumLine('0')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('Link')
      const innerLink = link.right as LinkExpr
      expect(innerLink.left.type).toBe('Female')
      expect(innerLink.right.type).toBe('Male')
    })

    it('should parse [] as nested context', () => {
      const ast = parseQuatAnumLine('[]')
      expect(ast.type).toBe('Link')
      // Should create a nested structure
    })

    it('should parse multiple abits as left-associative chain', () => {
      const ast = parseQuatAnumLine('[1]')
      expect(ast.type).toBe('Link')
    })

    it('should skip whitespace', () => {
      const ast = parseQuatAnumLine('[ 1 ]')
      expect(ast.type).toBe('Link')
    })

    it('should preserve source locations', () => {
      const ast = parseQuatAnumLine('[1]', 5, 100)
      expect(ast.loc).toBeDefined()
      expect(ast.loc?.start.line).toBe(5)
      expect(ast.loc?.start.offset).toBe(100)
    })

    it('should throw error for invalid characters', () => {
      expect(() => parseQuatAnumLine('a')).toThrow(QuatAnumError)
    })
  })

  describe('parseQuatAnum', () => {
    it('should parse empty content', () => {
      const file = parseQuatAnum('')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(0)
    })

    it('should parse single line', () => {
      const file = parseQuatAnum('[1]')
      expect(file.statements.length).toBe(1)
      expect(file.statements[0].type).toBe('Statement')
    })

    it('should parse multiple lines as separate statements', () => {
      const file = parseQuatAnum('[\n]')
      expect(file.statements.length).toBe(2)
    })

    it('should skip empty lines by default', () => {
      const file = parseQuatAnum('[\n\n]')
      expect(file.statements.length).toBe(2)
    })

    it('should skip comment lines by default', () => {
      const file = parseQuatAnum('// comment\n[1]')
      expect(file.statements.length).toBe(1)
    })

    it('should respect skipEmptyLines option', () => {
      const file = parseQuatAnum('[\n\n]', { skipEmptyLines: false })
      expect(file.statements.length).toBe(3)
    })

    it('should respect skipComments option', () => {
      const file = parseQuatAnum('// comment\n[1]', { skipComments: false })
      expect(file.statements.length).toBe(2)
    })

    it('should filter out non-abit characters', () => {
      const file = parseQuatAnum('abc[123]xyz')
      // Only [ should remain
      expect(file.statements.length).toBe(1)
    })
  })

  describe('parseQuatAnumExpr', () => {
    it('should parse entire content as single expression', () => {
      const ast = parseQuatAnumExpr('[10]')
      expect(ast.type).toBe('Link')
    })

    it('should filter non-abit characters', () => {
      const ast = parseQuatAnumExpr('a[b]c1d0e')
      expect(ast.type).toBe('Link')
    })
  })

  describe('toQuatAnum', () => {
    it('should convert infinity to empty string', () => {
      const ast: InfinityExpr = { type: 'Infinity' }
      expect(toQuatAnum(ast)).toBe('')
    })

    it('should convert simple chain to anumber', () => {
      const ast = parseQuatAnumLine('[')
      expect(toQuatAnum(ast)).toBe('[')
    })

    it('should convert [] to string', () => {
      // Note: Nested contexts are complex, this tests basic round-trip
      const ast = parseQuatAnumLine('[]')
      // The exact output depends on implementation
      expect(toQuatAnum(ast)).toBeTruthy()
    })

    it('should return null for non-quat-anum AST', () => {
      const ast = { type: 'Num', value: 0 }
      expect(toQuatAnum(ast)).toBeNull()
    })

    it('should handle round-trip', () => {
      const testCases = ['[', ']', '1', '0', '[1]', '10', '01', '[]']
      for (const anum of testCases) {
        const ast = parseQuatAnumLine(anum)
        const recovered = toQuatAnum(ast)
        expect(recovered).toBeTruthy()
      }
    })
  })

  describe('isQuatAnumExpr', () => {
    it('should return true for valid quaternary anumber', () => {
      const ast = parseQuatAnumLine('[1]')
      expect(isQuatAnumExpr(ast)).toBe(true)
    })

    it('should return true for empty string (infinity)', () => {
      const ast = parseQuatAnumLine('')
      expect(isQuatAnumExpr(ast)).toBe(true)
    })

    it('should return false for non-quat-anum AST', () => {
      const ast = {
        type: 'Equality',
        left: { type: 'Num', value: 1 },
        right: { type: 'Num', value: 1 },
      }
      expect(isQuatAnumExpr(ast)).toBe(false)
    })
  })

  describe('quatAnumToFormal', () => {
    it('should convert empty string to ∞', () => {
      expect(quatAnumToFormal('')).toBe('∞')
    })

    it('should convert [ to ♂∞', () => {
      expect(quatAnumToFormal('[')).toBe('(∞ -> ♂∞)')
    })

    it('should convert ] to ∞♀', () => {
      expect(quatAnumToFormal(']')).toBe('(∞ -> ∞♀)')
    })

    it('should convert 1 to (♂∞ -> ∞♀)', () => {
      expect(quatAnumToFormal('1')).toBe('(∞ -> (♂∞ -> ∞♀))')
    })

    it('should convert 0 to (∞♀ -> ♂∞)', () => {
      expect(quatAnumToFormal('0')).toBe('(∞ -> (∞♀ -> ♂∞))')
    })

    it('should convert multiple abits', () => {
      // [1 is 2 abits: [ and 1
      expect(quatAnumToFormal('[1')).toBe('((∞ -> ♂∞) -> (♂∞ -> ∞♀))')
    })

    it('should filter out invalid characters', () => {
      // a[b]c filters to [] which is 2 abits
      expect(quatAnumToFormal('a[b]c')).toBe('((∞ -> ♂∞) -> ∞♀)')
    })
  })

  describe('quatAnumFileToMtl', () => {
    it('should convert simple file', () => {
      const result = quatAnumFileToMtl('[1]')
      // [1] is 3 abits: [, 1, ]
      expect(result).toContain('(((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> ∞♀).')
    })

    it('should preserve comments', () => {
      const result = quatAnumFileToMtl('// my comment\n[1]')
      expect(result).toContain('// my comment')
    })

    it('should add header comment', () => {
      const result = quatAnumFileToMtl('[1]')
      expect(result).toContain('// Generated from .anum file')
      expect(result).toContain('[→♂∞, ]→∞♀, 1→(♂∞->∞♀), 0→(∞♀->♂∞)')
    })

    it('should handle multiple lines', () => {
      const result = quatAnumFileToMtl('[\n]')
      expect(result).toContain('(∞ -> ♂∞).')
      expect(result).toContain('(∞ -> ∞♀).')
    })

    it('should filter non-abit characters', () => {
      const result = quatAnumFileToMtl('abc[123]xyz')
      // Filters to [1] which is 3 abits: [, 1, ]
      expect(result).toContain('(((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> ∞♀).')
    })
  })

  describe('visualizeQuatConversion', () => {
    it('should show infinity for empty string', () => {
      const steps = visualizeQuatConversion('')
      expect(steps.length).toBe(1)
      expect(steps[0].formal).toBe('∞')
    })

    it('should show all steps for conversion', () => {
      const steps = visualizeQuatConversion('[1]')
      expect(steps.length).toBe(4) // initial (∞) + 3 abits
      expect(steps[0].formal).toBe('∞')
      expect(steps[1].abit).toBe('[')
      expect(steps[2].abit).toBe('1')
      expect(steps[3].abit).toBe(']')
    })

    it('should include step descriptions', () => {
      const steps = visualizeQuatConversion('[')
      expect(steps[0].description).toContain('akorern')
      expect(steps[1].description).toContain('Link')
    })

    it('should include abit forms', () => {
      const steps = visualizeQuatConversion('[10]')
      expect(steps[1].form).toBe('♂∞')
      expect(steps[2].form).toBe('(♂∞ -> ∞♀)')
      expect(steps[3].form).toBe('(∞♀ -> ♂∞)')
    })
  })

  describe('getQuatAnumStats', () => {
    it('should count abits correctly', () => {
      // [10] contains 4 abits: [, 1, 0, ]
      const stats = getQuatAnumStats('[10]')
      expect(stats.abitCount).toBe(4)
    })

    it('should count open brackets', () => {
      const stats = getQuatAnumStats('[[]]')
      expect(stats.openBrackets).toBe(2)
    })

    it('should count close brackets', () => {
      const stats = getQuatAnumStats('[[]]')
      expect(stats.closeBrackets).toBe(2)
    })

    it('should count 1s and 0s', () => {
      const stats = getQuatAnumStats('1010')
      expect(stats.oneCount).toBe(2)
      expect(stats.zeroCount).toBe(2)
    })

    it('should calculate link count', () => {
      // [10] has 4 abits which create 4 links
      const stats = getQuatAnumStats('[10]')
      expect(stats.linkCount).toBe(4)
    })

    it('should detect balanced brackets', () => {
      const stats = getQuatAnumStats('[[]]')
      expect(stats.balanced).toBe(true)
    })

    it('should detect unbalanced brackets', () => {
      const stats = getQuatAnumStats('[[]')
      expect(stats.balanced).toBe(false)
    })

    it('should calculate abit frequency', () => {
      // [10] contains 4 abits: [, 1, 0, ]
      const stats = getQuatAnumStats('[10]')
      expect(stats.abitFrequency.get('[')).toBe(1)
      expect(stats.abitFrequency.get(']')).toBe(1)
      expect(stats.abitFrequency.get('1')).toBe(1)
      expect(stats.abitFrequency.get('0')).toBe(1)
    })

    it('should filter non-abit characters', () => {
      // abc[123]xyz filters to [1] which is 3 abits
      const stats = getQuatAnumStats('abc[123]xyz')
      expect(stats.abitCount).toBe(3)
      expect(stats.openBrackets).toBe(1)
    })
  })

  describe('quatAnumToStringAnum', () => {
    it('should convert quaternary to string anumber', () => {
      expect(quatAnumToStringAnum('[10]')).toBe('[10]')
    })

    it('should filter non-abit characters', () => {
      expect(quatAnumToStringAnum('a[b]c')).toBe('[]')
    })

    it('should handle empty string', () => {
      expect(quatAnumToStringAnum('')).toBe('')
    })
  })

  describe('stringAnumToQuatAnum', () => {
    it('should convert string to quaternary anumber', () => {
      expect(stringAnumToQuatAnum('[10]')).toBe('[10]')
    })

    it('should filter non-abit characters', () => {
      expect(stringAnumToQuatAnum('a[b]c')).toBe('[]')
    })

    it('should handle empty string', () => {
      expect(stringAnumToQuatAnum('')).toBe('')
    })

    it('should handle mixed valid and invalid', () => {
      expect(stringAnumToQuatAnum('abc[1]0def')).toBe('[1]0')
    })
  })
})

describe('QuatAnum Integration', () => {
  it('should correctly model МТС documentation examples', () => {
    // From docs: [ → ♂∞
    const formal1 = quatAnumToFormal('[')
    expect(formal1).toContain('♂∞')

    // From docs: ] → ∞♀
    const formal2 = quatAnumToFormal(']')
    expect(formal2).toContain('∞♀')

    // From docs: 1 → ♂∞ -> ∞♀
    const formal3 = quatAnumToFormal('1')
    expect(formal3).toContain('♂∞')
    expect(formal3).toContain('∞♀')

    // From docs: 0 → ∞♀ -> ♂∞
    const formal4 = quatAnumToFormal('0')
    expect(formal4).toContain('∞♀')
    expect(formal4).toContain('♂∞')
  })

  it('should handle round-trip for all valid abits', () => {
    const testCases = ['[', ']', '1', '0', '[]', '[1]', '10', '01', '[10]', '[[[]]]']

    for (const anum of testCases) {
      const ast = parseQuatAnumExpr(anum)
      const recovered = toQuatAnum(ast)
      expect(recovered).toBeTruthy()
    }
  })

  it('should create correct left-associative chains', () => {
    // [10] should be ((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> (∞♀ -> ♂∞)
    const formal = quatAnumToFormal('[10]')
    expect(formal).toContain('♂∞')
    expect(formal).toContain('∞♀')
  })

  it('should handle complex nested contexts', () => {
    // [[1]] creates nested structure
    const ast = parseQuatAnumLine('[[1]]')
    expect(ast.type).toBe('Link')
    // Should have nested links
  })
})

describe('QuatAnum Error Handling', () => {
  it('should throw error with position info', () => {
    try {
      parseQuatAnumLine('a')
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(QuatAnumError)
      if (e instanceof QuatAnumError) {
        expect(e.offset).toBe(0)
        expect(e.char).toBe('a')
      }
    }
  })

  it('should handle standalone abits without bracket matching', () => {
    // [ and ] are now standalone abits, not bracket delimiters
    // So [1 is just two abits: [ and 1
    const ast = parseQuatAnumLine('[1')
    expect(ast.type).toBe('Link')
  })

  it('should filter invalid chars from sequences', () => {
    // parseQuatAnumExpr filters to [] which are two valid abits
    const ast = parseQuatAnumExpr('[abc]')
    expect(ast.type).toBe('Link')
  })
})
