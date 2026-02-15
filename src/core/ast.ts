/**
 * AST types for МТС (Meta-Theory of Links) formal notation
 * Based on EBNF from "МТС — Чистовик v0.1.md"
 */

/** Source location for error reporting */
export interface SourceLocation {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

/** Base interface for all AST nodes */
export interface ASTNode {
  type: string
  loc?: SourceLocation
}

/** Link expression: a -> b */
export interface LinkExpr extends ASTNode {
  type: 'Link'
  left: ASTNode
  right: ASTNode
}

/** Not-link expression: a !-> b (sugar for !(a -> b)) */
export interface NotLinkExpr extends ASTNode {
  type: 'NotLink'
  left: ASTNode
  right: ASTNode
}

/** Definition expression: s : F */
export interface DefExpr extends ASTNode {
  type: 'Definition'
  name: ASTNode
  form: ASTNode
}

/** Equality expression: A = B */
export interface EqExpr extends ASTNode {
  type: 'Equality'
  left: ASTNode
  right: ASTNode
}

/** Inequality expression: A != B */
export interface NeqExpr extends ASTNode {
  type: 'Inequality'
  left: ASTNode
  right: ASTNode
}

/** Male/self-closing start: ♂x */
export interface MaleExpr extends ASTNode {
  type: 'Male'
  operand: ASTNode
}

/** Female/self-closing end: x♀ */
export interface FemaleExpr extends ASTNode {
  type: 'Female'
  operand: ASTNode
}

/** Negation/inversion: !x or ¬x */
export interface NotExpr extends ASTNode {
  type: 'Not'
  operand: ASTNode
}

/** Power expression: a^n */
export interface PowerExpr extends ASTNode {
  type: 'Power'
  base: ASTNode
  exponent: number
}

/** Set/package expression: { A, B, C } */
export interface SetExpr extends ASTNode {
  type: 'Set'
  elements: ASTNode[]
}

/** Infinity/akorень: ∞ */
export interface InfinityExpr extends ASTNode {
  type: 'Infinity'
}

/** Numeric constants: 0, 1 */
export interface NumExpr extends ASTNode {
  type: 'Num'
  value: 0 | 1
}

/** Identifier: variable names */
export interface IdentExpr extends ASTNode {
  type: 'Identifier'
  name: string
}

/** Character literal: 'c' (single character, used for quaternary abits) */
export interface CharLitExpr extends ASTNode {
  type: 'CharLit'
  char: string
}

/** String literal: "..." (multi-character string, used for string anumbers) */
export interface StringLitExpr extends ASTNode {
  type: 'StringLit'
  value: string
}

/** Bracket constants: [ and ] (abits) */
export interface BracketExpr extends ASTNode {
  type: 'Bracket'
  side: 'left' | 'right'
}

/** Statement: expression followed by dot */
export interface Statement extends ASTNode {
  type: 'Statement'
  expr: ASTNode
}

/** File: sequence of statements */
export interface File extends ASTNode {
  type: 'File'
  statements: Statement[]
}

/** Type guards */
export function isLinkExpr(node: ASTNode): node is LinkExpr {
  return node.type === 'Link'
}

export function isNotLinkExpr(node: ASTNode): node is NotLinkExpr {
  return node.type === 'NotLink'
}

export function isDefExpr(node: ASTNode): node is DefExpr {
  return node.type === 'Definition'
}

export function isEqExpr(node: ASTNode): node is EqExpr {
  return node.type === 'Equality'
}

export function isNeqExpr(node: ASTNode): node is NeqExpr {
  return node.type === 'Inequality'
}

export function isMaleExpr(node: ASTNode): node is MaleExpr {
  return node.type === 'Male'
}

export function isFemaleExpr(node: ASTNode): node is FemaleExpr {
  return node.type === 'Female'
}

export function isNotExpr(node: ASTNode): node is NotExpr {
  return node.type === 'Not'
}

export function isPowerExpr(node: ASTNode): node is PowerExpr {
  return node.type === 'Power'
}

export function isSetExpr(node: ASTNode): node is SetExpr {
  return node.type === 'Set'
}

export function isInfinityExpr(node: ASTNode): node is InfinityExpr {
  return node.type === 'Infinity'
}

export function isNumExpr(node: ASTNode): node is NumExpr {
  return node.type === 'Num'
}

export function isIdentExpr(node: ASTNode): node is IdentExpr {
  return node.type === 'Identifier'
}

export function isCharLitExpr(node: ASTNode): node is CharLitExpr {
  return node.type === 'CharLit'
}

export function isStringLitExpr(node: ASTNode): node is StringLitExpr {
  return node.type === 'StringLit'
}

export function isBracketExpr(node: ASTNode): node is BracketExpr {
  return node.type === 'Bracket'
}

/** Pretty print AST node for debugging */
export function astToString(node: ASTNode): string {
  switch (node.type) {
    case 'Link':
      return `(${astToString((node as LinkExpr).left)} -> ${astToString((node as LinkExpr).right)})`
    case 'NotLink':
      return `(${astToString((node as NotLinkExpr).left)} !-> ${astToString((node as NotLinkExpr).right)})`
    case 'Definition':
      return `${astToString((node as DefExpr).name)} : ${astToString((node as DefExpr).form)}`
    case 'Equality':
      return `(${astToString((node as EqExpr).left)} = ${astToString((node as EqExpr).right)})`
    case 'Inequality':
      return `(${astToString((node as NeqExpr).left)} != ${astToString((node as NeqExpr).right)})`
    case 'Male':
      return `♂${astToString((node as MaleExpr).operand)}`
    case 'Female':
      return `${astToString((node as FemaleExpr).operand)}♀`
    case 'Not':
      return `!${astToString((node as NotExpr).operand)}`
    case 'Power':
      return `${astToString((node as PowerExpr).base)}^${(node as PowerExpr).exponent}`
    case 'Set':
      return `{${(node as SetExpr).elements.map(astToString).join(', ')}}`
    case 'Infinity':
      return '∞'
    case 'Num':
      return String((node as NumExpr).value)
    case 'Identifier':
      return (node as IdentExpr).name
    case 'CharLit':
      return `'${(node as CharLitExpr).char}'`
    case 'StringLit':
      return `"${(node as StringLitExpr).value}"`
    case 'Bracket':
      return (node as BracketExpr).side === 'left' ? '[' : ']'
    case 'Statement':
      return `${astToString((node as Statement).expr)}.`
    case 'File':
      return (node as File).statements.map(astToString).join('\n')
    default:
      return `<unknown: ${node.type}>`
  }
}
