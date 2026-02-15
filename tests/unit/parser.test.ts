/**
 * Unit tests for МТС parser
 */

import { describe, it, expect } from 'vitest'
import { parse, parseExpr, parseWithRecovery, ParseError } from '../../src/core/parser'

describe('Parser', () => {
  describe('Basic expressions', () => {
    it('should parse infinity', () => {
      const ast = parseExpr('∞')
      expect(ast.type).toBe('Infinity')
    })

    it('should parse numeric constants', () => {
      expect(parseExpr('0').type).toBe('Num')
      expect(parseExpr('1').type).toBe('Num')
    })

    it('should parse identifiers', () => {
      const ast = parseExpr('x')
      expect(ast.type).toBe('Identifier')
      expect((ast as any).name).toBe('x')
    })

    it('should parse character literals (single quotes for quaternary abits)', () => {
      const ast = parseExpr("'a'")
      expect(ast.type).toBe('CharLit')
      expect((ast as any).char).toBe('a')
    })

    it('should parse string literals (double quotes for string anums)', () => {
      const ast = parseExpr('"hello"')
      expect(ast.type).toBe('StringLit')
      expect((ast as any).value).toBe('hello')
    })

    it('should parse empty string literal', () => {
      const ast = parseExpr('""')
      expect(ast.type).toBe('StringLit')
      expect((ast as any).value).toBe('')
    })

    it('should parse string literal with UTF-8 characters', () => {
      const ast = parseExpr('"связь"')
      expect(ast.type).toBe('StringLit')
      expect((ast as any).value).toBe('связь')
    })

    it('should parse string literal in expression context', () => {
      const ast = parseExpr('"hello" -> "world"')
      expect(ast.type).toBe('Link')
      expect((ast as any).left.type).toBe('StringLit')
      expect((ast as any).right.type).toBe('StringLit')
    })

    it('should parse brackets', () => {
      expect(parseExpr('[').type).toBe('Bracket')
      expect(parseExpr(']').type).toBe('Bracket')
    })
  })

  describe('Link expressions', () => {
    it('should parse simple link', () => {
      const ast = parseExpr('a -> b')
      expect(ast.type).toBe('Link')
      expect((ast as any).left.type).toBe('Identifier')
      expect((ast as any).right.type).toBe('Identifier')
    })

    it('should parse left-associative chains', () => {
      const ast = parseExpr('a -> b -> c')
      expect(ast.type).toBe('Link')
      // Should be ((a -> b) -> c)
      expect((ast as any).left.type).toBe('Link')
      expect((ast as any).right.type).toBe('Identifier')
    })

    it('should parse not-link', () => {
      const ast = parseExpr('a !-> b')
      expect(ast.type).toBe('NotLink')
    })
  })

  describe('Prefix operators', () => {
    it('should parse male prefix', () => {
      const ast = parseExpr('♂x')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested male', () => {
      const ast = parseExpr('♂♂x')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Male')
    })

    it('should parse not prefix', () => {
      const ast = parseExpr('!x')
      expect(ast.type).toBe('Not')
    })

    it('should parse combined prefixes', () => {
      const ast = parseExpr('!♂x')
      expect(ast.type).toBe('Not')
      expect((ast as any).operand.type).toBe('Male')
    })
  })

  describe('Postfix operators', () => {
    it('should parse female postfix', () => {
      const ast = parseExpr('x♀')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested female', () => {
      const ast = parseExpr('x♀♀')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Female')
    })

    it('should parse power', () => {
      const ast = parseExpr('a^2')
      expect(ast.type).toBe('Power')
      expect((ast as any).exponent).toBe(2)
    })
  })

  describe('Definitions and equalities', () => {
    it('should parse definition', () => {
      const ast = parseExpr('∞ : ∞ -> ∞')
      expect(ast.type).toBe('Definition')
    })

    it('should parse equality', () => {
      const ast = parseExpr('a = b')
      expect(ast.type).toBe('Equality')
    })

    it('should parse inequality', () => {
      const ast = parseExpr('a != b')
      expect(ast.type).toBe('Inequality')
    })
  })

  describe('Sets', () => {
    it('should parse empty-ish set', () => {
      // Note: our grammar requires at least one element
      const ast = parseExpr('{ a }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(1)
    })

    it('should parse multi-element set', () => {
      const ast = parseExpr('{ a, b, c }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(3)
    })
  })

  describe('Parentheses', () => {
    it('should parse parenthesized expression', () => {
      const ast = parseExpr('(a)')
      expect(ast.type).toBe('Identifier')
    })

    it('should override associativity', () => {
      const ast = parseExpr('a -> (b -> c)')
      expect(ast.type).toBe('Link')
      // Right side should be a link, not identifier
      expect((ast as any).right.type).toBe('Link')
    })
  })

  describe('Complex expressions', () => {
    it('should parse МТС axioms', () => {
      // А4: ∞ : (∞ -> ∞)
      const ast1 = parseExpr('∞ : (∞ -> ∞)')
      expect(ast1.type).toBe('Definition')

      // А5: ♂x : (♂x -> x)
      const ast2 = parseExpr('♂x : (♂x -> x)')
      expect(ast2.type).toBe('Definition')

      // А6: x♀ : (x -> x♀)
      const ast3 = parseExpr('x♀ : (x -> x♀)')
      expect(ast3.type).toBe('Definition')

      // А8: 1 : (♂∞ -> ∞♀)
      const ast4 = parseExpr('1 : (♂∞ -> ∞♀)')
      expect(ast4.type).toBe('Definition')
    })

    it('should parse complex equalities', () => {
      // From mtl_formulas.mtc
      const ast = parseExpr('a -> b -> c = (a -> b) -> c')
      expect(ast.type).toBe('Equality')
    })

    it('should parse complex inequalities', () => {
      const ast = parseExpr('♂∞♀ != ∞')
      expect(ast.type).toBe('Inequality')
    })
  })

  describe('File parsing', () => {
    it('should parse multiple statements with commas', () => {
      const file = parse('a = b, c = d')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(2)
    })

    it('should parse multiple statements with newlines', () => {
      const file = parse('a = b\nc = d')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(2)
    })

    it('should parse multiple statements without separators', () => {
      const file = parse('a = b\nc = d\ne = f')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(3)
    })

    it('should parse mixed separators (commas and newlines)', () => {
      const file = parse('a = b\nc = d,\ne = f')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(3)
    })

    it('should parse empty file', () => {
      const file = parse('')
      expect(file.statements.length).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should throw on unexpected token', () => {
      expect(() => parseExpr(')')).toThrow(ParseError)
    })
  })

  describe('Partial parsing with error recovery', () => {
    it('should return partial AST when error occurs after valid statements', () => {
      const input = `
a = b
c = d
e = f)
      `.trim()

      const result = parseWithRecovery(input)

      // Should have parsed three statements successfully (e = f is valid)
      expect(result.file).not.toBeNull()
      expect(result.file?.statements.length).toBe(3)

      // Should have error information
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('Parse error')
      expect(result.errorLocation).toBeDefined()
    })

    it('should return null file when error occurs on first statement', () => {
      const input = `
)
a = b
      `.trim()

      const result = parseWithRecovery(input)

      // No valid statements parsed
      expect(result.file).toBeNull()

      // Should have error information
      expect(result.error).not.toBeNull()
      expect(result.errorLocation).toBeDefined()
    })

    it('should handle error from issue #48 example', () => {
      const input = `
∞ = ∞ -> ∞
♂v = ♂v -> v
r♀ = r -> r♀
!♂x = x♀
!x♀ = ♂x)
a -> b -> c = (a -> b) -> c
      `.trim()

      const result = parseWithRecovery(input)

      // Line 5 is "!x♀ = ♂x)" which parses as "!x♀ = ♂x" followed by stray ")"
      // So 5 valid statements should be parsed (lines 1-5)
      expect(result.file).not.toBeNull()
      expect(result.file?.statements.length).toBe(5)

      // Should have error on the closing paren
      expect(result.error).not.toBeNull()
      expect(result.error?.message).toContain('RPAREN')
      expect(result.errorLocation?.start.line).toBe(5)
    })

    it('should return no error when parsing is fully successful', () => {
      const input = `
a = b
c = d
      `.trim()

      const result = parseWithRecovery(input)

      // Should have parsed all statements
      expect(result.file).not.toBeNull()
      expect(result.file?.statements.length).toBe(2)

      // Should have no error
      expect(result.error).toBeNull()
      expect(result.errorLocation).toBeUndefined()
    })

    it('should provide correct error location', () => {
      const input = 'a = b\nc = d)'

      const result = parseWithRecovery(input)

      // Should have parsed two statements (a = b and c = d are valid)
      expect(result.file?.statements.length).toBe(2)

      // Error should be on line 2 (the ')' part)
      expect(result.errorLocation?.start.line).toBe(2)
      expect(result.error?.message).toContain('RPAREN')
    })
  })
})
