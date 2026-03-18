/**
 * Link graph projection module for МТС (Meta-Theory of Links)
 *
 * Projects link formulas (association networks) into directed graphs:
 * 1. The center of a link is a graph node
 * 2. The start of a link is an edge with a cross (+)
 * 3. The end of a link is an edge with an arrow (->)
 * 4. Self-closing links loop back to the central node
 *
 * Visual representation of a link `a -> b`:
 *   a *+--*-->* b
 * Where the middle * is the center node of the link `ab`.
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
  isPowerExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isBracketExpr,
} from './ast'
import { astToString } from './ast'
import { escapeLabel } from './utils'

/**
 * Node type in the link graph
 */
export type LinkGraphNodeType =
  | 'link-center' // Center of a link (connection node)
  | 'atom' // Atomic element (identifier, number, infinity, etc.)
  | 'operator' // Binary operator (=, !=, :)
  | 'unary' // Unary operator (!, ♂, ♀)
  | 'set' // Set expression
  | 'power' // Power expression

/**
 * A node in the link graph
 */
export interface LinkGraphNode {
  /** Unique node identifier */
  id: string
  /** Display label */
  label: string
  /** Node type for styling */
  nodeType: LinkGraphNodeType
  /** Original AST node reference */
  astNode?: ASTNode
}

/**
 * Edge type in the link graph
 */
export type LinkGraphEdgeType =
  | 'link-start' // Start of link: edge with cross (+)
  | 'link-end' // End of link: edge with arrow (->)
  | 'self-start' // Self-closing start (♂x loops back)
  | 'self-end' // Self-closing end (x♀ loops back)
  | 'relation' // Structural relation (=, !=, :)
  | 'member' // Set membership

/**
 * An edge in the link graph
 */
export interface LinkGraphEdge {
  /** Unique edge identifier */
  id: string
  /** Source node ID */
  source: string
  /** Target node ID */
  target: string
  /** Edge type for styling */
  edgeType: LinkGraphEdgeType
  /** Display label */
  label?: string
}

/**
 * Complete link graph representation
 */
export interface LinkGraph {
  /** All nodes */
  nodes: LinkGraphNode[]
  /** All edges */
  edges: LinkGraphEdge[]
}

/**
 * Internal state for graph construction
 */
interface GraphBuilderState {
  nodes: Map<string, LinkGraphNode>
  edges: LinkGraphEdge[]
  nodeCounter: number
}

/**
 * Generate a unique node ID
 */
function nextNodeId(state: GraphBuilderState, prefix: string): string {
  state.nodeCounter++
  return `${prefix}_${state.nodeCounter}`
}

/**
 * Get a short label for an AST node (for display in graph)
 */
function getNodeLabel(node: ASTNode): string {
  if (isIdentExpr(node)) return node.name
  if (isInfinityExpr(node)) return '∞'
  if (isNumExpr(node)) return String(node.value)
  if (isAbitLitExpr(node)) return `'${node.value}'`
  if (isStringLitExpr(node)) return `"${node.value}"`
  if (isBracketExpr(node)) return node.side === 'left' ? '[' : ']'
  return astToString(node)
}

/**
 * Project an AST node into the link graph.
 * Returns the ID of the node representing this expression in the graph.
 */
function projectNode(node: ASTNode, state: GraphBuilderState): string {
  // Link expression: a -> b
  // This is the core projection:
  //   - Create a center node for the link
  //   - Project left and right sub-expressions
  //   - Add edge from left to center (link-start, with +)
  //   - Add edge from center to right (link-end, with ->)
  if (isLinkExpr(node)) {
    const centerId = nextNodeId(state, 'link')
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: '',
      nodeType: 'link-center',
      astNode: node,
    })

    state.edges.push({
      id: `e_${leftId}_${centerId}`,
      source: leftId,
      target: centerId,
      edgeType: 'link-start',
      label: '+',
    })

    state.edges.push({
      id: `e_${centerId}_${rightId}`,
      source: centerId,
      target: rightId,
      edgeType: 'link-end',
    })

    return centerId
  }

  // Male self-closing: ♂x
  // ♂x : (♂x -> x) — start self-closes to x
  // The center node IS ♂x, with a self-loop for the start
  if (isMaleExpr(node)) {
    const centerId = nextNodeId(state, 'male')
    const operandId = projectNode(node.operand, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: `♂${getNodeLabel(node.operand)}`,
      nodeType: 'unary',
      astNode: node,
    })

    // Self-closing start: loop from center back to center
    state.edges.push({
      id: `e_${centerId}_self_start`,
      source: centerId,
      target: centerId,
      edgeType: 'self-start',
      label: '+',
    })

    // End goes to the operand
    state.edges.push({
      id: `e_${centerId}_${operandId}`,
      source: centerId,
      target: operandId,
      edgeType: 'link-end',
    })

    return centerId
  }

  // Female self-closing: x♀
  // x♀ : (x -> x♀) — end self-closes to x
  if (isFemaleExpr(node)) {
    const centerId = nextNodeId(state, 'female')
    const operandId = projectNode(node.operand, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: `${getNodeLabel(node.operand)}♀`,
      nodeType: 'unary',
      astNode: node,
    })

    // Start from the operand
    state.edges.push({
      id: `e_${operandId}_${centerId}`,
      source: operandId,
      target: centerId,
      edgeType: 'link-start',
      label: '+',
    })

    // Self-closing end: loop from center back to center
    state.edges.push({
      id: `e_${centerId}_self_end`,
      source: centerId,
      target: centerId,
      edgeType: 'self-end',
    })

    return centerId
  }

  // Not expression: !x
  if (isNotExpr(node)) {
    const centerId = nextNodeId(state, 'not')
    const operandId = projectNode(node.operand, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: `!${getNodeLabel(node.operand)}`,
      nodeType: 'unary',
      astNode: node,
    })

    state.edges.push({
      id: `e_${operandId}_${centerId}_inv`,
      source: operandId,
      target: centerId,
      edgeType: 'relation',
      label: '!',
    })

    return centerId
  }

  // Definition: s : F
  if (isDefExpr(node)) {
    const centerId = nextNodeId(state, 'def')
    const nameId = projectNode(node.name, state)
    const formId = projectNode(node.form, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: ':',
      nodeType: 'operator',
      astNode: node,
    })

    state.edges.push({
      id: `e_${nameId}_${centerId}`,
      source: nameId,
      target: centerId,
      edgeType: 'relation',
      label: 'имя',
    })

    state.edges.push({
      id: `e_${centerId}_${formId}`,
      source: centerId,
      target: formId,
      edgeType: 'relation',
      label: 'форма',
    })

    return centerId
  }

  // Equality: A = B
  if (isEqExpr(node)) {
    const centerId = nextNodeId(state, 'eq')
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: '=',
      nodeType: 'operator',
      astNode: node,
    })

    state.edges.push({
      id: `e_${leftId}_${centerId}`,
      source: leftId,
      target: centerId,
      edgeType: 'relation',
    })

    state.edges.push({
      id: `e_${centerId}_${rightId}`,
      source: centerId,
      target: rightId,
      edgeType: 'relation',
    })

    return centerId
  }

  // Inequality: A != B
  if (isNeqExpr(node)) {
    const centerId = nextNodeId(state, 'neq')
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: '!=',
      nodeType: 'operator',
      astNode: node,
    })

    state.edges.push({
      id: `e_${leftId}_${centerId}`,
      source: leftId,
      target: centerId,
      edgeType: 'relation',
    })

    state.edges.push({
      id: `e_${centerId}_${rightId}`,
      source: centerId,
      target: rightId,
      edgeType: 'relation',
    })

    return centerId
  }

  // Power expression: a^n — expand as repeated links
  if (isPowerExpr(node)) {
    const centerId = nextNodeId(state, 'pow')
    const baseId = projectNode(node.base, state)

    state.nodes.set(centerId, {
      id: centerId,
      label: `^${node.exponent}`,
      nodeType: 'power',
      astNode: node,
    })

    state.edges.push({
      id: `e_${baseId}_${centerId}`,
      source: baseId,
      target: centerId,
      edgeType: 'relation',
      label: `^${node.exponent}`,
    })

    return centerId
  }

  // Set expression: {A, B, C}
  if (isSetExpr(node)) {
    const centerId = nextNodeId(state, 'set')

    state.nodes.set(centerId, {
      id: centerId,
      label: '{…}',
      nodeType: 'set',
      astNode: node,
    })

    for (const element of node.elements) {
      const elementId = projectNode(element, state)
      state.edges.push({
        id: `e_${centerId}_${elementId}_member`,
        source: centerId,
        target: elementId,
        edgeType: 'member',
      })
    }

    return centerId
  }

  // Atomic expressions: identifiers, numbers, infinity, literals, brackets
  const label = getNodeLabel(node)

  // Reuse existing atom nodes with the same label
  for (const [existingId, existingNode] of state.nodes) {
    if (existingNode.nodeType === 'atom' && existingNode.label === label) {
      return existingId
    }
  }

  const atomId = nextNodeId(state, 'atom')
  state.nodes.set(atomId, {
    id: atomId,
    label,
    nodeType: 'atom',
    astNode: node,
  })

  return atomId
}

/**
 * Project an AST node (typically a statement expression) into a link graph.
 *
 * @param node - The AST node to project
 * @returns The link graph representation
 */
export function projectToGraph(node: ASTNode): LinkGraph {
  const state: GraphBuilderState = {
    nodes: new Map(),
    edges: [],
    nodeCounter: 0,
  }

  projectNode(node, state)

  return {
    nodes: Array.from(state.nodes.values()),
    edges: state.edges,
  }
}

/**
 * Project multiple statements into a single combined graph.
 *
 * @param nodes - Array of AST nodes to project
 * @returns The combined link graph
 */
export function projectStatementsToGraph(nodes: ASTNode[]): LinkGraph {
  const state: GraphBuilderState = {
    nodes: new Map(),
    edges: [],
    nodeCounter: 0,
  }

  for (const node of nodes) {
    projectNode(node, state)
  }

  return {
    nodes: Array.from(state.nodes.values()),
    edges: state.edges,
  }
}

/**
 * Convert a LinkGraph to Cytoscape.js elements format.
 *
 * @param graph - The link graph
 * @returns Array of Cytoscape element definitions
 */
export function toCytoscapeElements(
  graph: LinkGraph
): Array<{ group: 'nodes' | 'edges'; data: Record<string, string | undefined> }> {
  const elements: Array<{
    group: 'nodes' | 'edges'
    data: Record<string, string | undefined>
  }> = []

  for (const node of graph.nodes) {
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: node.label,
        nodeType: node.nodeType,
      },
    })
  }

  for (const edge of graph.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeType,
        label: edge.label,
      },
    })
  }

  return elements
}

/**
 * Convert a LinkGraph to DOT format for Graphviz rendering.
 *
 * @param graph - The link graph
 * @param title - Optional graph title
 * @returns DOT format string
 */
export function linkGraphToDOT(graph: LinkGraph, title?: string): string {
  const lines: string[] = []
  const graphLabel = title ? `  label="${escapeLabel(title)}";` : ''

  lines.push('digraph LinkGraph {')
  lines.push('  rankdir=LR;')
  lines.push('  node [fontname="Arial"];')
  lines.push('  edge [fontname="Arial"];')
  if (graphLabel) lines.push(graphLabel)
  lines.push('')

  // Node styles by type
  const nodeStyles: Record<LinkGraphNodeType, string> = {
    'link-center': 'shape=circle, style=filled, fillcolor="#e3f2fd", width=0.3, fixedsize=true',
    atom: 'shape=box, style="filled,rounded", fillcolor="#c8e6c9"',
    operator: 'shape=diamond, style=filled, fillcolor="#fff3e0"',
    unary: 'shape=ellipse, style=filled, fillcolor="#f3e5f5"',
    set: 'shape=box, style=filled, fillcolor="#e8eaf6"',
    power: 'shape=box, style=filled, fillcolor="#fce4ec"',
  }

  for (const node of graph.nodes) {
    const style = nodeStyles[node.nodeType]
    const label = node.label ? `label="${escapeLabel(node.label)}"` : 'label=""'
    lines.push(`  ${node.id} [${label}, ${style}];`)
  }

  lines.push('')

  // Edge styles by type
  for (const edge of graph.edges) {
    const attrs: string[] = []

    switch (edge.edgeType) {
      case 'link-start':
        attrs.push('arrowhead=none', 'arrowtail=odot', 'dir=both', 'color="#1565c0"')
        break
      case 'link-end':
        attrs.push('arrowhead=vee', 'color="#1565c0"')
        break
      case 'self-start':
        attrs.push('arrowhead=none', 'arrowtail=odot', 'dir=both', 'color="#7b1fa2"')
        break
      case 'self-end':
        attrs.push('arrowhead=vee', 'color="#7b1fa2"')
        break
      case 'relation':
        attrs.push('arrowhead=vee', 'color="#666666"', 'style=dashed')
        break
      case 'member':
        attrs.push('arrowhead=dot', 'color="#4caf50"', 'style=dotted')
        break
    }

    if (edge.label) {
      attrs.push(`label="${escapeLabel(edge.label)}"`)
    }

    lines.push(`  ${edge.source} -> ${edge.target} [${attrs.join(', ')}];`)
  }

  lines.push('}')

  return lines.join('\n')
}
