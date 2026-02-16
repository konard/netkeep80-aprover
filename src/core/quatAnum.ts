/**
 * Quaternary Anumbers parser for МТС (Meta-Theory of Links)
 *
 * Quaternary anumbers (.anum) represent data using four abits (quaternary digits):
 * - '[' → ♂∞ (Male infinity - start marker)
 * - ']' → ∞♀ (Female infinity - end marker)
 * - '1' → ♂∞ -> ∞♀ (Directed link from start to end)
 * - '0' → ∞♀ -> ♂∞ (Directed link from end to start - inverse of 1)
 *
 * An anumber always implicitly starts with ∞ (akorern).
 * Each abit is interpreted as a link from the current chain to the abit's form.
 *
 * Example:
 *   "[1]" ≡ (((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> ∞♀)
 *
 * Nested contexts [...] are supported and resolved through composition.
 */

import type {
  ASTNode,
  File,
  Statement,
  LinkExpr,
  InfinityExpr,
  MaleExpr,
  FemaleExpr,
  SourceLocation,
} from './ast'

/** Error during quaternary anumber parsing */
export class QuatAnumError extends Error {
  constructor(
    message: string,
    public offset: number,
    public char?: string
  ) {
    super(`QuatAnum error at position ${offset}: ${message}`)
    this.name = 'QuatAnumError'
  }
}

/** Options for quaternary anumber parsing */
export interface QuatAnumOptions {
  /** Whether to preserve line breaks as separate statements */
  lineAsStatement?: boolean
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
  /** Whether to skip lines starting with // (comments) */
  skipComments?: boolean
}

const defaultOptions: QuatAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
}

/** Create infinity node */
function makeInfinity(loc?: SourceLocation): InfinityExpr {
  return { type: 'Infinity', loc }
}

/** Create male expression node: ♂x */
function makeMale(operand: ASTNode, loc?: SourceLocation): MaleExpr {
  return { type: 'Male', operand, loc }
}

/** Create female expression node: x♀ */
function makeFemale(operand: ASTNode, loc?: SourceLocation): FemaleExpr {
  return { type: 'Female', operand, loc }
}

/** Create link node */
function makeLink(left: ASTNode, right: ASTNode, loc?: SourceLocation): LinkExpr {
  return { type: 'Link', left, right, loc }
}

/** Create source location */
function makeLoc(
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

/** Check if a character is a valid abit */
function isAbit(char: string): boolean {
  return char === '[' || char === ']' || char === '0' || char === '1'
}

/**
 * Convert a single abit to its AST representation
 *
 * '[' → ♂∞
 * ']' → ∞♀
 * '1' → (♂∞ -> ∞♀)
 * '0' → (∞♀ -> ♂∞)
 */
function abitToAst(
  abit: string,
  lineNumber: number,
  column: number,
  offset: number
): ASTNode {
  const abitLoc = makeLoc(lineNumber, column, offset, lineNumber, column + 1, offset + 1)

  switch (abit) {
    case '[': {
      // '[' → ♂∞
      const infLoc = makeLoc(lineNumber, column, offset, lineNumber, column + 1, offset + 1)
      const inf = makeInfinity(infLoc)
      return makeMale(inf, abitLoc)
    }

    case ']': {
      // ']' → ∞♀
      const infLoc = makeLoc(lineNumber, column, offset, lineNumber, column + 1, offset + 1)
      const inf = makeInfinity(infLoc)
      return makeFemale(inf, abitLoc)
    }

    case '1': {
      // '1' → (♂∞ -> ∞♀)
      const inf1Loc = makeLoc(lineNumber, column, offset, lineNumber, column, offset)
      const inf2Loc = makeLoc(lineNumber, column + 1, offset + 1, lineNumber, column + 1, offset + 1)
      const inf1 = makeInfinity(inf1Loc)
      const inf2 = makeInfinity(inf2Loc)
      const male = makeMale(inf1, inf1Loc)
      const female = makeFemale(inf2, inf2Loc)
      return makeLink(male, female, abitLoc)
    }

    case '0': {
      // '0' → (∞♀ -> ♂∞)
      const inf1Loc = makeLoc(lineNumber, column, offset, lineNumber, column, offset)
      const inf2Loc = makeLoc(lineNumber, column + 1, offset + 1, lineNumber, column + 1, offset + 1)
      const inf1 = makeInfinity(inf1Loc)
      const inf2 = makeInfinity(inf2Loc)
      const female = makeFemale(inf1, inf1Loc)
      const male = makeMale(inf2, inf2Loc)
      return makeLink(female, male, abitLoc)
    }

    default:
      throw new QuatAnumError(`Invalid abit: '${abit}'`, offset, abit)
  }
}

/**
 * Parse nested context [...] and return the AST for its content
 *
 * A context [...] is a self-contained anumber that gets composed
 * with the surrounding context through linking.
 */
function parseNestedContext(
  content: string,
  startOffset: number,
  lineNumber: number,
  startColumn: number
): { node: ASTNode; endOffset: number; endColumn: number } {
  // Parse the content inside the brackets as a separate anumber
  let offset = startOffset
  let column = startColumn

  // Start with infinity (implicit)
  const infLoc = makeLoc(lineNumber, startColumn, startOffset, lineNumber, startColumn, startOffset)
  let result: ASTNode = makeInfinity(infLoc)

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (!isAbit(char)) {
      throw new QuatAnumError(`Invalid character in nested context: '${char}'`, offset, char)
    }

    const abitNode = abitToAst(char, lineNumber, column, offset)
    const linkLoc = makeLoc(
      result.loc?.start.line || lineNumber,
      result.loc?.start.column || startColumn,
      result.loc?.start.offset || startOffset,
      lineNumber,
      column + 1,
      offset + 1
    )
    result = makeLink(result, abitNode, linkLoc)

    column++
    offset++
  }

  return { node: result, endOffset: offset, endColumn: column }
}

/**
 * Convert a single line of quaternary anumber to AST
 *
 * An empty string produces just ∞
 * A sequence of abits produces a left-associative chain starting from ∞
 *
 * Example: "[1]" → (((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> ∞♀)
 */
export function parseQuatAnumLine(
  line: string,
  lineNumber: number = 1,
  startOffset: number = 0
): ASTNode {
  // Empty line produces ∞
  if (line.length === 0) {
    const loc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
    return makeInfinity(loc)
  }

  // Start with ∞ (implicit)
  const infLoc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
  let result: ASTNode = makeInfinity(infLoc)

  // Build left-associative chain: (((∞ -> a₁) -> a₂) -> ... -> aₙ)
  let column = 1
  let offset = startOffset
  const chars = Array.from(line)
  let i = 0

  while (i < chars.length) {
    const char = chars[i]

    // Skip whitespace
    if (char === ' ' || char === '\t') {
      i++
      column++
      offset++
      continue
    }

    if (isAbit(char)) {
      const abitNode = abitToAst(char, lineNumber, column, offset)
      const linkLoc = makeLoc(
        result.loc?.start.line || lineNumber,
        result.loc?.start.column || 1,
        result.loc?.start.offset || startOffset,
        lineNumber,
        column + 1,
        offset + 1
      )
      result = makeLink(result, abitNode, linkLoc)

      i++
      column++
      offset++
    } else {
      throw new QuatAnumError(`Invalid character: '${char}'`, offset, char)
    }
  }

  return result
}

/**
 * Parse quaternary anumber file content to AST
 *
 * Each non-empty line becomes a statement containing the abit chain.
 * Lines starting with // are treated as comments and skipped.
 */
export function parseQuatAnum(content: string, options: QuatAnumOptions = {}): File {
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

    // Parse the line - filter out only valid abits
    const abitLine = opts.lineAsStatement
      ? trimmed.split('').filter(isAbit).join('')
      : line.split('').filter(isAbit).join('')

    const expr = parseQuatAnumLine(abitLine, lineNumber, offset)

    const stmtLoc = makeLoc(
      lineNumber,
      1,
      offset,
      lineNumber,
      line.length + 1,
      offset + line.length
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
 * Parse a single quaternary anumber expression (without treating lines as statements)
 *
 * The entire content is treated as one anumber to convert.
 */
export function parseQuatAnumExpr(content: string): ASTNode {
  // Filter only valid abits
  const abitContent = content.split('').filter(isAbit).join('')
  return parseQuatAnumLine(abitContent, 1, 0)
}

/**
 * Convert AST back to quaternary anumber format
 *
 * This extracts abits from left-associative chains.
 * Returns null if the AST doesn't represent a valid quaternary anumber.
 */
export function toQuatAnum(node: ASTNode): string | null {
  const abits: string[] = []

  function traverse(n: ASTNode): boolean {
    if (n.type === 'Infinity') {
      return true
    }

    if (n.type === 'Link') {
      const link = n as LinkExpr
      if (!traverse(link.left)) return false

      // Check what the right side is
      const right = link.right

      // ♂∞ → '['
      if (right.type === 'Male' && right.operand.type === 'Infinity') {
        abits.push('[')
        return true
      }

      // ∞♀ → ']'
      if (right.type === 'Female' && right.operand.type === 'Infinity') {
        abits.push(']')
        return true
      }

      // (♂∞ -> ∞♀) → '1'
      if (
        right.type === 'Link' &&
        right.left.type === 'Male' &&
        right.left.operand.type === 'Infinity' &&
        right.right.type === 'Female' &&
        right.right.operand.type === 'Infinity'
      ) {
        abits.push('1')
        return true
      }

      // (∞♀ -> ♂∞) → '0'
      if (
        right.type === 'Link' &&
        right.left.type === 'Female' &&
        right.left.operand.type === 'Infinity' &&
        right.right.type === 'Male' &&
        right.right.operand.type === 'Infinity'
      ) {
        abits.push('0')
        return true
      }

      return false
    }

    return false
  }

  if (traverse(node)) {
    return abits.join('')
  }
  return null
}

/**
 * Check if an AST node represents a valid quaternary anumber
 *
 * A valid quaternary anumber is a left-associative chain of links
 * starting from ∞ with abit-compatible nodes on the right side.
 */
export function isQuatAnumExpr(node: ASTNode): boolean {
  return toQuatAnum(node) !== null
}

/**
 * Convert quaternary anumber to formal notation string
 *
 * Example: "[1]" → "(((∞ -> ♂∞) -> (♂∞ -> ∞♀)) -> ∞♀)"
 */
export function quatAnumToFormal(anum: string): string {
  if (anum.length === 0) {
    return '∞'
  }

  const chars = anum.split('').filter(isAbit)
  let result = '∞'

  for (const char of chars) {
    switch (char) {
      case '[':
        result = `(${result} -> ♂∞)`
        break
      case ']':
        result = `(${result} -> ∞♀)`
        break
      case '1':
        result = `(${result} -> (♂∞ -> ∞♀))`
        break
      case '0':
        result = `(${result} -> (∞♀ -> ♂∞))`
        break
    }
  }

  return result
}

/**
 * Generate .mtl content from .anum content
 *
 * Each line in .anum becomes a statement in .mtl
 */
export function quatAnumFileToMtl(content: string, options: QuatAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }
  const lines = content.split('\n')
  const mtlLines: string[] = []

  mtlLines.push('// Generated from .anum file')
  mtlLines.push('// Quaternary notation: [→♂∞, ]→∞♀, 1→(♂∞->∞♀), 0→(∞♀->♂∞)')
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

    // Filter only valid abits
    const abitLine = trimmed.split('').filter(isAbit).join('')

    // Convert to formal notation
    const formal = quatAnumToFormal(abitLine)
    mtlLines.push(`${formal}.`)
  }

  return mtlLines.join('\n')
}

/**
 * Visualization of quaternary anumber conversion process
 *
 * Returns an array of intermediate steps showing how
 * the anumber is converted to a chain of links.
 */
export interface QuatConversionStep {
  /** Current abit being processed */
  abit: string
  /** Index of the abit (0-based) */
  index: number
  /** Current chain in formal notation */
  formal: string
  /** Description of this step */
  description: string
  /** The form that this abit represents */
  form: string
}

export function visualizeQuatConversion(anum: string): QuatConversionStep[] {
  const chars = anum.split('').filter(isAbit)

  if (chars.length === 0) {
    return [
      {
        abit: '',
        index: -1,
        formal: '∞',
        description: 'Empty anumber equals akorern (∞)',
        form: '∞',
      },
    ]
  }

  const steps: QuatConversionStep[] = []
  let currentFormal = '∞'

  steps.push({
    abit: '',
    index: -1,
    formal: currentFormal,
    description: 'Start from akorern (∞)',
    form: '∞',
  })

  for (let i = 0; i < chars.length; i++) {
    const abit = chars[i]
    let form: string

    switch (abit) {
      case '[':
        form = '♂∞'
        currentFormal = `(${currentFormal} -> ${form})`
        break
      case ']':
        form = '∞♀'
        currentFormal = `(${currentFormal} -> ${form})`
        break
      case '1':
        form = '(♂∞ -> ∞♀)'
        currentFormal = `(${currentFormal} -> ${form})`
        break
      case '0':
        form = '(∞♀ -> ♂∞)'
        currentFormal = `(${currentFormal} -> ${form})`
        break
      default:
        form = '?'
    }

    steps.push({
      abit,
      index: i,
      formal: currentFormal,
      description: `Link abit '${abit}' → ${form}`,
      form,
    })
  }

  return steps
}

/**
 * Get statistics about a quaternary anumber
 */
export interface QuatAnumStats {
  /** Total number of abits */
  abitCount: number
  /** Number of '[' abits */
  openBrackets: number
  /** Number of ']' abits */
  closeBrackets: number
  /** Number of '1' abits */
  oneCount: number
  /** Number of '0' abits */
  zeroCount: number
  /** Number of links in the chain */
  linkCount: number
  /** Whether the anumber has balanced brackets */
  balanced: boolean
  /** Abit frequency map */
  abitFrequency: Map<string, number>
}

export function getQuatAnumStats(anum: string): QuatAnumStats {
  const chars = anum.split('').filter(isAbit)
  const frequency = new Map<string, number>([
    ['[', 0],
    [']', 0],
    ['1', 0],
    ['0', 0],
  ])

  for (const char of chars) {
    frequency.set(char, (frequency.get(char) || 0) + 1)
  }

  return {
    abitCount: chars.length,
    openBrackets: frequency.get('[') || 0,
    closeBrackets: frequency.get(']') || 0,
    oneCount: frequency.get('1') || 0,
    zeroCount: frequency.get('0') || 0,
    linkCount: chars.length, // Each abit creates one link
    balanced: (frequency.get('[') || 0) === (frequency.get(']') || 0),
    abitFrequency: frequency,
  }
}

/**
 * Convert quaternary anumber to string anumber
 *
 * Each abit is represented as a character:
 * '[' → '[', ']' → ']', '1' → '1', '0' → '0'
 *
 * Returns the .astr representation.
 */
export function quatAnumToStringAnum(anum: string): string {
  return anum.split('').filter(isAbit).join('')
}

/**
 * Convert string anumber to quaternary anumber
 *
 * Only valid abit characters are kept, others are filtered out.
 */
export function stringAnumToQuatAnum(str: string): string {
  return str.split('').filter(isAbit).join('')
}
