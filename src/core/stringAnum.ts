/**
 * String Anumbers parser for МТС (Meta-Theory of Links)
 *
 * String anumbers (.astr) represent data as left-associative chains of character links.
 *
 * A string "c₁c₂...cₙ" is interpreted as:
 *   (((∞ -> 'c₁') -> 'c₂') -> ... -> 'cₙ')
 *
 * Each character becomes a CharLit node linked to the previous chain.
 * The chain always starts from ∞ (infinity/akorern).
 *
 * Example:
 *   "связь" ≡ (((((∞ -> 'с') -> 'в') -> 'я') -> 'з') -> 'ь')
 */

import type { ASTNode, File, Statement } from './ast'
import { makeLoc, makeInfinity, makeLink, makeStringLit, extractLinkChain } from './astHelpers'

/** Error during string anumber parsing */
export class StringAnumError extends Error {
  constructor(
    message: string,
    public offset: number,
    public char?: string
  ) {
    super(`StringAnum error at position ${offset}: ${message}`)
    this.name = 'StringAnumError'
  }
}

/** Options for string anumber parsing */
export interface StringAnumOptions {
  /** Whether to preserve line breaks as separate statements */
  lineAsStatement?: boolean
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
  /** Whether to skip lines starting with // (comments) */
  skipComments?: boolean
}

const defaultOptions: StringAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
}

/**
 * Convert a single line of string anumber to AST
 *
 * An empty string produces just ∞
 * A string "s" produces (∞ -> "s") where "s" is a StringLit
 */
export function parseStringAnumLine(
  line: string,
  lineNumber: number = 1,
  startOffset: number = 0
): ASTNode {
  // Empty line produces ∞
  if (line.length === 0) {
    const loc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
    return makeInfinity(loc)
  }

  // Build (∞ -> "string") where the whole string is a StringLit
  const infLoc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
  const inf = makeInfinity(infLoc)

  const strLoc = makeLoc(
    lineNumber,
    1,
    startOffset,
    lineNumber,
    line.length + 1,
    startOffset + line.length
  )
  const strNode = makeStringLit(line, strLoc)

  const linkLoc = makeLoc(
    lineNumber,
    1,
    startOffset,
    lineNumber,
    line.length + 1,
    startOffset + line.length
  )

  return makeLink(inf, strNode, linkLoc)
}

/**
 * Parse string anumber file content to AST
 *
 * Each non-empty line becomes a statement containing the character chain.
 * Lines starting with // are treated as comments and skipped.
 */
export function parseStringAnum(content: string, options: StringAnumOptions = {}): File {
  const opts = { ...defaultOptions, ...options }
  const statements: Statement[] = []
  const lines = content.split('\n')

  let offset = 0
  let lineNumber = 1

  const startLoc = makeLoc(1, 1, 0, 1, 1, 0)

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments
    if (opts.skipComments && trimmed.startsWith('//')) {
      offset += line.length + 1 // +1 for newline
      lineNumber++
      continue
    }

    // Skip empty lines if configured
    if (opts.skipEmptyLines && trimmed.length === 0) {
      offset += line.length + 1
      lineNumber++
      continue
    }

    // Parse the line
    const expr = opts.lineAsStatement
      ? parseStringAnumLine(trimmed, lineNumber, offset)
      : parseStringAnumLine(line, lineNumber, offset)

    const stmtLoc = makeLoc(
      lineNumber,
      1,
      offset,
      lineNumber,
      (opts.lineAsStatement ? trimmed : line).length + 1,
      offset + (opts.lineAsStatement ? trimmed : line).length
    )

    statements.push({
      type: 'Statement',
      expr,
      loc: stmtLoc,
    })

    offset += line.length + 1
    lineNumber++
  }

  const endLoc = makeLoc(lineNumber, 1, offset, lineNumber, 1, offset)

  return {
    type: 'File',
    statements,
    loc: {
      start: startLoc.start,
      end: endLoc.end,
    },
  }
}

/**
 * Parse a single string anumber expression (without treating lines as statements)
 *
 * The entire content is treated as one string to convert.
 */
export function parseStringAnumExpr(content: string): ASTNode {
  return parseStringAnumLine(content, 1, 0)
}

/**
 * Convert AST back to string anumber format
 *
 * This extracts string values from StringLit nodes.
 * Returns null if the AST doesn't represent a valid string anumber.
 */
export function toStringAnum(node: ASTNode): string | null {
  return extractLinkChain(node, 'StringLit')
}

/**
 * Check if an AST node represents a valid string anumber
 *
 * A valid string anumber is a left-associative chain of links
 * starting from ∞ with StringLit nodes on the right side.
 */
export function isStringAnumExpr(node: ASTNode): boolean {
  return toStringAnum(node) !== null
}

/**
 * Convert string anumber to formal notation string
 *
 * Example: "hello" → "(∞ -> \"hello\")"
 */
export function stringAnumToFormal(str: string): string {
  if (str.length === 0) {
    return '∞'
  }

  // Escape double quote and backslash if needed
  const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `(∞ -> "${escapedStr}")`
}

/**
 * Generate .mtl content from .astr content
 *
 * Each line in .astr becomes a statement in .mtl
 */
export function stringAnumFileToMtl(content: string, options: StringAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }
  const lines = content.split('\n')
  const mtlLines: string[] = []

  mtlLines.push('// Generated from .astr file')
  mtlLines.push('// Each line represents a string anumber (left-associative chain)')
  mtlLines.push('')

  for (const line of lines) {
    const trimmed = line.trim()

    // Preserve comments
    if (trimmed.startsWith('//')) {
      mtlLines.push(trimmed)
      continue
    }

    // Skip empty lines
    if (opts.skipEmptyLines && trimmed.length === 0) {
      continue
    }

    // Convert to formal notation
    const formal = stringAnumToFormal(opts.lineAsStatement ? trimmed : line)
    mtlLines.push(`${formal}.`)
  }

  return mtlLines.join('\n')
}

/**
 * Visualization of string anumber conversion process
 *
 * Returns an array of intermediate steps showing how
 * the string is converted to a chain of links.
 */
export interface ConversionStep {
  /** String value being processed */
  value: string
  /** Current chain in formal notation */
  formal: string
  /** Description of this step */
  description: string
}

export function visualizeConversion(str: string): ConversionStep[] {
  if (str.length === 0) {
    return [
      {
        value: '',
        formal: '∞',
        description: 'Empty string equals akorern (∞)',
      },
    ]
  }

  const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  return [
    {
      value: '',
      formal: '∞',
      description: 'Start from akorern (∞)',
    },
    {
      value: str,
      formal: `(∞ -> "${escapedStr}")`,
      description: `Link string "${str}" (${str.length} characters)`,
    },
  ]
}

/**
 * Get statistics about a string anumber
 */
export interface StringAnumStats {
  /** Total number of characters */
  charCount: number
  /** Number of unique characters */
  uniqueChars: number
  /** Number of links in the chain */
  linkCount: number
  /** Byte length in UTF-8 */
  byteLength: number
  /** Character frequency map */
  charFrequency: Map<string, number>
}

export function getStringAnumStats(str: string): StringAnumStats {
  const chars = Array.from(str)
  const frequency = new Map<string, number>()

  for (const char of chars) {
    frequency.set(char, (frequency.get(char) || 0) + 1)
  }

  return {
    charCount: chars.length,
    uniqueChars: frequency.size,
    linkCount: chars.length, // Each char creates one link
    byteLength: new TextEncoder().encode(str).length,
    charFrequency: frequency,
  }
}
