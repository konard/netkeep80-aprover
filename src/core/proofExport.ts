/**
 * Proof export module for МТС (Meta-Theory of Links)
 *
 * This module provides functionality to export proofs in various formats:
 * - LaTeX: for academic papers and formal documentation
 * - Human-readable text: for quick review and sharing
 * - JSON: machine-readable format with full tracing
 * - DOT: graph format for visualization with Graphviz
 */

import type { ASTNode } from './ast'
import {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isBracketExpr,
  isPowerExpr,
} from './ast'
import type { ProofResult, ProverState, AxiomId } from './prover'
import { AXIOMS } from './prover'
import { toCanonicalString } from './normalizer'
import { escapeLabel } from './utils'

/**
 * Export format options
 */
export type ExportFormat = 'latex' | 'text' | 'json' | 'dot'

/**
 * Options for LaTeX export
 */
export interface LaTeXExportOptions {
  /** Include preamble for standalone document */
  standalone?: boolean
  /** Use amsthm proof environment */
  useProofEnvironment?: boolean
  /** Include axiom definitions in appendix */
  includeAxiomDefinitions?: boolean
  /** Document class (article, report, book) */
  documentClass?: 'article' | 'report' | 'book'
  /** Language for comments (ru or en) */
  language?: 'ru' | 'en'
}

/**
 * Options for text export
 */
export interface TextExportOptions {
  /** Include step numbers */
  includeStepNumbers?: boolean
  /** Include timestamps */
  includeTimestamps?: boolean
  /** Include axiom descriptions */
  includeAxiomDescriptions?: boolean
  /** Language for descriptions (ru or en) */
  language?: 'ru' | 'en'
  /** Line separator */
  lineSeparator?: string
}

/**
 * Options for JSON export
 */
export interface JSONExportOptions {
  /** Include pretty printing */
  pretty?: boolean
  /** Include full AST nodes */
  includeAST?: boolean
  /** Include prover state */
  includeState?: boolean
  /** Include timestamps */
  includeTimestamps?: boolean
}

/**
 * Options for DOT graph export
 */
export interface DOTExportOptions {
  /** Graph direction (TB, LR, BT, RL) */
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL'
  /** Include axiom labels on edges */
  includeAxiomLabels?: boolean
  /** Node shape (box, ellipse, diamond) */
  nodeShape?: 'box' | 'ellipse' | 'diamond'
  /** Color scheme (default, colorful, monochrome) */
  colorScheme?: 'default' | 'colorful' | 'monochrome'
  /** Include legend */
  includeLegend?: boolean
}

/**
 * Full proof export data structure for JSON
 */
export interface ProofExportData {
  /** Export format version */
  version: '1.0'
  /** Export timestamp */
  exportedAt: string
  /** Goal that was proven */
  goal: string
  /** Whether proof was successful */
  success: boolean
  /** Proof steps */
  steps: ProofStepExport[]
  /** Applied axioms summary */
  appliedAxioms: AxiomExport[]
  /** Hints if proof failed */
  hints?: string[]
  /** Full prover state (if requested) */
  state?: ProverStateExport
  /** Original AST (if requested) */
  ast?: ASTNode
}

/**
 * Exported proof step
 */
export interface ProofStepExport {
  /** Step number */
  index: number
  /** Action description */
  action: string
  /** Expression before */
  before?: string
  /** Expression after */
  after?: string
  /** Applied axiom ID */
  axiomId?: AxiomId
  /** Applied axiom name */
  axiomName?: string
  /** Applied axiom formula */
  axiomFormula?: string
  /** Additional details */
  details?: string
}

/**
 * Exported axiom info
 */
export interface AxiomExport {
  id: AxiomId
  name: string
  formula: string
  description: string
  /** Number of times applied */
  count: number
}

/**
 * Exported prover state
 */
export interface ProverStateExport {
  /** Number of definitions */
  definitionsCount: number
  /** Definition names */
  definitions: string[]
  /** Number of proven facts */
  factsCount: number
  /** Number of proven equalities */
  equalitiesCount: number
  /** Number of proven implications */
  implicationsCount: number
}

/**
 * Convert AST node to LaTeX notation
 */
export function astToLaTeX(node: ASTNode): string {
  if (isLinkExpr(node)) {
    return `(${astToLaTeX(node.left)} \\to ${astToLaTeX(node.right)})`
  }
  if (isDefExpr(node)) {
    return `${astToLaTeX(node.name)} : ${astToLaTeX(node.form)}`
  }
  if (isEqExpr(node)) {
    return `${astToLaTeX(node.left)} = ${astToLaTeX(node.right)}`
  }
  if (isNeqExpr(node)) {
    return `${astToLaTeX(node.left)} \\neq ${astToLaTeX(node.right)}`
  }
  if (isMaleExpr(node)) {
    return `\\male{${astToLaTeX(node.operand)}}`
  }
  if (isFemaleExpr(node)) {
    return `${astToLaTeX(node.operand)}\\female`
  }
  if (isNotExpr(node)) {
    return `\\lnot ${astToLaTeX(node.operand)}`
  }
  if (isPowerExpr(node)) {
    return `${astToLaTeX(node.base)}^{${node.exponent}}`
  }
  if (isSetExpr(node)) {
    return `\\{${node.elements.map(astToLaTeX).join(', ')}\\}`
  }
  if (isInfinityExpr(node)) {
    return '\\infty'
  }
  if (isNumExpr(node)) {
    return String(node.value)
  }
  if (isIdentExpr(node)) {
    return node.name
  }
  if (isAbitLitExpr(node)) {
    return `\\texttt{'${node.value}'}`
  }
  if (isStringLitExpr(node)) {
    return `\\text{"${node.value}"}`
  }
  if (isBracketExpr(node)) {
    return node.side === 'left' ? '[' : ']'
  }
  return `\\text{<unknown>}`
}

/**
 * Convert AST string representation to LaTeX
 */
export function stringToLaTeX(str: string): string {
  return str
    .replace(/∞/g, '\\infty')
    .replace(/→/g, '\\to')
    .replace(/->/g, '\\to')
    .replace(/♂/g, '\\male{}')
    .replace(/♀/g, '\\female{}')
    .replace(/≠/g, '\\neq')
    .replace(/!=/g, '\\neq')
    .replace(/¬/g, '\\lnot ')
    .replace(/!/g, '\\lnot ')
}

/**
 * Export proof to LaTeX format
 */
export function exportToLaTeX(
  result: ProofResult,
  goal?: ASTNode,
  options: LaTeXExportOptions = {}
): string {
  const {
    standalone = false,
    useProofEnvironment = true,
    includeAxiomDefinitions = false,
    documentClass = 'article',
    language = 'ru',
  } = options

  const lines: string[] = []

  // Preamble for standalone document
  if (standalone) {
    lines.push(`\\documentclass{${documentClass}}`)
    lines.push('\\usepackage{amsmath,amssymb,amsthm}')
    if (language === 'ru') {
      lines.push('\\usepackage[T2A]{fontenc}')
      lines.push('\\usepackage[utf8]{inputenc}')
      lines.push('\\usepackage[russian]{babel}')
    }
    lines.push('')
    lines.push('% Custom commands for МТС notation')
    lines.push('\\newcommand{\\male}[1]{\\text{♂}#1}')
    lines.push('\\newcommand{\\female}{\\text{♀}}')
    lines.push('')
    lines.push('\\begin{document}')
    lines.push('')
  }

  // Title
  const title = language === 'ru' ? 'Доказательство' : 'Proof'
  lines.push(`\\section*{${title}}`)
  lines.push('')

  // Goal
  if (goal) {
    const goalLabel = language === 'ru' ? 'Цель' : 'Goal'
    lines.push(`\\textbf{${goalLabel}:} $${astToLaTeX(goal)}$`)
    lines.push('')
  }

  // Result
  const resultLabel = language === 'ru' ? 'Результат' : 'Result'
  const successText = language === 'ru' ? 'Доказано' : 'Proven'
  const failureText = language === 'ru' ? 'Не доказано' : 'Not proven'
  lines.push(`\\textbf{${resultLabel}:} ${result.success ? successText : failureText}`)
  lines.push('')

  // Proof steps
  if (result.proofSteps && result.proofSteps.length > 0) {
    if (useProofEnvironment) {
      lines.push('\\begin{proof}')
    } else {
      const stepsLabel = language === 'ru' ? 'Шаги доказательства' : 'Proof Steps'
      lines.push(`\\subsection*{${stepsLabel}}`)
    }
    lines.push('\\begin{enumerate}')

    for (const step of result.proofSteps) {
      let stepText = `\\item ${step.action}`
      if (step.axiom) {
        stepText += ` \\textit{(${step.axiom.id}: ${step.axiom.name})}`
      }
      if (step.before && step.after) {
        stepText += `\n    \\begin{align*}`
        stepText += `\n      ${stringToLaTeX(step.before)} &\\Rightarrow ${stringToLaTeX(step.after)}`
        stepText += `\n    \\end{align*}`
      }
      if (step.details) {
        stepText += `\n    \\textit{${step.details}}`
      }
      lines.push(stepText)
    }

    lines.push('\\end{enumerate}')
    if (useProofEnvironment) {
      lines.push('\\end{proof}')
    }
    lines.push('')
  }

  // Applied axioms
  if (result.appliedAxioms && result.appliedAxioms.length > 0) {
    const axiomsLabel = language === 'ru' ? 'Примененные аксиомы' : 'Applied Axioms'
    lines.push(`\\subsection*{${axiomsLabel}}`)
    lines.push('\\begin{itemize}')
    const uniqueAxioms = [...new Set(result.appliedAxioms.map(a => a.id))]
    for (const axiomId of uniqueAxioms) {
      const axiom = AXIOMS[axiomId]
      lines.push(`\\item \\textbf{${axiom.id}:} ${axiom.name} -- $${stringToLaTeX(axiom.formula)}$`)
    }
    lines.push('\\end{itemize}')
    lines.push('')
  }

  // Hints for failed proofs
  if (!result.success && result.hints && result.hints.length > 0) {
    const hintsLabel = language === 'ru' ? 'Подсказки' : 'Hints'
    lines.push(`\\subsection*{${hintsLabel}}`)
    lines.push('\\begin{itemize}')
    for (const hint of result.hints) {
      lines.push(`\\item ${hint.message}`)
    }
    lines.push('\\end{itemize}')
    lines.push('')
  }

  // Axiom definitions appendix
  if (includeAxiomDefinitions) {
    const appendixLabel =
      language === 'ru' ? 'Приложение: Система аксиом МТС' : 'Appendix: MTS Axiom System'
    lines.push(`\\section*{${appendixLabel}}`)
    lines.push('\\begin{description}')
    for (const [id, axiom] of Object.entries(AXIOMS)) {
      lines.push(`\\item[${id}] \\textbf{${axiom.name}}: $${stringToLaTeX(axiom.formula)}$`)
      lines.push(`  \\\\\\textit{${axiom.description}}`)
    }
    lines.push('\\end{description}')
    lines.push('')
  }

  // Close standalone document
  if (standalone) {
    lines.push('\\end{document}')
  }

  return lines.join('\n')
}

/**
 * Export proof to human-readable text format
 */
export function exportToText(
  result: ProofResult,
  goal?: ASTNode,
  options: TextExportOptions = {}
): string {
  const {
    includeStepNumbers = true,
    includeTimestamps = false,
    includeAxiomDescriptions = true,
    language = 'ru',
    lineSeparator = '\n',
  } = options

  const lines: string[] = []
  const sep = '─'.repeat(60)

  // Header
  const title = language === 'ru' ? 'ДОКАЗАТЕЛЬСТВО МТС' : 'MTS PROOF'
  lines.push(sep)
  lines.push(title)
  lines.push(sep)

  // Timestamp
  if (includeTimestamps) {
    const timestamp = new Date().toISOString()
    const timestampLabel = language === 'ru' ? 'Время' : 'Timestamp'
    lines.push(`${timestampLabel}: ${timestamp}`)
  }

  // Goal
  if (goal) {
    const goalLabel = language === 'ru' ? 'Цель' : 'Goal'
    lines.push(`${goalLabel}: ${toCanonicalString(goal)}`)
  }

  // Result
  const resultLabel = language === 'ru' ? 'Результат' : 'Result'
  const successText = language === 'ru' ? '✓ Доказано' : '✓ Proven'
  const failureText = language === 'ru' ? '✗ Не доказано' : '✗ Not proven'
  lines.push(`${resultLabel}: ${result.success ? successText : failureText}`)
  lines.push('')

  // Proof steps
  if (result.proofSteps && result.proofSteps.length > 0) {
    const stepsLabel = language === 'ru' ? 'Шаги доказательства:' : 'Proof Steps:'
    lines.push(stepsLabel)
    lines.push('')

    for (const step of result.proofSteps) {
      let stepLine = ''
      if (includeStepNumbers) {
        stepLine += `[${step.index}] `
      }
      stepLine += step.action
      lines.push(stepLine)

      if (step.before && step.after) {
        lines.push(`    ${step.before}`)
        lines.push(`    ⟹  ${step.after}`)
      }

      if (step.axiom) {
        const axiomLine = `    Аксиома: ${step.axiom.id} - ${step.axiom.name}`
        lines.push(axiomLine)
        if (includeAxiomDescriptions) {
          lines.push(`    Формула: ${step.axiom.formula}`)
        }
      }

      if (step.details) {
        lines.push(`    Детали: ${step.details}`)
      }

      lines.push('')
    }
  }

  // Applied axioms summary
  if (result.appliedAxioms && result.appliedAxioms.length > 0) {
    const axiomsLabel = language === 'ru' ? 'Примененные аксиомы:' : 'Applied Axioms:'
    lines.push(axiomsLabel)
    const axiomCounts = new Map<AxiomId, number>()
    for (const axiom of result.appliedAxioms) {
      axiomCounts.set(axiom.id, (axiomCounts.get(axiom.id) || 0) + 1)
    }
    for (const [id, count] of axiomCounts) {
      const axiom = AXIOMS[id]
      lines.push(`  • ${id}: ${axiom.name} (${count}x)`)
    }
    lines.push('')
  }

  // Hints for failed proofs
  if (!result.success && result.hints && result.hints.length > 0) {
    const hintsLabel = language === 'ru' ? 'Подсказки:' : 'Hints:'
    lines.push(hintsLabel)
    for (const hint of result.hints) {
      lines.push(`  • ${hint.message}`)
    }
    lines.push('')
  }

  lines.push(sep)

  return lines.join(lineSeparator)
}

/**
 * Export proof to JSON format with full tracing
 */
export function exportToJSON(
  result: ProofResult,
  goal?: ASTNode,
  state?: ProverState,
  options: JSONExportOptions = {}
): string {
  const {
    pretty = true,
    includeAST = false,
    includeState = false,
    includeTimestamps = true,
  } = options

  // Build export data
  const exportData: ProofExportData = {
    version: '1.0',
    exportedAt: includeTimestamps ? new Date().toISOString() : '',
    goal: goal ? toCanonicalString(goal) : '',
    success: result.success,
    steps: [],
    appliedAxioms: [],
  }

  // Add proof steps
  if (result.proofSteps) {
    exportData.steps = result.proofSteps.map(step => ({
      index: step.index,
      action: step.action,
      before: step.before,
      after: step.after,
      axiomId: step.axiom?.id,
      axiomName: step.axiom?.name,
      axiomFormula: step.axiom?.formula,
      details: step.details,
    }))
  }

  // Add applied axioms with counts
  if (result.appliedAxioms) {
    const axiomCounts = new Map<AxiomId, number>()
    for (const axiom of result.appliedAxioms) {
      axiomCounts.set(axiom.id, (axiomCounts.get(axiom.id) || 0) + 1)
    }
    for (const [id, count] of axiomCounts) {
      const axiom = AXIOMS[id]
      exportData.appliedAxioms.push({
        id,
        name: axiom.name,
        formula: axiom.formula,
        description: axiom.description,
        count,
      })
    }
  }

  // Add hints
  if (result.hints) {
    exportData.hints = result.hints.map(hint => hint.message)
  }

  // Add prover state
  if (includeState && state) {
    exportData.state = {
      definitionsCount: state.definitions.size,
      definitions: Array.from(state.definitions.keys()),
      factsCount: state.facts.size,
      equalitiesCount: state.provenEqualities.length,
      implicationsCount: state.provenImplications.length,
    }
  }

  // Add AST
  if (includeAST && goal) {
    exportData.ast = goal
  }

  // Remove empty timestamp if not requested
  if (!includeTimestamps) {
    delete (exportData as Record<string, unknown>).exportedAt
  }

  return pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)
}

/**
 * Node in the DOT graph
 */
interface DotNode {
  id: string
  label: string
  shape: string
  color: string
  style?: string
}

/**
 * Edge in the DOT graph
 */
interface DotEdge {
  from: string
  to: string
  label?: string
  color?: string
  style?: string
}

/**
 * Export proof to DOT graph format for Graphviz visualization
 */
export function exportToDOT(
  result: ProofResult,
  goal?: ASTNode,
  options: DOTExportOptions = {}
): string {
  const {
    rankdir = 'TB',
    includeAxiomLabels = true,
    nodeShape = 'box',
    colorScheme = 'default',
    includeLegend = true,
  } = options

  const nodes: DotNode[] = []
  const edges: DotEdge[] = []

  // Color schemes
  const colors = {
    default: {
      goal: '#e3f2fd',
      step: '#fff3e0',
      axiom: '#e8f5e9',
      success: '#c8e6c9',
      failure: '#ffcdd2',
      edge: '#666666',
    },
    colorful: {
      goal: '#bbdefb',
      step: '#ffe0b2',
      axiom: '#c8e6c9',
      success: '#a5d6a7',
      failure: '#ef9a9a',
      edge: '#1565c0',
    },
    monochrome: {
      goal: '#e0e0e0',
      step: '#f5f5f5',
      axiom: '#eeeeee',
      success: '#bdbdbd',
      failure: '#9e9e9e',
      edge: '#424242',
    },
  }

  const c = colors[colorScheme]

  // Add goal node
  if (goal) {
    nodes.push({
      id: 'goal',
      label: `Цель:\\n${escapeLabel(toCanonicalString(goal))}`,
      shape: 'ellipse',
      color: c.goal,
      style: 'filled',
    })
  }

  // Add proof step nodes and edges
  if (result.proofSteps) {
    let previousNodeId = 'goal'

    for (let i = 0; i < result.proofSteps.length; i++) {
      const step = result.proofSteps[i]
      const nodeId = `step_${i}`

      // Build node label
      let label = `Шаг ${step.index}:\\n${escapeLabel(step.action)}`
      if (step.axiom) {
        label += `\\n[${step.axiom.id}]`
      }

      nodes.push({
        id: nodeId,
        label,
        shape: nodeShape,
        color: step.axiom ? c.axiom : c.step,
        style: 'filled',
      })

      // Add edge from previous step
      if (previousNodeId) {
        const edgeLabel = includeAxiomLabels && step.axiom ? step.axiom.id : undefined
        edges.push({
          from: previousNodeId,
          to: nodeId,
          label: edgeLabel,
          color: c.edge,
        })
      }

      previousNodeId = nodeId
    }

    // Add result node
    const resultNodeId = 'result'
    nodes.push({
      id: resultNodeId,
      label: result.success ? '✓ Доказано' : '✗ Не доказано',
      shape: 'ellipse',
      color: result.success ? c.success : c.failure,
      style: 'filled,bold',
    })

    if (previousNodeId) {
      edges.push({
        from: previousNodeId,
        to: resultNodeId,
        color: c.edge,
        style: result.success ? 'bold' : 'dashed',
      })
    }
  }

  // Build DOT output
  const lines: string[] = []
  lines.push('digraph Proof {')
  lines.push(`  rankdir=${rankdir};`)
  lines.push('  node [fontname="Arial"];')
  lines.push('  edge [fontname="Arial"];')
  lines.push('')

  // Add nodes
  for (const node of nodes) {
    let attrs = `label="${node.label}", shape=${node.shape}, fillcolor="${node.color}"`
    if (node.style) {
      attrs += `, style="${node.style}"`
    }
    lines.push(`  ${node.id} [${attrs}];`)
  }
  lines.push('')

  // Add edges
  for (const edge of edges) {
    let attrs = ''
    if (edge.label) {
      attrs += `label="${edge.label}"`
    }
    if (edge.color) {
      attrs += attrs ? ', ' : ''
      attrs += `color="${edge.color}"`
    }
    if (edge.style) {
      attrs += attrs ? ', ' : ''
      attrs += `style="${edge.style}"`
    }
    const attrStr = attrs ? ` [${attrs}]` : ''
    lines.push(`  ${edge.from} -> ${edge.to}${attrStr};`)
  }

  // Add legend
  if (includeLegend) {
    lines.push('')
    lines.push('  // Legend')
    lines.push('  subgraph cluster_legend {')
    lines.push('    label="Легенда";')
    lines.push('    style=dashed;')
    lines.push(
      `    legend_goal [label="Цель", shape=ellipse, fillcolor="${c.goal}", style=filled];`
    )
    lines.push(
      `    legend_step [label="Шаг", shape=${nodeShape}, fillcolor="${c.step}", style=filled];`
    )
    lines.push(
      `    legend_axiom [label="Аксиома", shape=${nodeShape}, fillcolor="${c.axiom}", style=filled];`
    )
    lines.push(
      `    legend_success [label="Успех", shape=ellipse, fillcolor="${c.success}", style=filled];`
    )
    lines.push(
      `    legend_failure [label="Неудача", shape=ellipse, fillcolor="${c.failure}", style=filled];`
    )
    lines.push('    legend_goal -> legend_step [style=invis];')
    lines.push('    legend_step -> legend_axiom [style=invis];')
    lines.push('    legend_axiom -> legend_success [style=invis];')
    lines.push('    legend_success -> legend_failure [style=invis];')
    lines.push('  }')
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Export proof in the specified format
 */
export function exportProof(
  format: ExportFormat,
  result: ProofResult,
  goal?: ASTNode,
  state?: ProverState,
  options?: LaTeXExportOptions | TextExportOptions | JSONExportOptions | DOTExportOptions
): string {
  switch (format) {
    case 'latex':
      return exportToLaTeX(result, goal, options as LaTeXExportOptions)
    case 'text':
      return exportToText(result, goal, options as TextExportOptions)
    case 'json':
      return exportToJSON(result, goal, state, options as JSONExportOptions)
    case 'dot':
      return exportToDOT(result, goal, options as DOTExportOptions)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

/**
 * Get file extension for export format
 */
export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'latex':
      return 'tex'
    case 'text':
      return 'txt'
    case 'json':
      return 'json'
    case 'dot':
      return 'dot'
    default:
      return 'txt'
  }
}

/**
 * Get MIME type for export format
 */
export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'latex':
      return 'application/x-latex'
    case 'text':
      return 'text/plain'
    case 'json':
      return 'application/json'
    case 'dot':
      return 'text/vnd.graphviz'
    default:
      return 'text/plain'
  }
}
