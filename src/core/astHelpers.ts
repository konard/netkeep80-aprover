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
import { isLinkExpr, isInfinityExpr } from './ast'

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

/**
 * Extract values from a left-associative link chain (∞ -> lit₁ -> lit₂ -> ... -> litₙ).
 *
 * The chain must start from ∞ and each right-side node must match `literalType`.
 * An optional `validate` callback can reject individual literal values.
 *
 * Returns the collected literal values joined as a string, or null if
 * the AST doesn't represent a valid chain of the expected literal type.
 */
export function extractLinkChain(
  node: ASTNode,
  literalType: string,
  validate?: (value: string) => boolean
): string | null {
  const parts: string[] = []

  function traverse(n: ASTNode): boolean {
    if (isInfinityExpr(n)) {
      return true
    }

    if (isLinkExpr(n)) {
      if (!traverse(n.left)) return false
      if (n.right.type === literalType) {
        const value = (n.right as { value: string }).value
        if (validate && !validate(value)) return false
        parts.push(value)
        return true
      }
      return false
    }

    // Single literal at the end (edge case)
    if (n.type === literalType) {
      const value = (n as { value: string }).value
      if (validate && !validate(value)) return false
      parts.push(value)
      return true
    }

    return false
  }

  if (traverse(node)) {
    return parts.join('')
  }
  return null
}
