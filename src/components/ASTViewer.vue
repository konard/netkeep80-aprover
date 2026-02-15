<script setup lang="ts">
import { defineProps, defineEmits, ref, computed, watch } from 'vue'
import type { ASTNode, File, SourceLocation } from '../core/ast'

const props = defineProps<{
  ast: File | null
  error: string | null
  highlightedNodeLoc?: SourceLocation | null
}>()

const emit = defineEmits<{
  'node-hover': [loc: SourceLocation | null]
}>()

interface TreeNode {
  id: string
  label: string
  type: string
  children: TreeNode[]
  expanded: boolean
  loc?: SourceLocation
  childCount: number // Total count for lazy loading indicator
}

/**
 * Configuration for lazy loading
 */
const LAZY_LOAD_CONFIG = {
  /** Maximum depth before children are lazy-loaded */
  maxInitialDepth: 10,
  /** Maximum children to render at once before pagination */
  maxChildrenPerPage: 50,
  /** Show "load more" if more than this many children */
  lazyChildThreshold: 20,
}

const expandedNodes = ref<Set<string>>(new Set())

// Track if we've initialized expansion for current AST
const lastAstRef = ref<File | null>(null)

function toggleNode(id: string) {
  if (expandedNodes.value.has(id)) {
    expandedNodes.value.delete(id)
  } else {
    expandedNodes.value.add(id)
  }
  expandedNodes.value = new Set(expandedNodes.value)
}

function isExpanded(id: string): boolean {
  return expandedNodes.value.has(id)
}

// Expand all nodes
function expandAll() {
  if (!treeData.value) return
  const collectIds = (node: TreeNode): string[] => {
    const ids = [node.id]
    for (const child of node.children) {
      ids.push(...collectIds(child))
    }
    return ids
  }
  expandedNodes.value = new Set(collectIds(treeData.value))
}

// Collapse all nodes (except root)
function collapseAll() {
  expandedNodes.value = new Set(['0'])
}

// Collect all node IDs up to a certain depth
function collectInitialExpansion(node: ASTNode, path: string = '0', depth: number = 0): string[] {
  const result: string[] = []
  if (depth <= 3) {
    result.push(path)
  }

  switch (node.type) {
    case 'File':
      ;(node as { statements: ASTNode[] }).statements.forEach((stmt, i) => {
        result.push(...collectInitialExpansion(stmt, `${path}-${i}`, depth + 1))
      })
      break
    case 'Statement':
      result.push(
        ...collectInitialExpansion((node as { expr: ASTNode }).expr, `${path}-0`, depth + 1)
      )
      break
    case 'Link':
    case 'NotLink':
      result.push(
        ...collectInitialExpansion((node as { left: ASTNode }).left, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { right: ASTNode }).right, `${path}-1`, depth + 1)
      )
      break
    case 'Definition':
      result.push(
        ...collectInitialExpansion((node as { name: ASTNode }).name, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { form: ASTNode }).form, `${path}-1`, depth + 1)
      )
      break
    case 'Equality':
    case 'Inequality':
      result.push(
        ...collectInitialExpansion((node as { left: ASTNode }).left, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { right: ASTNode }).right, `${path}-1`, depth + 1)
      )
      break
    case 'Male':
    case 'Female':
    case 'Not':
      result.push(
        ...collectInitialExpansion((node as { operand: ASTNode }).operand, `${path}-0`, depth + 1)
      )
      break
    case 'Power':
      result.push(
        ...collectInitialExpansion((node as { base: ASTNode }).base, `${path}-0`, depth + 1)
      )
      break
    case 'Set':
      ;(node as { elements: ASTNode[] }).elements.forEach((el, i) => {
        result.push(...collectInitialExpansion(el, `${path}-${i}`, depth + 1))
      })
      break
  }

  return result
}

/**
 * Count the number of children an AST node has
 */
function countNodeChildren(node: ASTNode): number {
  switch (node.type) {
    case 'File':
      return (node as { statements: ASTNode[] }).statements.length
    case 'Statement':
      return 1
    case 'Link':
    case 'NotLink':
    case 'Definition':
    case 'Equality':
    case 'Inequality':
      return 2
    case 'Male':
    case 'Female':
    case 'Not':
    case 'Power':
      return 1
    case 'Set':
      return (node as { elements: ASTNode[] }).elements.length
    default:
      return 0
  }
}

/**
 * Map to store original AST nodes for lazy loading
 * Key: node path id, Value: original AST node
 */
const astNodeMap = ref<Map<string, ASTNode>>(new Map())

/**
 * Track how many children are loaded for each node (for pagination)
 */
const loadedChildrenCount = ref<Map<string, number>>(new Map())

/**
 * Convert AST to tree node with lazy loading support
 * Children are only fully converted when the node is expanded
 */
function astNodeToTreeNode(node: ASTNode, path: string = '0', depth: number = 0): TreeNode {
  // Store reference to original node for lazy loading
  astNodeMap.value.set(path, node)

  const childCount = countNodeChildren(node)

  const result: TreeNode = {
    id: path,
    label: getNodeLabel(node),
    type: node.type,
    children: [],
    expanded: true,
    loc: node.loc,
    childCount,
  }

  // For depth optimization: only build immediate children up to maxInitialDepth
  // After that, children will be built on-demand when expanded
  const shouldBuildChildren = depth < LAZY_LOAD_CONFIG.maxInitialDepth

  if (shouldBuildChildren) {
    result.children = buildChildrenForNode(node, path, depth)
  }

  return result
}

/**
 * Build children array for a given AST node
 */
function buildChildrenForNode(node: ASTNode, parentPath: string, parentDepth: number): TreeNode[] {
  const children: TreeNode[] = []

  switch (node.type) {
    case 'File':
      ;(node as { statements: ASTNode[] }).statements.forEach((stmt, i) => {
        children.push(astNodeToTreeNode(stmt, `${parentPath}-${i}`, parentDepth + 1))
      })
      break
    case 'Statement':
      children.push(
        astNodeToTreeNode((node as { expr: ASTNode }).expr, `${parentPath}-0`, parentDepth + 1)
      )
      break
    case 'Link':
    case 'NotLink':
      children.push(
        astNodeToTreeNode((node as { left: ASTNode }).left, `${parentPath}-0`, parentDepth + 1)
      )
      children.push(
        astNodeToTreeNode((node as { right: ASTNode }).right, `${parentPath}-1`, parentDepth + 1)
      )
      break
    case 'Definition':
      children.push(
        astNodeToTreeNode((node as { name: ASTNode }).name, `${parentPath}-0`, parentDepth + 1)
      )
      children.push(
        astNodeToTreeNode((node as { form: ASTNode }).form, `${parentPath}-1`, parentDepth + 1)
      )
      break
    case 'Equality':
    case 'Inequality':
      children.push(
        astNodeToTreeNode((node as { left: ASTNode }).left, `${parentPath}-0`, parentDepth + 1)
      )
      children.push(
        astNodeToTreeNode((node as { right: ASTNode }).right, `${parentPath}-1`, parentDepth + 1)
      )
      break
    case 'Male':
    case 'Female':
    case 'Not':
      children.push(
        astNodeToTreeNode(
          (node as { operand: ASTNode }).operand,
          `${parentPath}-0`,
          parentDepth + 1
        )
      )
      break
    case 'Power':
      children.push(
        astNodeToTreeNode((node as { base: ASTNode }).base, `${parentPath}-0`, parentDepth + 1)
      )
      break
    case 'Set':
      ;(node as { elements: ASTNode[] }).elements.forEach((el, i) => {
        children.push(astNodeToTreeNode(el, `${parentPath}-${i}`, parentDepth + 1))
      })
      break
  }

  return children
}

/**
 * Ensure children are loaded for a node (lazy loading trigger)
 */
function ensureChildrenLoaded(treeNode: TreeNode, depth: number): void {
  if (treeNode.childCount > 0 && treeNode.children.length === 0) {
    const astNode = astNodeMap.value.get(treeNode.id)
    if (astNode) {
      treeNode.children = buildChildrenForNode(astNode, treeNode.id, depth)
    }
  }
}

/**
 * Load more children for pagination
 */
function loadMoreChildren(nodeId: string): void {
  const current = loadedChildrenCount.value.get(nodeId) || LAZY_LOAD_CONFIG.maxChildrenPerPage
  loadedChildrenCount.value.set(nodeId, current + LAZY_LOAD_CONFIG.maxChildrenPerPage)
  // Trigger reactivity
  loadedChildrenCount.value = new Map(loadedChildrenCount.value)
}

/**
 * Get the number of visible children for a node (considering pagination)
 */
function getVisibleChildrenCount(nodeId: string, totalChildren: number): number {
  const loaded = loadedChildrenCount.value.get(nodeId)
  if (loaded !== undefined) {
    return Math.min(loaded, totalChildren)
  }
  return Math.min(LAZY_LOAD_CONFIG.maxChildrenPerPage, totalChildren)
}

function getNodeLabel(node: ASTNode): string {
  switch (node.type) {
    case 'File':
      return 'File'
    case 'Statement':
      return 'Statement'
    case 'Link':
      return '->'
    case 'NotLink':
      return '!->'
    case 'Definition':
      return ':'
    case 'Equality':
      return '='
    case 'Inequality':
      return '!='
    case 'Male':
      return '♂'
    case 'Female':
      return '♀'
    case 'Not':
      return '!'
    case 'Power':
      return `^${(node as { exponent: number }).exponent}`
    case 'Set':
      return '{...}'
    case 'Infinity':
      return '∞'
    case 'Num':
      return String((node as { value: number }).value)
    case 'Identifier':
      return (node as { name: string }).name
    case 'AbitLit':
      return `'${(node as { value: string }).value}'`
    case 'StringLit':
      return `"${(node as { value: string }).value}"`
    case 'Bracket':
      return (node as { side: string }).side === 'left' ? '[' : ']'
    default:
      return node.type
  }
}

function getNodeTypeClass(type: string): string {
  switch (type) {
    case 'File':
    case 'Statement':
      return 'node-structural'
    case 'Link':
    case 'NotLink':
      return 'node-link'
    case 'Definition':
      return 'node-define'
    case 'Equality':
    case 'Inequality':
      return 'node-equality'
    case 'Male':
    case 'Female':
    case 'Infinity':
      return 'node-symbol'
    case 'Not':
      return 'node-not'
    case 'Num':
      return 'node-number'
    case 'Identifier':
      return 'node-identifier'
    default:
      return ''
  }
}

// Format location for tooltip
function formatLocation(loc?: SourceLocation): string {
  if (!loc) return ''
  if (loc.start.line === loc.end.line) {
    return `Line ${loc.start.line}, col ${loc.start.column}-${loc.end.column}`
  }
  return `Lines ${loc.start.line}-${loc.end.line}`
}

// Handle mouse enter on node
function handleNodeEnter(loc?: SourceLocation) {
  emit('node-hover', loc || null)
}

// Handle mouse leave from node
function handleNodeLeave() {
  emit('node-hover', null)
}

// Check if a node location contains the cursor position
function isNodeHighlighted(nodeLoc?: SourceLocation): boolean {
  if (!nodeLoc || !props.highlightedNodeLoc) return false

  const cursor = props.highlightedNodeLoc.start
  const nodeStart = nodeLoc.start
  const nodeEnd = nodeLoc.end

  // Check if cursor is within node's location range
  // Line-based check first
  if (cursor.line < nodeStart.line || cursor.line > nodeEnd.line) {
    return false
  }

  // If on the same line, check column
  if (cursor.line === nodeStart.line && cursor.line === nodeEnd.line) {
    return cursor.column >= nodeStart.column && cursor.column <= nodeEnd.column
  }

  // If on start line
  if (cursor.line === nodeStart.line) {
    return cursor.column >= nodeStart.column
  }

  // If on end line
  if (cursor.line === nodeEnd.line) {
    return cursor.column <= nodeEnd.column
  }

  // In between lines
  return true
}

const treeData = computed<TreeNode | null>(() => {
  if (!props.ast) return null
  return astNodeToTreeNode(props.ast)
})

// Initialize expansion when AST changes
watch(
  () => props.ast,
  newAst => {
    if (newAst && newAst !== lastAstRef.value) {
      lastAstRef.value = newAst
      // Clear lazy loading caches
      astNodeMap.value.clear()
      loadedChildrenCount.value.clear()
      const initialIds = collectInitialExpansion(newAst)
      expandedNodes.value = new Set(initialIds)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="ast-viewer">
    <div class="ast-header">
      <span class="ast-icon">AST</span>
      <span class="ast-title">Abstract Syntax Tree</span>
      <div class="ast-controls">
        <button class="ast-btn" title="Expand all nodes" @click="expandAll">
          <span class="btn-icon">⊞</span>
          <span class="btn-text">Expand All</span>
        </button>
        <button class="ast-btn" title="Collapse all nodes" @click="collapseAll">
          <span class="btn-icon">⊟</span>
          <span class="btn-text">Collapse All</span>
        </button>
      </div>
    </div>

    <div v-if="treeData" class="ast-content">
      <div class="tree-root">
        <TreeNodeComponent
          :node="treeData"
          :depth="0"
          :is-expanded="isExpanded"
          :toggle-node="toggleNode"
          :get-node-type-class="getNodeTypeClass"
          :format-location="formatLocation"
          :on-node-enter="handleNodeEnter"
          :on-node-leave="handleNodeLeave"
          :is-node-highlighted="isNodeHighlighted"
          :ensure-children-loaded="ensureChildrenLoaded"
          :get-visible-children-count="getVisibleChildrenCount"
          :load-more-children="loadMoreChildren"
        />
      </div>
      <div v-if="error" class="ast-error-footer">
        <span class="error-icon">!</span>
        <span>Parse error</span>
      </div>
    </div>

    <div v-else-if="error" class="ast-error">
      <span class="error-icon">!</span>
      <span>Parse error</span>
    </div>

    <div v-else class="ast-empty">
      <span>No AST to display</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

const TreeNodeComponent = defineComponent({
  name: 'TreeNodeComponent',
  props: {
    node: { type: Object, required: true },
    depth: { type: Number, required: true },
    isExpanded: { type: Function, required: true },
    toggleNode: { type: Function, required: true },
    getNodeTypeClass: { type: Function, required: true },
    formatLocation: { type: Function, required: true },
    onNodeEnter: { type: Function, required: true },
    onNodeLeave: { type: Function, required: true },
    isNodeHighlighted: { type: Function, required: true },
    ensureChildrenLoaded: { type: Function, required: true },
    getVisibleChildrenCount: { type: Function, required: true },
    loadMoreChildren: { type: Function, required: true },
  },
  render() {
    const node = this.node as TreeNode
    const hasChildren = node.childCount > 0
    const expanded = this.isExpanded(node.id)
    const locTooltip = this.formatLocation(node.loc)
    const indentSize = this.depth * 1.1 // 1.1rem per depth level
    const highlighted = this.isNodeHighlighted(node.loc)

    // Lazy load children when expanding
    if (expanded && hasChildren && node.children.length === 0) {
      this.ensureChildrenLoaded(node, this.depth)
    }

    // Calculate visible children for pagination
    const visibleCount = this.getVisibleChildrenCount(node.id, node.children.length)
    const visibleChildren = node.children.slice(0, visibleCount)
    const hasMoreChildren = visibleCount < node.children.length

    return h('div', { class: 'tree-node', style: { marginLeft: `${indentSize}rem` } }, [
      h(
        'div',
        {
          class: [
            'tree-node-content',
            this.getNodeTypeClass(node.type),
            highlighted ? 'highlighted' : '',
          ],
          onClick: () => hasChildren && this.toggleNode(node.id),
          onMouseenter: () => this.onNodeEnter(node.loc),
          onMouseleave: () => this.onNodeLeave(),
          title: locTooltip,
        },
        [
          hasChildren
            ? h(
                'span',
                { class: ['tree-toggle', expanded ? 'expanded' : ''] },
                expanded ? '▼' : '▶'
              )
            : h('span', { class: 'tree-toggle tree-leaf' }, '•'),
          h('span', { class: 'tree-label' }, node.label),
          h('span', { class: 'tree-type' }, node.type),
          // Show child count when collapsed (for lazy loading awareness)
          hasChildren && !expanded
            ? h('span', { class: 'tree-child-count' }, `(${node.childCount})`)
            : null,
          locTooltip
            ? h(
                'span',
                { class: 'tree-loc' },
                `[${node.loc?.start.line}:${node.loc?.start.column}]`
              )
            : null,
        ]
      ),
      hasChildren && expanded
        ? h('div', { class: 'tree-children' }, [
            ...visibleChildren.map((child: TreeNode) =>
              h(TreeNodeComponent, {
                node: child,
                depth: this.depth + 1,
                isExpanded: this.isExpanded,
                toggleNode: this.toggleNode,
                getNodeTypeClass: this.getNodeTypeClass,
                formatLocation: this.formatLocation,
                onNodeEnter: this.onNodeEnter,
                onNodeLeave: this.onNodeLeave,
                isNodeHighlighted: this.isNodeHighlighted,
                ensureChildrenLoaded: this.ensureChildrenLoaded,
                getVisibleChildrenCount: this.getVisibleChildrenCount,
                loadMoreChildren: this.loadMoreChildren,
              })
            ),
            // "Load more" button for pagination
            hasMoreChildren
              ? h(
                  'div',
                  {
                    class: 'tree-load-more',
                    style: { marginLeft: `${(this.depth + 1) * 1.1}rem` },
                  },
                  [
                    h(
                      'button',
                      {
                        class: 'load-more-btn',
                        onClick: (e: Event) => {
                          e.stopPropagation()
                          this.loadMoreChildren(node.id)
                        },
                      },
                      `Load more (${node.children.length - visibleCount} remaining)`
                    ),
                  ]
                )
              : null,
          ])
        : null,
    ])
  },
})

export default {
  components: { TreeNodeComponent },
}
</script>

<style scoped>
.ast-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.ast-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.ast-icon {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.ast-title {
  color: #94a3b8;
}

.ast-controls {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.ast-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.ast-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-color);
  border-color: #4a5568;
}

.btn-icon {
  font-size: 0.85rem;
}

.btn-text {
  display: none;
}

@media (min-width: 1400px) {
  .btn-text {
    display: inline;
  }
}

.ast-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.ast-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--error-color);
}

.ast-error-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
  background: rgba(248, 113, 113, 0.1);
  border-top: 1px solid var(--error-color);
  color: var(--error-color);
  font-size: 0.85rem;
}

.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  background: var(--error-color);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
}

.ast-empty {
  display: flex;
  align-items: left;
  justify-content: left;
  flex: 1;
  color: #64748b;
}

.tree-root {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  align-items: left;
  text-align: left;
}

.tree-node {
  /* margin-left is now dynamic based on depth */
}

.tree-node-content {
  display: flex;
  align-items: left;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.15s;
  text-align: left;
}

.tree-node-content:hover {
  background: rgba(102, 126, 234, 0.2);
}

:deep(.tree-node-content.highlighted) {
  background: rgba(102, 126, 234, 0.35);
  border-radius: 3px;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.5);
}

.tree-toggle {
  width: 1rem;
  color: #64748b;
  font-size: 0.7rem;
}

.tree-toggle.expanded {
  color: #94a3b8;
}

.tree-leaf {
  color: #4a5568;
}

.tree-label {
  color: var(--text-color);
}

.tree-type {
  color: #64748b;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.tree-loc {
  color: #4a5568;
  font-size: 0.65rem;
  margin-left: auto;
  font-style: italic;
}

.tree-child-count {
  color: #64748b;
  font-size: 0.7rem;
  margin-left: 0.25rem;
  opacity: 0.7;
}

.tree-children {
  /* Children indentation is now handled by individual nodes */
}

.tree-load-more {
  padding: 0.25rem 0;
}

.load-more-btn {
  background: transparent;
  color: #667eea;
  border: 1px dashed #667eea;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
}

.load-more-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  border-style: solid;
}

/* Node type colors - Enhanced for better visibility */
:deep(.node-structural .tree-label) {
  color: #94a3b8;
  font-weight: 500;
}

:deep(.node-link .tree-label) {
  color: #f472b6;
  font-weight: 600;
}

:deep(.node-define .tree-label) {
  color: #60a5fa;
  font-weight: 600;
}

:deep(.node-equality .tree-label) {
  color: #34d399;
  font-weight: 600;
}

:deep(.node-symbol .tree-label) {
  color: #fbbf24;
  font-weight: 600;
}

:deep(.node-not .tree-label) {
  color: #f87171;
  font-weight: 600;
}

:deep(.node-number .tree-label) {
  color: #a78bfa;
  font-weight: 600;
}

:deep(.node-identifier .tree-label) {
  color: #67e8f9;
  font-weight: 500;
}
</style>
