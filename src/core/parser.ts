/**
 * Parser for МТС (Meta-Theory of Links) formal notation
 * Based on EBNF from "МТС — Чистовик v0.1.md"
 *
 * Grammar (simplified):
 * File      ::= { Stmt }
 * Stmt      ::= Expr [ "," ]  // comma separator is optional
 * Expr      ::= DefExpr | EqExpr | NeqExpr | Term
 * DefExpr   ::= Term ":" Term
 * EqExpr    ::= Term "=" Term
 * NeqExpr   ::= Term ("!=" | "≠" | "¬=") Term
 * Term      ::= Chain
 * Chain     ::= Pref { ("->" | "!->") Pref }  // left-associative
 * Pref      ::= { "!" | "¬" | "♂" } Post
 * Post      ::= Atom { "♀" | "^" Nat }
 * Atom      ::= Const | Id | AbitLit | StringLit | Set | "(" Expr ")"
 * Set       ::= "{" Expr { "," Expr } "}"
 * Const     ::= "∞" | "0" | "1" | "[" | "]"
 * AbitLit   ::= "'" { AbitChar } "'" // sequence of [, 0, 1, ] for abit anumbers
 * StringLit ::= '"' { Utf8Char } '"' // string for string anumbers
 * AbitChar  ::= "[" | "0" | "1" | "]"
 */

import type { Token, TokenType } from './lexer'
import { Lexer } from './lexer'
import type {
  ASTNode,
  File,
  Statement,
  LinkExpr,
  NotLinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  PowerExpr,
  SetExpr,
  InfinityExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  BracketExpr,
  SourceLocation,
} from './ast'

/** Parser error */
export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(`Parse error at ${token.loc.start.line}:${token.loc.start.column}: ${message}`)
    this.name = 'ParseError'
  }
}

/** Parse result with partial AST and optional error */
export interface ParseResult {
  file: File | null
  error: ParseError | null
  errorLocation?: SourceLocation
}

/** Parser class */
export class Parser {
  private tokens: Token[]
  private pos: number = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  /** Get current token */
  private current(): Token {
    return this.tokens[this.pos]
  }

  /** Peek ahead n tokens */
  private peek(n: number = 1): Token {
    return this.tokens[this.pos + n] || this.tokens[this.tokens.length - 1]
  }

  /** Advance to next token */
  private advance(): Token {
    const token = this.current()
    if (this.pos < this.tokens.length - 1) {
      this.pos++
    }
    return token
  }

  /** Check if current token matches type */
  private check(type: TokenType): boolean {
    return this.current().type === type
  }

  /** Check if current token matches any of types */
  private checkAny(...types: TokenType[]): boolean {
    return types.includes(this.current().type)
  }

  /** Expect current token to be of type, throw if not */
  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      throw new ParseError(`Expected ${type}, got ${this.current().type}`, this.current())
    }
    return this.advance()
  }

  /** Merge source locations */
  private mergeLoc(start: SourceLocation, end: SourceLocation): SourceLocation {
    return { start: start.start, end: end.end }
  }

  /** Parse file */
  parseFile(): File {
    const statements: Statement[] = []
    const startLoc = this.current().loc

    while (!this.check('EOF')) {
      statements.push(this.parseStatement())
    }

    return {
      type: 'File',
      statements,
      loc: this.mergeLoc(startLoc, this.current().loc),
    }
  }

  /** Parse file with error recovery - returns partial AST on error */
  parseFileWithRecovery(): ParseResult {
    const statements: Statement[] = []
    const startLoc = this.current().loc
    let error: ParseError | null = null
    let errorLocation: SourceLocation | undefined

    while (!this.check('EOF')) {
      try {
        statements.push(this.parseStatement())
      } catch (e) {
        if (e instanceof ParseError) {
          error = e
          errorLocation = e.token.loc
          // Stop parsing on first error
          break
        }
        throw e
      }
    }

    const file: File | null =
      statements.length > 0
        ? {
            type: 'File',
            statements,
            loc: this.mergeLoc(startLoc, this.current().loc),
          }
        : null

    return {
      file,
      error,
      errorLocation,
    }
  }

  /** Parse statement: Expr ["," | newline]
   * Commas and newlines are optional separators between statements.
   * They are consumed if present but not required.
   * Periods (.) are NOT supported as separators.
   */
  private parseStatement(): Statement {
    const expr = this.parseExpr()

    // Optional separator: consume comma if present
    // Newlines are already consumed by whitespace skipping in lexer
    if (this.check('COMMA')) {
      const separator = this.advance()
      return {
        type: 'Statement',
        expr,
        loc: this.mergeLoc(expr.loc!, separator.loc),
      }
    }

    return {
      type: 'Statement',
      expr,
      loc: expr.loc!,
    }
  }

  /** Parse expression: DefExpr | EqExpr | NeqExpr | Term */
  private parseExpr(): ASTNode {
    const left = this.parseTerm()

    // Check for definition, equality, or inequality
    if (this.check('DEFINE')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Definition',
        name: left,
        form: right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as DefExpr
    }

    if (this.check('EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Equality',
        left,
        right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as EqExpr
    }

    if (this.check('NOT_EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Inequality',
        left,
        right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as NeqExpr
    }

    return left
  }

  /** Parse term: Chain */
  private parseTerm(): ASTNode {
    return this.parseChain()
  }

  /** Parse chain: Pref { ("->" | "!->") Pref } (left-associative) */
  private parseChain(): ASTNode {
    let left = this.parsePref()

    while (this.checkAny('ARROW', 'NOT_ARROW')) {
      const isNotArrow = this.check('NOT_ARROW')
      this.advance()
      const right = this.parsePref()

      if (isNotArrow) {
        left = {
          type: 'NotLink',
          left,
          right,
          loc: this.mergeLoc(left.loc!, right.loc!),
        } as NotLinkExpr
      } else {
        left = {
          type: 'Link',
          left,
          right,
          loc: this.mergeLoc(left.loc!, right.loc!),
        } as LinkExpr
      }
    }

    return left
  }

  /** Parse prefix: { "!" | "¬" | "♂" } Post (right-associative for ♂) */
  private parsePref(): ASTNode {
    const prefixes: { type: 'NOT' | 'MALE'; loc: SourceLocation }[] = []

    // Collect all prefix operators
    while (this.checkAny('NOT', 'MALE')) {
      prefixes.push({
        type: this.check('NOT') ? 'NOT' : 'MALE',
        loc: this.current().loc,
      })
      this.advance()
    }

    let node = this.parsePost()

    // Apply prefixes in reverse order (right-to-left for ♂)
    for (let i = prefixes.length - 1; i >= 0; i--) {
      const prefix = prefixes[i]
      if (prefix.type === 'NOT') {
        node = {
          type: 'Not',
          operand: node,
          loc: this.mergeLoc(prefix.loc, node.loc!),
        } as NotExpr
      } else {
        node = {
          type: 'Male',
          operand: node,
          loc: this.mergeLoc(prefix.loc, node.loc!),
        } as MaleExpr
      }
    }

    return node
  }

  /** Parse postfix: Atom { "♀" | "^" Nat } (left-associative for ♀) */
  private parsePost(): ASTNode {
    let node = this.parseAtom()

    while (this.checkAny('FEMALE', 'POWER')) {
      if (this.check('FEMALE')) {
        const femLoc = this.current().loc
        this.advance()
        node = {
          type: 'Female',
          operand: node,
          loc: this.mergeLoc(node.loc!, femLoc),
        } as FemaleExpr
      } else if (this.check('POWER')) {
        this.advance()
        // Accept NAT, ONE, or ZERO as exponent
        let expToken: Token
        if (this.check('NAT')) {
          expToken = this.advance()
        } else if (this.check('ONE')) {
          expToken = this.advance()
        } else if (this.check('ZERO')) {
          expToken = this.advance()
        } else {
          throw new ParseError('Expected number after ^', this.current())
        }
        const exponent = parseInt(expToken.value, 10)
        node = {
          type: 'Power',
          base: node,
          exponent,
          loc: this.mergeLoc(node.loc!, expToken.loc),
        } as PowerExpr
      }
    }

    return node
  }

  /** Parse atom: Const | Id | AbitLit | StringLit | Set | "(" Expr ")" */
  private parseAtom(): ASTNode {
    const token = this.current()

    // Constants
    if (this.check('INFINITY')) {
      this.advance()
      return { type: 'Infinity', loc: token.loc } as InfinityExpr
    }

    if (this.check('ZERO')) {
      this.advance()
      return { type: 'Num', value: 0, loc: token.loc } as NumExpr
    }

    if (this.check('ONE')) {
      this.advance()
      return { type: 'Num', value: 1, loc: token.loc } as NumExpr
    }

    if (this.check('LBRACKET')) {
      this.advance()
      return { type: 'Bracket', side: 'left', loc: token.loc } as BracketExpr
    }

    if (this.check('RBRACKET')) {
      this.advance()
      return { type: 'Bracket', side: 'right', loc: token.loc } as BracketExpr
    }

    // Identifier
    if (this.check('ID')) {
      this.advance()
      return { type: 'Identifier', name: token.value, loc: token.loc } as IdentExpr
    }

    // Natural number (used as identifier in some contexts)
    if (this.check('NAT')) {
      this.advance()
      return { type: 'Identifier', name: token.value, loc: token.loc } as IdentExpr
    }

    // Abit literal (sequence of [, 0, 1, ] in single quotes - for abit anumbers)
    if (this.check('ABIT_LIT')) {
      this.advance()
      return { type: 'AbitLit', value: token.value, loc: token.loc } as AbitLitExpr
    }

    // String literal (multiple characters in double quotes - for string anumbers)
    if (this.check('STRING_LIT')) {
      this.advance()
      return { type: 'StringLit', value: token.value, loc: token.loc } as StringLitExpr
    }

    // Set: "{" Expr { "," Expr } "}"
    if (this.check('LBRACE')) {
      return this.parseSet()
    }

    // Parenthesized expression
    if (this.check('LPAREN')) {
      const lparen = this.advance()
      const expr = this.parseExpr()
      const rparen = this.expect('RPAREN')
      expr.loc = this.mergeLoc(lparen.loc, rparen.loc)
      return expr
    }

    throw new ParseError(`Unexpected token: ${token.type}`, token)
  }

  /** Parse set: "{" Expr { "," Expr } "}" */
  private parseSet(): SetExpr {
    const lbrace = this.expect('LBRACE')
    const elements: ASTNode[] = []

    if (!this.check('RBRACE')) {
      elements.push(this.parseExpr())
      while (this.check('COMMA')) {
        this.advance()
        elements.push(this.parseExpr())
      }
    }

    const rbrace = this.expect('RBRACE')

    return {
      type: 'Set',
      elements,
      loc: this.mergeLoc(lbrace.loc, rbrace.loc),
    }
  }
}

/** Convenience function to parse a string */
export function parse(input: string): File {
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens)
  return parser.parseFile()
}

/** Convenience function to parse with error recovery */
export function parseWithRecovery(input: string): ParseResult {
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens)
  return parser.parseFileWithRecovery()
}

/** Parse single expression */
export function parseExpr(input: string): ASTNode {
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const parser = new Parser(tokens)
  const file = parser.parseFile()
  if (file.statements.length !== 1) {
    throw new ParseError('Expected single expression', tokens[0])
  }
  return file.statements[0].expr
}
