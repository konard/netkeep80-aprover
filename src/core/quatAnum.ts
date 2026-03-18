/**
 * Quaternary (Abit) Anumbers parser for МТС (Meta-Theory of Links)
 *
 * Quaternary notation (.anum) uses exactly 4 symbols:
 * - '[' (♂∞): beginning abit - query to form of self-closed beginning
 * - ']' (∞♀): ending abit - query to form of self-closed ending
 * - '1' (♂∞ -> ∞♀): truth abit - presence of directed link
 * - '0' (∞♀ -> ♂∞): falsehood abit - absence/inverse of link
 *
 * Nested contexts [ ... ] are supported and interpreted as context boundaries.
 *
 * Example: 01010001[010100[1001]010]...
 *
 * The parsing process:
 * 1. Validate that only valid abits are present
 * 2. Parse nested contexts structure
 * 3. Convert to string anumber (UTF-8 string of same 4 characters)
 * 4. Further convert to formal notation using stringAnum module
 */

import type { ASTNode, File, Statement, LinkExpr, AbitLitExpr } from './ast'
import { makeLoc, makeInfinity, makeLink, makeMale, makeFemale, makeAbitLit } from './astHelpers'

/** Valid abit characters in quaternary notation */
export const VALID_ABITS = ['0', '1', '[', ']'] as const
export type AbitChar = (typeof VALID_ABITS)[number]

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
  /** Whether to validate bracket matching strictly */
  strictBrackets?: boolean
}

const defaultOptions: QuatAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
  strictBrackets: true,
}

/** Abit symbol definitions in MTS formal notation */
export const ABIT_DEFINITIONS = {
  '[': '♂∞', // Beginning abit: self-closed beginning
  ']': '∞♀', // Ending abit: self-closed ending
  '1': '(♂∞ -> ∞♀)', // Truth: directed link from beginning to ending
  '0': '(∞♀ -> ♂∞)', // Falsehood: inverse direction (or !1)
} as const

/** Parsed abit with position information */
export interface ParsedAbit {
  /** The abit character */
  char: AbitChar
  /** Position in original content */
  offset: number
  /** Line number (1-based) */
  line: number
  /** Column number (1-based) */
  column: number
  /** Nesting depth (for context abits) */
  depth: number
}

/** Parsed context (nested [ ... ]) */
export interface ParsedContext {
  /** Content inside the context */
  content: ParsedAbit[]
  /** Opening bracket position */
  openOffset: number
  /** Closing bracket position */
  closeOffset: number
  /** Nesting depth */
  depth: number
}

/** Result of quaternary anumber validation */
export interface ValidationResult {
  /** Whether the content is valid */
  valid: boolean
  /** Error message if invalid */
  error?: string
  /** Position of error if invalid */
  errorOffset?: number
}

/**
 * Check if a character is a valid abit
 */
export function isValidAbit(char: string): char is AbitChar {
  return VALID_ABITS.includes(char as AbitChar)
}

/**
 * Validate quaternary anumber content
 *
 * Checks that:
 * 1. Only valid abit characters are present (0, 1, [, ])
 * 2. Brackets are properly matched and nested
 */
export function validateQuatAnum(content: string): ValidationResult {
  const bracketStack: number[] = []

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    // Skip whitespace and newlines
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      continue
    }

    // Skip comments
    if (char === '/' && content[i + 1] === '/') {
      // Skip to end of line
      while (i < content.length && content[i] !== '\n') {
        i++
      }
      continue
    }

    if (!isValidAbit(char)) {
      return {
        valid: false,
        error: `Invalid character '${char}' at position ${i}. Only 0, 1, [, ] are allowed in quaternary notation.`,
        errorOffset: i,
      }
    }

    if (char === '[') {
      bracketStack.push(i)
    } else if (char === ']') {
      if (bracketStack.length === 0) {
        return {
          valid: false,
          error: `Unmatched closing bracket ']' at position ${i}.`,
          errorOffset: i,
        }
      }
      bracketStack.pop()
    }
  }

  if (bracketStack.length > 0) {
    return {
      valid: false,
      error: `Unmatched opening bracket '[' at position ${bracketStack[0]}.`,
      errorOffset: bracketStack[0],
    }
  }

  return { valid: true }
}

/**
 * Clean quaternary anumber content - remove whitespace and comments
 */
export function cleanQuatAnum(content: string): string {
  const lines = content.split('\n')
  const cleaned: string[] = []

  for (const line of lines) {
    let cleanedLine = ''
    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      // Skip comments
      if (char === '/' && line[i + 1] === '/') {
        break
      }

      // Skip whitespace
      if (char === ' ' || char === '\t' || char === '\r') {
        continue
      }

      if (isValidAbit(char)) {
        cleanedLine += char
      }
    }

    if (cleanedLine.length > 0) {
      cleaned.push(cleanedLine)
    }
  }

  return cleaned.join('')
}

/**
 * Parse a single abit to its AST representation
 *
 * According to MTS axioms:
 * - '[' : ♂∞
 * - ']' : ∞♀
 * - '1' : (♂∞ -> ∞♀)
 * - '0' : (∞♀ -> ♂∞) which equals !1
 */
export function parseAbitToAST(abit: AbitChar, loc?: SourceLocation): ASTNode {
  const inf = makeInfinity()

  switch (abit) {
    case '[':
      // ♂∞ - Male applied to infinity
      return makeMale(inf, loc)

    case ']':
      // ∞♀ - Female applied to infinity
      return makeFemale(inf, loc)

    case '1':
      // ♂∞ -> ∞♀
      return makeLink(makeMale(inf), makeFemale(makeInfinity()), loc)

    case '0':
      // ∞♀ -> ♂∞ (inverse of 1)
      return makeLink(makeFemale(makeInfinity()), makeMale(inf), loc)
  }
}

/**
 * Convert quaternary anumber to formal notation string
 *
 * Each abit is converted to its formal MTS representation.
 * The sequence is interpreted as left-associative chain.
 *
 * Example: "01" → "((∞ -> (∞♀ -> ♂∞)) -> (♂∞ -> ∞♀))"
 */
export function quatAnumToFormal(content: string): string {
  const cleaned = cleanQuatAnum(content)

  if (cleaned.length === 0) {
    return '∞'
  }

  let result = '∞'

  for (const char of cleaned) {
    if (isValidAbit(char)) {
      const formal = ABIT_DEFINITIONS[char]
      result = `(${result} -> ${formal})`
    }
  }

  return result
}

/**
 * Convert quaternary anumber to string anumber format
 *
 * Since string anumbers use UTF-8 characters, and the 4 abit
 * characters (0, 1, [, ]) are valid UTF-8, we can simply
 * clean the content and return it as the string anumber.
 */
export function quatAnumToStringAnum(content: string): string {
  return cleanQuatAnum(content)
}

/**
 * Parse a single line of quaternary anumber to AST
 *
 * Builds (∞ -> 'abits') where 'abits' is an AbitLit containing the abit sequence.
 */
export function parseQuatAnumLine(
  line: string,
  lineNumber: number = 1,
  startOffset: number = 0
): ASTNode {
  const cleaned = cleanQuatAnum(line)

  // Empty line produces ∞
  if (cleaned.length === 0) {
    const loc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
    return makeInfinity(loc)
  }

  // Build (∞ -> 'cleaned') where cleaned contains only abit characters
  const infLoc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
  const inf = makeInfinity(infLoc)

  const abitLoc = makeLoc(
    lineNumber,
    1,
    startOffset,
    lineNumber,
    cleaned.length + 1,
    startOffset + cleaned.length
  )
  const abitNode = makeAbitLit(cleaned, abitLoc)

  const linkLoc = makeLoc(
    lineNumber,
    1,
    startOffset,
    lineNumber,
    cleaned.length + 1,
    startOffset + cleaned.length
  )

  return makeLink(inf, abitNode, linkLoc)
}

/**
 * Parse quaternary anumber file content to AST
 *
 * Each non-empty, non-comment line becomes a statement.
 */
export function parseQuatAnum(content: string, options: QuatAnumOptions = {}): File {
  const opts = { ...defaultOptions, ...options }

  // Validate content first if strict mode
  if (opts.strictBrackets) {
    const validation = validateQuatAnum(content)
    if (!validation.valid) {
      throw new QuatAnumError(validation.error || 'Invalid content', validation.errorOffset || 0)
    }
  }

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
    const cleaned = cleanQuatAnum(line)
    if (opts.skipEmptyLines && cleaned.length === 0) {
      offset += line.length + 1
      lineNumber++
      continue
    }

    // Parse the line
    const expr = parseQuatAnumLine(line, lineNumber, offset)

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
 * Parse a single quaternary anumber expression
 */
export function parseQuatAnumExpr(content: string): ASTNode {
  const validation = validateQuatAnum(content)
  if (!validation.valid) {
    throw new QuatAnumError(validation.error || 'Invalid content', validation.errorOffset || 0)
  }

  return parseQuatAnumLine(content, 1, 0)
}

/**
 * Convert AST back to quaternary anumber format
 *
 * This extracts values from AbitLit nodes and validates that
 * only valid abit characters are present.
 */
export function toQuatAnum(node: ASTNode): string | null {
  const chars: string[] = []

  function traverse(n: ASTNode): boolean {
    if (n.type === 'Infinity') {
      return true
    }

    if (n.type === 'Link') {
      const link = n as LinkExpr
      if (!traverse(link.left)) return false
      if (link.right.type === 'AbitLit') {
        const value = (link.right as AbitLitExpr).value
        // All characters in AbitLit must be valid abits
        for (const char of value) {
          if (!isValidAbit(char)) {
            return false
          }
        }
        chars.push(value)
        return true
      }
      return false
    }

    // Single AbitLit at the end (edge case)
    if (n.type === 'AbitLit') {
      const value = (n as AbitLitExpr).value
      for (const char of value) {
        if (!isValidAbit(char)) {
          return false
        }
      }
      chars.push(value)
      return true
    }

    return false
  }

  if (traverse(node)) {
    return chars.join('')
  }
  return null
}

/**
 * Check if an AST node represents a valid quaternary anumber
 */
export function isQuatAnumExpr(node: ASTNode): boolean {
  return toQuatAnum(node) !== null
}

/**
 * Generate .mtl content from .anum content
 *
 * Each line in .anum becomes a statement in .mtl.
 * The conversion preserves the quaternary notation semantically
 * by converting each abit sequence to formal notation.
 */
export function quatAnumFileToMtl(content: string, options: QuatAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }
  const lines = content.split('\n')
  const mtlLines: string[] = []

  mtlLines.push('// Generated from .anum file (quaternary notation)')
  mtlLines.push('// Each line represents a quaternary anumber (abit sequence)')
  mtlLines.push('// Abits: [ = ♂∞, ] = ∞♀, 1 = ♂∞ -> ∞♀, 0 = ∞♀ -> ♂∞')
  mtlLines.push('')

  for (const line of lines) {
    const trimmed = line.trim()

    // Preserve comments
    if (trimmed.startsWith('//')) {
      mtlLines.push(trimmed)
      continue
    }

    // Skip empty lines
    const cleaned = cleanQuatAnum(line)
    if (opts.skipEmptyLines && cleaned.length === 0) {
      continue
    }

    // Convert to formal notation
    const formal = quatAnumToFormal(line)
    mtlLines.push(`${formal}.`)
  }

  return mtlLines.join('\n')
}

/**
 * Visualization of quaternary anumber conversion process
 *
 * Returns an array of intermediate steps showing how
 * the abit sequence is converted to formal notation.
 */
export interface QuatConversionStep {
  /** Current abit being processed */
  abit: string
  /** Index of the abit (0-based) */
  index: number
  /** MTS definition for this abit */
  definition: string
  /** Current chain in formal notation */
  formal: string
  /** Description of this step */
  description: string
}

export function visualizeQuatConversion(content: string): QuatConversionStep[] {
  const cleaned = cleanQuatAnum(content)

  if (cleaned.length === 0) {
    return [
      {
        abit: '',
        index: -1,
        definition: '∞',
        formal: '∞',
        description: 'Empty sequence equals akorern (∞)',
      },
    ]
  }

  const steps: QuatConversionStep[] = []
  let currentFormal = '∞'

  steps.push({
    abit: '',
    index: -1,
    definition: '∞',
    formal: currentFormal,
    description: 'Start from akorern (∞)',
  })

  for (let i = 0; i < cleaned.length; i++) {
    const abit = cleaned[i]
    if (!isValidAbit(abit)) continue

    const definition = ABIT_DEFINITIONS[abit]
    currentFormal = `(${currentFormal} -> ${definition})`

    let abitName: string
    switch (abit) {
      case '[':
        abitName = 'opening bracket (♂∞)'
        break
      case ']':
        abitName = 'closing bracket (∞♀)'
        break
      case '1':
        abitName = 'one/truth (♂∞ -> ∞♀)'
        break
      case '0':
        abitName = 'zero/false (∞♀ -> ♂∞)'
        break
    }

    steps.push({
      abit,
      index: i,
      definition,
      formal: currentFormal,
      description: `Link abit '${abit}' - ${abitName}`,
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
  /** Count of each abit type */
  abitCounts: {
    '[': number
    ']': number
    '0': number
    '1': number
  }
  /** Number of links in the chain */
  linkCount: number
  /** Maximum nesting depth */
  maxDepth: number
  /** Whether brackets are balanced */
  balanced: boolean
}

export function getQuatAnumStats(content: string): QuatAnumStats {
  const cleaned = cleanQuatAnum(content)
  const counts = { '[': 0, ']': 0, '0': 0, '1': 0 }
  let depth = 0
  let maxDepth = 0

  for (const char of cleaned) {
    if (isValidAbit(char)) {
      counts[char]++
      if (char === '[') {
        depth++
        maxDepth = Math.max(maxDepth, depth)
      } else if (char === ']') {
        depth--
      }
    }
  }

  return {
    abitCount: cleaned.length,
    abitCounts: counts,
    linkCount: cleaned.length, // Each abit creates one link
    maxDepth,
    balanced: counts['['] === counts[']'],
  }
}

/**
 * Check if content could be a quaternary anumber file
 *
 * Returns true if the content (ignoring whitespace and comments)
 * only contains valid abit characters.
 */
export function isQuatAnumContent(content: string): boolean {
  const validation = validateQuatAnum(content)
  return validation.valid
}
