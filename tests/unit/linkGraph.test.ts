/**
 * Tests for Link Graph projection module
 */

import { describe, it, expect } from 'vitest'
import {
  projectToGraph,
  projectStatementsToGraph,
  toCytoscapeElements,
  linkGraphToDOT,
} from '../../src/core/linkGraph'
import { parseExpr } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'

describe('LinkGraph', () => {
  describe('projectToGraph', () => {
    it('should project a simple link a -> b', () => {
      const expr = normalize(parseExpr('a -> b'))
      const graph = projectToGraph(expr)

      // Should have: atom 'a', link-center, atom 'b'
      expect(graph.nodes.length).toBe(3)
      expect(graph.edges.length).toBe(2)

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      const centers = graph.nodes.filter(n => n.nodeType === 'link-center')

      expect(atoms.length).toBe(2)
      expect(centers.length).toBe(1)
      expect(atoms.map(a => a.label).sort()).toEqual(['a', 'b'])

      // Check edge types
      const startEdges = graph.edges.filter(e => e.edgeType === 'link-start')
      const endEdges = graph.edges.filter(e => e.edgeType === 'link-end')

      expect(startEdges.length).toBe(1)
      expect(endEdges.length).toBe(1)

      // Start edge goes from 'a' to center
      expect(startEdges[0].source).toBe(atoms.find(a => a.label === 'a')!.id)
      expect(startEdges[0].target).toBe(centers[0].id)

      // End edge goes from center to 'b'
      expect(endEdges[0].source).toBe(centers[0].id)
      expect(endEdges[0].target).toBe(atoms.find(a => a.label === 'b')!.id)
    })

    it('should project infinity expression ∞', () => {
      const expr = normalize(parseExpr('∞'))
      const graph = projectToGraph(expr)

      expect(graph.nodes.length).toBe(1)
      expect(graph.nodes[0].label).toBe('∞')
      expect(graph.nodes[0].nodeType).toBe('atom')
    })

    it('should project chained links a -> b -> c', () => {
      const expr = normalize(parseExpr('a -> b -> c'))
      const graph = projectToGraph(expr)

      // Due to left-associativity: (a -> b) -> c
      // Inner link: a +--*--> b (center1)
      // Outer link: center1 +--*--> c (center2)
      const centers = graph.nodes.filter(n => n.nodeType === 'link-center')
      expect(centers.length).toBe(2)

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(3)
    })

    it('should project male self-closing ♂x', () => {
      const expr = normalize(parseExpr('♂x'))
      const graph = projectToGraph(expr)

      // Should have: atom 'x', unary '♂x'
      const unaryNodes = graph.nodes.filter(n => n.nodeType === 'unary')
      expect(unaryNodes.length).toBe(1)
      expect(unaryNodes[0].label).toBe('♂x')

      // Should have self-closing start edge and link-end edge
      const selfStartEdges = graph.edges.filter(e => e.edgeType === 'self-start')
      const endEdges = graph.edges.filter(e => e.edgeType === 'link-end')

      expect(selfStartEdges.length).toBe(1)
      expect(endEdges.length).toBe(1)

      // Self-start loops on the unary node
      expect(selfStartEdges[0].source).toBe(unaryNodes[0].id)
      expect(selfStartEdges[0].target).toBe(unaryNodes[0].id)
    })

    it('should project female self-closing x♀', () => {
      const expr = normalize(parseExpr('x♀'))
      const graph = projectToGraph(expr)

      const unaryNodes = graph.nodes.filter(n => n.nodeType === 'unary')
      expect(unaryNodes.length).toBe(1)
      expect(unaryNodes[0].label).toBe('x♀')

      // Should have link-start edge and self-closing end edge
      const startEdges = graph.edges.filter(e => e.edgeType === 'link-start')
      const selfEndEdges = graph.edges.filter(e => e.edgeType === 'self-end')

      expect(startEdges.length).toBe(1)
      expect(selfEndEdges.length).toBe(1)

      // Self-end loops on the unary node
      expect(selfEndEdges[0].source).toBe(unaryNodes[0].id)
      expect(selfEndEdges[0].target).toBe(unaryNodes[0].id)
    })

    it('should project equality a = b', () => {
      const expr = normalize(parseExpr('a = b'))
      const graph = projectToGraph(expr)

      const operators = graph.nodes.filter(n => n.nodeType === 'operator')
      expect(operators.length).toBe(1)
      expect(operators[0].label).toBe('=')

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(2)

      // Two relation edges
      const relations = graph.edges.filter(e => e.edgeType === 'relation')
      expect(relations.length).toBe(2)
    })

    it('should project definition s : F', () => {
      const expr = normalize(parseExpr('s : s -> s'))
      const graph = projectToGraph(expr)

      const operators = graph.nodes.filter(n => n.nodeType === 'operator')
      expect(operators.length).toBe(1)
      expect(operators[0].label).toBe(':')
    })

    it('should project negation !x', () => {
      const expr = normalize(parseExpr('!x'))
      const graph = projectToGraph(expr)

      const unaryNodes = graph.nodes.filter(n => n.nodeType === 'unary')
      expect(unaryNodes.length).toBe(1)
    })

    it('should project set expression {a, b, c}', () => {
      const expr = normalize(parseExpr('{a, b, c}'))
      const graph = projectToGraph(expr)

      const setNodes = graph.nodes.filter(n => n.nodeType === 'set')
      expect(setNodes.length).toBe(1)

      const memberEdges = graph.edges.filter(e => e.edgeType === 'member')
      expect(memberEdges.length).toBe(3)
    })

    it('should project power expression a^2 (unnormalized)', () => {
      // Note: normalize() expands a^2 into (a -> a), so test with raw parsed AST
      const expr = parseExpr('a^2')
      const graph = projectToGraph(expr)

      const powerNodes = graph.nodes.filter(n => n.nodeType === 'power')
      expect(powerNodes.length).toBe(1)
      expect(powerNodes[0].label).toBe('^2')
    })

    it('should project normalized power a^2 as link chain', () => {
      const expr = normalize(parseExpr('a^2'))
      const graph = projectToGraph(expr)

      // a^2 normalizes to (a -> a), which is a link with shared atom
      const centers = graph.nodes.filter(n => n.nodeType === 'link-center')
      expect(centers.length).toBe(1)

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(1) // 'a' is reused
    })

    it('should reuse atom nodes with the same label', () => {
      const expr = normalize(parseExpr('a = a'))
      const graph = projectToGraph(expr)

      // Should have only one 'a' atom (reused), plus the '=' operator
      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(1)
      expect(atoms[0].label).toBe('a')
    })

    it('should project numeric constants', () => {
      const expr = normalize(parseExpr('0'))
      const graph = projectToGraph(expr)

      expect(graph.nodes.length).toBe(1)
      expect(graph.nodes[0].label).toBe('0')
      expect(graph.nodes[0].nodeType).toBe('atom')
    })

    it('should project axiom A4: ∞ : (∞ -> ∞)', () => {
      const expr = normalize(parseExpr('∞ : (∞ -> ∞)'))
      const graph = projectToGraph(expr)

      // Should have: atom '∞', link-center, operator ':'
      expect(graph.nodes.length).toBeGreaterThanOrEqual(2)

      const operators = graph.nodes.filter(n => n.nodeType === 'operator')
      expect(operators.some(o => o.label === ':')).toBe(true)
    })
  })

  describe('projectStatementsToGraph', () => {
    it('should project multiple statements into one graph', () => {
      const expr1 = normalize(parseExpr('a -> b'))
      const expr2 = normalize(parseExpr('c -> d'))
      const graph = projectStatementsToGraph([expr1, expr2])

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(4) // a, b, c, d

      const centers = graph.nodes.filter(n => n.nodeType === 'link-center')
      expect(centers.length).toBe(2)
    })

    it('should share atom nodes across statements', () => {
      const expr1 = normalize(parseExpr('a -> b'))
      const expr2 = normalize(parseExpr('b -> c'))
      const graph = projectStatementsToGraph([expr1, expr2])

      // 'b' should be shared
      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      expect(atoms.length).toBe(3) // a, b, c (b is shared)
    })

    it('should handle empty array', () => {
      const graph = projectStatementsToGraph([])
      expect(graph.nodes.length).toBe(0)
      expect(graph.edges.length).toBe(0)
    })
  })

  describe('toCytoscapeElements', () => {
    it('should convert graph to cytoscape format', () => {
      const expr = normalize(parseExpr('a -> b'))
      const graph = projectToGraph(expr)
      const elements = toCytoscapeElements(graph)

      const nodeElements = elements.filter(e => e.group === 'nodes')
      const edgeElements = elements.filter(e => e.group === 'edges')

      expect(nodeElements.length).toBe(graph.nodes.length)
      expect(edgeElements.length).toBe(graph.edges.length)

      // Check node data
      for (const nodeEl of nodeElements) {
        expect(nodeEl.data.id).toBeDefined()
        expect(nodeEl.data.nodeType).toBeDefined()
      }

      // Check edge data
      for (const edgeEl of edgeElements) {
        expect(edgeEl.data.source).toBeDefined()
        expect(edgeEl.data.target).toBeDefined()
        expect(edgeEl.data.edgeType).toBeDefined()
      }
    })

    it('should handle empty graph', () => {
      const graph = projectStatementsToGraph([])
      const elements = toCytoscapeElements(graph)
      expect(elements.length).toBe(0)
    })
  })

  describe('linkGraphToDOT', () => {
    it('should generate valid DOT format', () => {
      const expr = normalize(parseExpr('a -> b'))
      const graph = projectToGraph(expr)
      const dot = linkGraphToDOT(graph)

      expect(dot).toContain('digraph LinkGraph')
      expect(dot).toContain('rankdir=LR')
      expect(dot).toContain('->')
      expect(dot).toContain('}')
    })

    it('should include title when provided', () => {
      const expr = normalize(parseExpr('a -> b'))
      const graph = projectToGraph(expr)
      const dot = linkGraphToDOT(graph, 'Test Graph')

      expect(dot).toContain('label="Test Graph"')
    })

    it('should handle edge types', () => {
      const expr = normalize(parseExpr('a -> b'))
      const graph = projectToGraph(expr)
      const dot = linkGraphToDOT(graph)

      // Link start edge should have odot arrowtail
      expect(dot).toContain('arrowtail=odot')
      // Link end edge should have vee arrowhead
      expect(dot).toContain('arrowhead=vee')
    })

    it('should handle empty graph', () => {
      const graph = projectStatementsToGraph([])
      const dot = linkGraphToDOT(graph)

      expect(dot).toContain('digraph LinkGraph')
      expect(dot).toContain('}')
    })

    it('should escape special characters in labels', () => {
      const expr = normalize(parseExpr('{a, b}'))
      const graph = projectToGraph(expr)
      const dot = linkGraphToDOT(graph)

      // Curly braces should be escaped
      expect(dot).not.toContain('label="{…}"')
      expect(dot).toContain('\\{')
    })
  })
})
