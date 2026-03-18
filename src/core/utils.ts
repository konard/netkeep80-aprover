/**
 * Shared utility functions for МТС (Meta-Theory of Links)
 *
 * General-purpose helpers used across multiple modules.
 * For AST-specific factories, see astHelpers.ts.
 */

import type { ASTNode, Statement, File } from './ast'
import { makeLoc } from './astHelpers'

/**
 * Escape special characters for DOT/Graphviz labels
 */
export function escapeLabel(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

/**
 * Options for generic line-by-line file parsing
 */
export interface FileParseOptions {
  /** Whether to skip lines starting with // (comments) */
  skipComments?: boolean
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
}

/**
 * Generic line-by-line file parser.
 *
 * Iterates lines, skipping comments and empties per options,
 * delegates to `parseLine` for each surviving line, and
 * assembles a File AST node.
 *
 * @param content - Raw file content
 * @param options - Skip options for comments and empty lines
 * @param isEmptyLine - Callback to determine if a line is empty (module-specific logic)
 * @param parseLine - Callback to parse a single line into an AST node and its effective length
 */
export function parseFileLines(
  content: string,
  options: FileParseOptions,
  isEmptyLine: (line: string, trimmed: string) => boolean,
  parseLine: (
    line: string,
    trimmed: string,
    lineNumber: number,
    offset: number
  ) => { expr: ASTNode; length: number }
): File {
  const statements: Statement[] = []
  const lines = content.split('\n')
  let offset = 0
  let lineNumber = 1
  const startLoc = makeLoc(1, 1, 0, 1, 1, 0)

  for (const line of lines) {
    const trimmed = line.trim()

    if (options.skipComments && trimmed.startsWith('//')) {
      offset += line.length + 1
      lineNumber++
      continue
    }

    if (options.skipEmptyLines && isEmptyLine(line, trimmed)) {
      offset += line.length + 1
      lineNumber++
      continue
    }

    const { expr, length } = parseLine(line, trimmed, lineNumber, offset)
    const stmtLoc = makeLoc(lineNumber, 1, offset, lineNumber, length + 1, offset + length)

    statements.push({ type: 'Statement', expr, loc: stmtLoc })
    offset += line.length + 1
    lineNumber++
  }

  const endLoc = makeLoc(lineNumber, 1, offset, lineNumber, 1, offset)
  return {
    type: 'File',
    statements,
    loc: { start: startLoc.start, end: endLoc.end },
  }
}

/**
 * Options for generic line-by-line file-to-MTL conversion
 */
export interface FileToMtlOptions {
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
  /** Header comment lines to prepend */
  headerLines: string[]
}

/**
 * Generic line-by-line file-to-MTL converter.
 *
 * Processes lines, preserving comments, skipping empty lines per options,
 * and converting each non-empty, non-comment line to formal notation.
 *
 * @param content - Raw file content
 * @param options - Conversion options with header lines
 * @param isEmptyLine - Callback to determine if a line is empty (module-specific logic)
 * @param toFormal - Callback to convert a line to formal MTL notation
 */
export function fileToMtl(
  content: string,
  options: FileToMtlOptions,
  isEmptyLine: (line: string, trimmed: string) => boolean,
  toFormal: (line: string) => string
): string {
  const lines = content.split('\n')
  const mtlLines: string[] = [...options.headerLines, '']

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('//')) {
      mtlLines.push(trimmed)
      continue
    }

    if (options.skipEmptyLines && isEmptyLine(line, trimmed)) {
      continue
    }

    mtlLines.push(`${toFormal(line)}.`)
  }

  return mtlLines.join('\n')
}
