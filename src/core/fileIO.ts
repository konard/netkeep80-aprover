/**
 * File I/O operations for МТС (Meta-Theory of Links)
 *
 * This module provides functionality for:
 * - Loading .mtl files (formal notation)
 * - Saving results to files
 * - Managing recent files history in localStorage
 */

import type { ProofResult } from './prover'
import { toCanonicalString } from './normalizer'
import type { ASTNode } from './ast'

/** Supported file extensions */
export const SUPPORTED_EXTENSIONS = ['.mtl', '.astr', '.anum'] as const
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

/** File metadata stored in recent files list */
export interface FileMetadata {
  /** File name */
  name: string
  /** Last accessed timestamp */
  lastAccessed: number
  /** File size in bytes */
  size: number
  /** Preview of first line (max 50 chars) */
  preview: string
}

/** Verification result for export */
export interface ExportResult {
  /** Statement string */
  statement: string
  /** Whether verification succeeded */
  success: boolean
  /** Result message */
  message: string
  /** Applied axioms */
  axioms: string[]
}

/** Local storage key for recent files */
const RECENT_FILES_KEY = 'aprover_recent_files'
/** Maximum number of recent files to store */
const MAX_RECENT_FILES = 10
/** Local storage key for autosave content */
const AUTOSAVE_KEY = 'aprover_autosave'

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.substring(lastDot).toLowerCase()
}

/**
 * Check if file has supported extension
 */
export function isSupportedFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)
}

/**
 * Check if file is an MTL file
 */
export function isMtlFile(filename: string): boolean {
  return getFileExtension(filename) === '.mtl'
}

/**
 * Check if file is an ASTR file (string anumbers)
 */
export function isAstrFile(filename: string): boolean {
  return getFileExtension(filename) === '.astr'
}

/**
 * Check if file is an ANUM file (quaternary anumbers)
 */
export function isAnumFile(filename: string): boolean {
  return getFileExtension(filename) === '.anum'
}

/**
 * Read file content from File object
 */
export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`))
    }
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * Get preview from file content (first non-empty line, max 50 chars)
 */
export function getFilePreview(content: string, maxLength = 50): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('//')) {
      return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed
    }
  }
  // If no non-comment line found, use first non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed
    }
  }
  return '(empty file)'
}

/**
 * Get recent files from localStorage
 */
export function getRecentFiles(): FileMetadata[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY)
    if (!stored) return []
    const files = JSON.parse(stored) as FileMetadata[]
    // Sort by last accessed (most recent first)
    return files.sort((a, b) => b.lastAccessed - a.lastAccessed)
  } catch {
    console.warn('Failed to load recent files from localStorage')
    return []
  }
}

/**
 * Add file to recent files list
 */
export function addRecentFile(name: string, size: number, preview: string): void {
  try {
    const recent = getRecentFiles()

    // Remove existing entry with same name
    const filtered = recent.filter(f => f.name !== name)

    // Add new entry at beginning
    const newEntry: FileMetadata = {
      name,
      lastAccessed: Date.now(),
      size,
      preview,
    }
    filtered.unshift(newEntry)

    // Keep only MAX_RECENT_FILES
    const trimmed = filtered.slice(0, MAX_RECENT_FILES)

    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(trimmed))
  } catch {
    console.warn('Failed to save recent file to localStorage')
  }
}

/**
 * Remove file from recent files list
 */
export function removeRecentFile(name: string): void {
  try {
    const recent = getRecentFiles()
    const filtered = recent.filter(f => f.name !== name)
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(filtered))
  } catch {
    console.warn('Failed to remove recent file from localStorage')
  }
}

/**
 * Clear all recent files
 */
export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(RECENT_FILES_KEY)
  } catch {
    console.warn('Failed to clear recent files from localStorage')
  }
}

/**
 * Save content to autosave storage
 */
export function saveAutosave(content: string): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, content)
  } catch {
    console.warn('Failed to save autosave to localStorage')
  }
}

/**
 * Load content from autosave storage
 */
export function loadAutosave(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY)
  } catch {
    console.warn('Failed to load autosave from localStorage')
    return null
  }
}

/**
 * Clear autosave storage
 */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    console.warn('Failed to clear autosave from localStorage')
  }
}

/**
 * Format verification results for export
 */
export function formatResultsForExport(
  results: { stmt: string; result: ProofResult }[],
  options: { includeDetails?: boolean; format?: 'text' | 'json' } = {}
): string {
  const { includeDetails = true, format = 'text' } = options

  if (format === 'json') {
    const exportData: ExportResult[] = results.map(({ stmt, result }) => ({
      statement: stmt,
      success: result.success,
      message: result.message,
      axioms: result.appliedAxioms?.map(a => a.id) || [],
    }))
    return JSON.stringify(exportData, null, 2)
  }

  // Text format
  const lines: string[] = []
  lines.push('// aprover - Результаты верификации')
  lines.push(`// Дата: ${new Date().toLocaleString('ru-RU')}`)
  lines.push(`// Всего выражений: ${results.length}`)
  lines.push(`// Успешно: ${results.filter(r => r.result.success).length}/${results.length}`)
  lines.push('')
  lines.push('// ========================================')
  lines.push('')

  for (const { stmt, result } of results) {
    const status = result.success ? '✓' : '✗'
    lines.push(`${status} ${stmt}`)

    if (includeDetails) {
      lines.push(`  // ${result.message}`)
      if (result.appliedAxioms && result.appliedAxioms.length > 0) {
        const axiomIds = result.appliedAxioms.map(a => a.id).join(', ')
        lines.push(`  // Аксиомы: ${axiomIds}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format AST for export
 */
export function formatAstForExport(ast: ASTNode, indent = 0): string {
  const pad = '  '.repeat(indent)
  const lines: string[] = []

  lines.push(`${pad}${ast.type}`)

  if ('name' in ast && typeof ast.name === 'string') {
    lines.push(`${pad}  name: ${ast.name}`)
  }
  if ('name' in ast && typeof ast.name === 'object' && ast.name !== null) {
    lines.push(`${pad}  name:`)
    lines.push(formatAstForExport(ast.name, indent + 2))
  }
  if ('value' in ast) {
    lines.push(`${pad}  value: ${ast.value}`)
  }
  if ('side' in ast) {
    lines.push(`${pad}  side: ${ast.side}`)
  }
  if ('left' in ast && ast.left) {
    lines.push(`${pad}  left:`)
    lines.push(formatAstForExport(ast.left, indent + 2))
  }
  if ('right' in ast && ast.right) {
    lines.push(`${pad}  right:`)
    lines.push(formatAstForExport(ast.right, indent + 2))
  }
  if ('operand' in ast && ast.operand) {
    lines.push(`${pad}  operand:`)
    lines.push(formatAstForExport(ast.operand, indent + 2))
  }
  if ('form' in ast && ast.form) {
    lines.push(`${pad}  form:`)
    lines.push(formatAstForExport(ast.form, indent + 2))
  }
  if ('inner' in ast && ast.inner) {
    lines.push(`${pad}  inner:`)
    lines.push(formatAstForExport(ast.inner, indent + 2))
  }
  if ('elements' in ast && Array.isArray(ast.elements)) {
    lines.push(`${pad}  elements:`)
    for (const el of ast.elements) {
      lines.push(formatAstForExport(el, indent + 2))
    }
  }
  if ('statements' in ast && Array.isArray(ast.statements)) {
    lines.push(`${pad}  statements:`)
    for (const st of ast.statements) {
      lines.push(formatAstForExport(st, indent + 2))
    }
  }
  if ('expr' in ast && ast.expr) {
    lines.push(`${pad}  expr:`)
    lines.push(formatAstForExport(ast.expr, indent + 2))
  }

  return lines.join('\n')
}

/**
 * Generate MTL export content from AST
 */
export function generateMtlFromAst(ast: ASTNode): string {
  if ('statements' in ast && Array.isArray(ast.statements)) {
    // File node
    return ast.statements.map(stmt => generateMtlFromAst(stmt)).join('\n')
  }

  if ('expr' in ast && ast.expr) {
    // Statement node
    return toCanonicalString(ast.expr) + '.'
  }

  // Single expression
  return toCanonicalString(ast)
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * Trigger file open dialog
 */
export function openFileDialog(
  accept: string = '.mtl,.astr,.anum',
  multiple = false
): Promise<FileList | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'

    input.onchange = () => {
      resolve(input.files)
      document.body.removeChild(input)
    }

    input.oncancel = () => {
      resolve(null)
      document.body.removeChild(input)
    }

    document.body.appendChild(input)
    input.click()
  })
}
