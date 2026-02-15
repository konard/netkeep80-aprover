/**
 * Lexer for МТС (Meta-Theory of Links) formal notation
 * Based on EBNF from "МТС — Чистовик v0.1.md"
 */

import type { SourceLocation } from './ast'

/** Token types */
export type TokenType =
  | 'ARROW' // ->
  | 'NOT_ARROW' // !->
  | 'DEFINE' // :
  | 'EQUAL' // =
  | 'NOT_EQUAL' // != | ≠ | ¬=
  | 'MALE' // ♂
  | 'FEMALE' // ♀
  | 'NOT' // ! | ¬
  | 'POWER' // ^
  | 'INFINITY' // ∞
  | 'ZERO' // 0
  | 'ONE' // 1
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'LBRACE' // {
  | 'RBRACE' // }
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'COMMA' // ,
  | 'DOT' // .
  | 'CHAR_LIT' // 'c' (single character for quaternary abits)
  | 'STRING_LIT' // "..." (string for string anumbers)
  | 'ID' // identifier
  | 'NAT' // natural number
  | 'EOF'

/** Token structure */
export interface Token {
  type: TokenType
  value: string
  loc: SourceLocation
}

/** Lexer error */
export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public offset: number
  ) {
    super(`Lexer error at ${line}:${column}: ${message}`)
    this.name = 'LexerError'
  }
}

/** Lexer class */
export class Lexer {
  private input: string
  private pos: number = 0
  private line: number = 1
  private column: number = 1

  constructor(input: string) {
    this.input = input
  }

  /** Get current character */
  private current(): string {
    return this.input[this.pos] || ''
  }

  /** Peek ahead n characters */
  private peek(n: number = 1): string {
    return this.input[this.pos + n] || ''
  }

  /** Advance position by n characters */
  private advance(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.current() === '\n') {
        this.line++
        this.column = 1
      } else {
        this.column++
      }
      this.pos++
    }
  }

  /** Check if at end of input */
  private isEOF(): boolean {
    return this.pos >= this.input.length
  }

  /** Skip whitespace and comments */
  private skipWhitespaceAndComments(): void {
    while (!this.isEOF()) {
      // Skip whitespace
      if (/\s/.test(this.current())) {
        this.advance()
        continue
      }
      // Skip line comments: // ...
      if (this.current() === '/' && this.peek() === '/') {
        while (!this.isEOF() && this.current() !== '\n') {
          this.advance()
        }
        continue
      }
      break
    }
  }

  /** Create source location */
  private makeLoc(startLine: number, startColumn: number, startOffset: number): SourceLocation {
    return {
      start: { line: startLine, column: startColumn, offset: startOffset },
      end: { line: this.line, column: this.column, offset: this.pos },
    }
  }

  /** Check if character is start of identifier */
  private isIdStart(c: string): boolean {
    return /[a-zA-Zа-яА-ЯёЁ_]/.test(c)
  }

  /** Check if character can continue identifier */
  private isIdContinue(c: string): boolean {
    return /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(c)
  }

  /** Check if character is digit */
  private isDigit(c: string): boolean {
    return /[0-9]/.test(c)
  }

  /** Read identifier */
  private readIdentifier(): string {
    let result = ''
    while (!this.isEOF() && this.isIdContinue(this.current())) {
      result += this.current()
      this.advance()
    }
    return result
  }

  /** Read natural number */
  private readNumber(): string {
    let result = ''
    while (!this.isEOF() && this.isDigit(this.current())) {
      result += this.current()
      this.advance()
    }
    return result
  }

  /** Read character literal (single character in single quotes) */
  private readCharLit(): string {
    this.advance() // skip opening '
    if (this.isEOF()) {
      throw new LexerError('Unterminated character literal', this.line, this.column, this.pos)
    }
    const char = this.current()
    this.advance()
    if (this.current() !== "'") {
      throw new LexerError(
        'Expected closing quote in character literal',
        this.line,
        this.column,
        this.pos
      )
    }
    this.advance() // skip closing '
    return char
  }

  /** Read string literal (multiple characters in double quotes) */
  private readStringLit(): string {
    this.advance() // skip opening "
    let result = ''
    while (!this.isEOF() && this.current() !== '"') {
      // Handle escape sequences
      if (this.current() === '\\') {
        this.advance()
        if (this.isEOF()) {
          throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
        }
        const escaped = this.current()
        switch (escaped) {
          case 'n':
            result += '\n'
            break
          case 't':
            result += '\t'
            break
          case 'r':
            result += '\r'
            break
          case '\\':
            result += '\\'
            break
          case '"':
            result += '"'
            break
          default:
            // For unknown escape sequences, just include the character as-is
            result += escaped
        }
      } else {
        result += this.current()
      }
      this.advance()
    }
    if (this.isEOF()) {
      throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
    }
    this.advance() // skip closing "
    return result
  }

  /** Get next token */
  nextToken(): Token {
    this.skipWhitespaceAndComments()

    if (this.isEOF()) {
      return {
        type: 'EOF',
        value: '',
        loc: this.makeLoc(this.line, this.column, this.pos),
      }
    }

    const startLine = this.line
    const startColumn = this.column
    const startOffset = this.pos
    const c = this.current()

    // Multi-character tokens: check !-> before ! and !=
    if (c === '!' && this.peek() === '-' && this.peek(2) === '>') {
      this.advance(3)
      return {
        type: 'NOT_ARROW',
        value: '!->',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    if (c === '!' && this.peek() === '=') {
      this.advance(2)
      return {
        type: 'NOT_EQUAL',
        value: '!=',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    if (c === '-' && this.peek() === '>') {
      this.advance(2)
      return { type: 'ARROW', value: '->', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (c === '¬' && this.peek() === '=') {
      this.advance(2)
      return {
        type: 'NOT_EQUAL',
        value: '¬=',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    // Single character tokens
    switch (c) {
      case ':':
        this.advance()
        return {
          type: 'DEFINE',
          value: ':',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '=':
        this.advance()
        return { type: 'EQUAL', value: '=', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '≠':
        this.advance()
        return {
          type: 'NOT_EQUAL',
          value: '≠',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '♂':
        this.advance()
        return { type: 'MALE', value: '♂', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '♀':
        this.advance()
        return {
          type: 'FEMALE',
          value: '♀',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '!':
        this.advance()
        return { type: 'NOT', value: '!', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '¬':
        this.advance()
        return { type: 'NOT', value: '¬', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '^':
        this.advance()
        return { type: 'POWER', value: '^', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '∞':
        this.advance()
        return {
          type: 'INFINITY',
          value: '∞',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '(':
        this.advance()
        return {
          type: 'LPAREN',
          value: '(',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ')':
        this.advance()
        return {
          type: 'RPAREN',
          value: ')',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '{':
        this.advance()
        return {
          type: 'LBRACE',
          value: '{',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '}':
        this.advance()
        return {
          type: 'RBRACE',
          value: '}',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '[':
        this.advance()
        return {
          type: 'LBRACKET',
          value: '[',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ']':
        this.advance()
        return {
          type: 'RBRACKET',
          value: ']',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ',':
        this.advance()
        return { type: 'COMMA', value: ',', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '.':
        this.advance()
        return { type: 'DOT', value: '.', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case "'":
        const char = this.readCharLit()
        return {
          type: 'CHAR_LIT',
          value: char,
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '"':
        const str = this.readStringLit()
        return {
          type: 'STRING_LIT',
          value: str,
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
    }

    // Numbers: 0 and 1 are special constants, larger numbers are NAT
    if (this.isDigit(c)) {
      const num = this.readNumber()
      if (num === '0') {
        return { type: 'ZERO', value: '0', loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
      if (num === '1') {
        return { type: 'ONE', value: '1', loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
      return { type: 'NAT', value: num, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    // Identifiers
    if (this.isIdStart(c)) {
      const id = this.readIdentifier()
      return { type: 'ID', value: id, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    throw new LexerError(`Unexpected character: ${c}`, this.line, this.column, this.pos)
  }

  /** Tokenize entire input */
  tokenize(): Token[] {
    const tokens: Token[] = []
    while (true) {
      const token = this.nextToken()
      tokens.push(token)
      if (token.type === 'EOF') break
    }
    return tokens
  }
}

/** Convenience function to tokenize a string */
export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize()
}
