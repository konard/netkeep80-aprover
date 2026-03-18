/**
 * Shared AST node factory functions for МТС (Meta-Theory of Links)
 *
 * These helpers are used across normalizer, stringAnum, and quatAnum modules
 * to create AST nodes consistently. Each factory function accepts an optional
 * SourceLocation parameter — if not provided, location is inferred from children
 * where applicable.
 */

import type {
  ASTNode,
  SourceLocation,
  LinkExpr,
  NotExpr,
  MaleExpr,
  FemaleExpr,
  InfinityExpr,
  AbitLitExpr,
  StringLitExpr,
} from './ast'

/** Create source location from start/end positions */
export function makeLoc(
  startLine: number,
  startColumn: number,
  startOffset: number,
  endLine: number,
  endColumn: number,
  endOffset: number
): SourceLocation {
  return {
    start: { line: startLine, column: startColumn, offset: startOffset },
    end: { line: endLine, column: endColumn, offset: endOffset },
  }
}

/** Create infinity node */
export function makeInfinity(loc?: SourceLocation): InfinityExpr {
  return { type: 'Infinity', loc }
}

/** Create link node */
export function makeLink(left: ASTNode, right: ASTNode, loc?: SourceLocation): LinkExpr {
  return {
    type: 'Link',
    left,
    right,
    loc: loc ?? (left.loc && right.loc ? { start: left.loc.start, end: right.loc.end } : undefined),
  }
}

/** Create not node */
export function makeNot(operand: ASTNode, loc?: SourceLocation): NotExpr {
  return {
    type: 'Not',
    operand,
    loc: loc ?? operand.loc,
  }
}

/** Create male node */
export function makeMale(operand: ASTNode, loc?: SourceLocation): MaleExpr {
  return {
    type: 'Male',
    operand,
    loc: loc ?? operand.loc,
  }
}

/** Create female node */
export function makeFemale(operand: ASTNode, loc?: SourceLocation): FemaleExpr {
  return {
    type: 'Female',
    operand,
    loc: loc ?? operand.loc,
  }
}

/** Create abit literal node */
export function makeAbitLit(value: string, loc?: SourceLocation): AbitLitExpr {
  return { type: 'AbitLit', value, loc }
}

/** Create string literal node */
export function makeStringLit(value: string, loc?: SourceLocation): StringLitExpr {
  return { type: 'StringLit', value, loc }
}
