/**
 * Unit tests for МТС lexer
 */

import { describe, it, expect } from 'vitest'
import { tokenize, LexerError } from '../../src/core/lexer'

describe('Lexer', () => {
  describe('Basic tokens', () => {
    it('should tokenize arrow', () => {
      const tokens = tokenize('->')
      expect(tokens[0].type).toBe('ARROW')
      expect(tokens[0].value).toBe('->')
    })

    it('should tokenize not-arrow', () => {
      const tokens = tokenize('!->')
      expect(tokens[0].type).toBe('NOT_ARROW')
      expect(tokens[0].value).toBe('!->')
    })

    it('should tokenize define', () => {
      const tokens = tokenize(':')
      expect(tokens[0].type).toBe('DEFINE')
    })

    it('should tokenize equal', () => {
      const tokens = tokenize('=')
      expect(tokens[0].type).toBe('EQUAL')
    })

    it('should tokenize not-equal variants', () => {
      expect(tokenize('!=')[0].type).toBe('NOT_EQUAL')
      expect(tokenize('≠')[0].type).toBe('NOT_EQUAL')
      expect(tokenize('¬=')[0].type).toBe('NOT_EQUAL')
    })

    it('should tokenize male symbol', () => {
      const tokens = tokenize('♂')
      expect(tokens[0].type).toBe('MALE')
    })

    it('should tokenize female symbol', () => {
      const tokens = tokenize('♀')
      expect(tokens[0].type).toBe('FEMALE')
    })

    it('should tokenize not variants', () => {
      expect(tokenize('!')[0].type).toBe('NOT')
      expect(tokenize('¬')[0].type).toBe('NOT')
    })

    it('should tokenize power', () => {
      const tokens = tokenize('^')
      expect(tokens[0].type).toBe('POWER')
    })

    it('should tokenize infinity', () => {
      const tokens = tokenize('∞')
      expect(tokens[0].type).toBe('INFINITY')
    })

    it('should tokenize zero and one', () => {
      expect(tokenize('0')[0].type).toBe('ZERO')
      expect(tokenize('1')[0].type).toBe('ONE')
    })

    it('should tokenize brackets', () => {
      expect(tokenize('(')[0].type).toBe('LPAREN')
      expect(tokenize(')')[0].type).toBe('RPAREN')
      expect(tokenize('{')[0].type).toBe('LBRACE')
      expect(tokenize('}')[0].type).toBe('RBRACE')
      expect(tokenize('[')[0].type).toBe('LBRACKET')
      expect(tokenize(']')[0].type).toBe('RBRACKET')
    })

    it('should tokenize comma and dot', () => {
      expect(tokenize(',')[0].type).toBe('COMMA')
      expect(tokenize('.')[0].type).toBe('DOT')
    })

    it('should tokenize character literals (single quotes)', () => {
      const tokens = tokenize("'c'")
      expect(tokens[0].type).toBe('CHAR_LIT')
      expect(tokens[0].value).toBe('c')
    })

    it('should tokenize string literals (double quotes)', () => {
      const tokens = tokenize('"hello"')
      expect(tokens[0].type).toBe('STRING_LIT')
      expect(tokens[0].value).toBe('hello')
    })

    it('should tokenize empty string literal', () => {
      const tokens = tokenize('""')
      expect(tokens[0].type).toBe('STRING_LIT')
      expect(tokens[0].value).toBe('')
    })

    it('should tokenize string literal with UTF-8 characters', () => {
      const tokens = tokenize('"связь"')
      expect(tokens[0].type).toBe('STRING_LIT')
      expect(tokens[0].value).toBe('связь')
    })

    it('should tokenize string literal with escape sequences', () => {
      const tokens = tokenize('"a\\nb\\tc"')
      expect(tokens[0].type).toBe('STRING_LIT')
      expect(tokens[0].value).toBe('a\nb\tc')
    })

    it('should tokenize string literal with escaped quotes', () => {
      const tokens = tokenize('"say \\"hello\\""')
      expect(tokens[0].type).toBe('STRING_LIT')
      expect(tokens[0].value).toBe('say "hello"')
    })

    it('should tokenize identifiers', () => {
      const tokens = tokenize('abc')
      expect(tokens[0].type).toBe('ID')
      expect(tokens[0].value).toBe('abc')
    })

    it('should tokenize natural numbers', () => {
      const tokens = tokenize('42')
      expect(tokens[0].type).toBe('NAT')
      expect(tokens[0].value).toBe('42')
    })
  })

  describe('Complex expressions', () => {
    it('should tokenize simple link', () => {
      const tokens = tokenize('a -> b')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'ARROW', 'ID', 'EOF'])
    })

    it('should tokenize definition', () => {
      const tokens = tokenize('∞ : ∞ -> ∞')
      expect(tokens.map(t => t.type)).toEqual([
        'INFINITY',
        'DEFINE',
        'INFINITY',
        'ARROW',
        'INFINITY',
        'EOF',
      ])
    })

    it('should tokenize equality', () => {
      const tokens = tokenize('a = b')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'EQUAL', 'ID', 'EOF'])
    })

    it('should tokenize male expression', () => {
      const tokens = tokenize('♂x')
      expect(tokens.map(t => t.type)).toEqual(['MALE', 'ID', 'EOF'])
    })

    it('should tokenize female expression', () => {
      const tokens = tokenize('x♀')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'FEMALE', 'EOF'])
    })

    it('should tokenize power expression', () => {
      const tokens = tokenize('a^2')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'POWER', 'NAT', 'EOF'])
    })

    it('should tokenize set', () => {
      const tokens = tokenize('{ a, b }')
      expect(tokens.map(t => t.type)).toEqual(['LBRACE', 'ID', 'COMMA', 'ID', 'RBRACE', 'EOF'])
    })

    it('should tokenize complex expression', () => {
      const tokens = tokenize('(♂∞ -> ∞♀) = 1.')
      expect(tokens.map(t => t.type)).toEqual([
        'LPAREN',
        'MALE',
        'INFINITY',
        'ARROW',
        'INFINITY',
        'FEMALE',
        'RPAREN',
        'EQUAL',
        'ONE',
        'DOT',
        'EOF',
      ])
    })
  })

  describe('Whitespace and comments', () => {
    it('should skip whitespace', () => {
      const tokens = tokenize('  a   ->   b  ')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'ARROW', 'ID', 'EOF'])
    })

    it('should skip line comments', () => {
      const tokens = tokenize('a // comment\n-> b')
      expect(tokens.map(t => t.type)).toEqual(['ID', 'ARROW', 'ID', 'EOF'])
    })
  })

  describe('Source locations', () => {
    it('should track line and column', () => {
      const tokens = tokenize('a\nb')
      expect(tokens[0].loc.start.line).toBe(1)
      expect(tokens[0].loc.start.column).toBe(1)
      expect(tokens[1].loc.start.line).toBe(2)
      expect(tokens[1].loc.start.column).toBe(1)
    })
  })

  describe('Error handling', () => {
    it('should throw on unexpected character', () => {
      expect(() => tokenize('@')).toThrow(LexerError)
    })

    it('should throw on unterminated char literal', () => {
      expect(() => tokenize("'")).toThrow(LexerError)
    })

    it('should throw on unterminated string literal', () => {
      expect(() => tokenize('"hello')).toThrow(LexerError)
    })
  })
})
