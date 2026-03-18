<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import cytoscape from 'cytoscape'
import type { File as MtlFile, ASTNode } from '../core/ast'
import { normalize } from '../core/normalizer'
import {
  projectToGraph,
  projectStatementsToGraph,
  toCytoscapeElements,
  linkGraphToDOT,
  type LinkGraph,
} from '../core/linkGraph'

const props = defineProps<{
  ast: MtlFile | null
  /** Index of the statement to visualize (null = all statements) */
  selectedStatement?: number | null
}>()

const containerRef = ref<HTMLElement | null>(null)
const cyInstance = ref<cytoscape.Core | null>(null)
const currentGraph = ref<LinkGraph | null>(null)
const graphStats = ref({ nodes: 0, edges: 0 })
const selectedLayout = ref<string>('cose')
const showDotExport = ref(false)
const dotOutput = ref('')

/** Available layout algorithms */
const layouts = [
  { id: 'cose', label: 'CoSE' },
  { id: 'breadthfirst', label: 'Дерево' },
  { id: 'circle', label: 'Круг' },
  { id: 'grid', label: 'Сетка' },
  { id: 'concentric', label: 'Концентрический' },
]

/** Cytoscape stylesheet for МТС link graph */
const cytoscapeStyle: cytoscape.Stylesheet[] = [
  // Default node style
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-family': 'JetBrains Mono, Fira Code, Consolas, monospace',
      'font-size': '12px',
      color: '#e2e8f0',
      'text-outline-color': '#1a1a2e',
      'text-outline-width': 1,
      'border-width': 1,
      'border-color': '#475569',
    },
  },
  // Link center nodes - small circles
  {
    selector: 'node[nodeType="link-center"]',
    style: {
      'background-color': '#3b82f6',
      shape: 'ellipse',
      width: 16,
      height: 16,
      label: '',
    },
  },
  // Atom nodes - identifiers, numbers, etc.
  {
    selector: 'node[nodeType="atom"]',
    style: {
      'background-color': '#22c55e',
      shape: 'round-rectangle',
      padding: '8px',
      width: 'label',
      height: 'label',
      'font-size': '14px',
      'font-weight': 'bold',
    },
  },
  // Operator nodes - =, !=, :
  {
    selector: 'node[nodeType="operator"]',
    style: {
      'background-color': '#f59e0b',
      shape: 'diamond',
      width: 30,
      height: 30,
      'font-size': '14px',
    },
  },
  // Unary operator nodes - !, ♂, ♀
  {
    selector: 'node[nodeType="unary"]',
    style: {
      'background-color': '#a855f7',
      shape: 'ellipse',
      padding: '6px',
      width: 'label',
      height: 'label',
    },
  },
  // Set nodes
  {
    selector: 'node[nodeType="set"]',
    style: {
      'background-color': '#6366f1',
      shape: 'round-rectangle',
      padding: '6px',
      width: 'label',
      height: 'label',
    },
  },
  // Power nodes
  {
    selector: 'node[nodeType="power"]',
    style: {
      'background-color': '#ec4899',
      shape: 'round-rectangle',
      padding: '6px',
      width: 'label',
      height: 'label',
    },
  },
  // Default edge style
  {
    selector: 'edge',
    style: {
      width: 2,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'font-family': 'JetBrains Mono, Fira Code, Consolas, monospace',
      'font-size': '10px',
      color: '#94a3b8',
      'text-outline-color': '#1a1a2e',
      'text-outline-width': 1,
    },
  },
  // Link start edges - with cross marker
  {
    selector: 'edge[edgeType="link-start"]',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'source-arrow-color': '#3b82f6',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'diamond',
      label: 'data(label)',
      width: 2.5,
    },
  },
  // Link end edges - with arrow
  {
    selector: 'edge[edgeType="link-end"]',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'target-arrow-shape': 'triangle',
      width: 2.5,
    },
  },
  // Self-closing start edges
  {
    selector: 'edge[edgeType="self-start"]',
    style: {
      'line-color': '#a855f7',
      'target-arrow-color': '#a855f7',
      'source-arrow-color': '#a855f7',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'diamond',
      label: 'data(label)',
      'loop-direction': '-45deg',
      'loop-sweep': '-90deg',
      'curve-style': 'bezier',
      width: 2,
    },
  },
  // Self-closing end edges
  {
    selector: 'edge[edgeType="self-end"]',
    style: {
      'line-color': '#a855f7',
      'target-arrow-color': '#a855f7',
      'target-arrow-shape': 'triangle',
      'loop-direction': '45deg',
      'loop-sweep': '90deg',
      'curve-style': 'bezier',
      width: 2,
    },
  },
  // Relation edges - dashed
  {
    selector: 'edge[edgeType="relation"]',
    style: {
      'line-color': '#64748b',
      'target-arrow-color': '#64748b',
      'target-arrow-shape': 'triangle',
      'line-style': 'dashed',
      label: 'data(label)',
      width: 1.5,
    },
  },
  // Member edges - dotted
  {
    selector: 'edge[edgeType="member"]',
    style: {
      'line-color': '#22c55e',
      'target-arrow-color': '#22c55e',
      'target-arrow-shape': 'circle',
      'line-style': 'dotted',
      width: 1.5,
    },
  },
  // Hover effects
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#fbbf24',
    },
  },
  {
    selector: 'edge:selected',
    style: {
      width: 4,
    },
  },
]

function buildGraph(): LinkGraph | null {
  if (!props.ast || props.ast.statements.length === 0) return null

  if (
    props.selectedStatement !== null &&
    props.selectedStatement !== undefined &&
    props.selectedStatement >= 0 &&
    props.selectedStatement < props.ast.statements.length
  ) {
    const stmt = props.ast.statements[props.selectedStatement]
    const normalized = normalize(stmt.expr)
    return projectToGraph(normalized)
  }

  // Project all statements
  const exprs: ASTNode[] = props.ast.statements.map(s => normalize(s.expr))
  return projectStatementsToGraph(exprs)
}

function getLayoutOptions(layoutId: string): cytoscape.LayoutOptions {
  switch (layoutId) {
    case 'breadthfirst':
      return {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.25,
        avoidOverlap: true,
      } as cytoscape.LayoutOptions
    case 'circle':
      return {
        name: 'circle',
        avoidOverlap: true,
      } as cytoscape.LayoutOptions
    case 'grid':
      return {
        name: 'grid',
        avoidOverlap: true,
      } as cytoscape.LayoutOptions
    case 'concentric':
      return {
        name: 'concentric',
        avoidOverlap: true,
      } as cytoscape.LayoutOptions
    default:
      return {
        name: 'cose',
        idealEdgeLength: () => 80,
        nodeOverlap: 20,
        animate: false,
        randomize: true,
      } as cytoscape.LayoutOptions
  }
}

function renderGraph() {
  const graph = buildGraph()
  currentGraph.value = graph

  if (!graph || !containerRef.value) {
    graphStats.value = { nodes: 0, edges: 0 }
    if (cyInstance.value) {
      cyInstance.value.destroy()
      cyInstance.value = null
    }
    return
  }

  graphStats.value = { nodes: graph.nodes.length, edges: graph.edges.length }

  const elements = toCytoscapeElements(graph)

  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  cyInstance.value = cytoscape({
    container: containerRef.value,
    elements: elements as cytoscape.ElementDefinition[],
    style: cytoscapeStyle as cytoscape.Stylesheet[],
    layout: getLayoutOptions(selectedLayout.value),
    minZoom: 0.2,
    maxZoom: 5,
    wheelSensitivity: 0.3,
  })
}

function handleLayoutChange() {
  if (cyInstance.value) {
    const layout = cyInstance.value.layout(getLayoutOptions(selectedLayout.value))
    layout.run()
  }
}

function handleFitGraph() {
  if (cyInstance.value) {
    cyInstance.value.fit(undefined, 30)
  }
}

function handleExportDOT() {
  if (currentGraph.value) {
    dotOutput.value = linkGraphToDOT(currentGraph.value, 'МТС — Граф связей')
    showDotExport.value = !showDotExport.value
  }
}

function handleCopyDOT() {
  if (dotOutput.value) {
    navigator.clipboard.writeText(dotOutput.value)
  }
}

// Watch for AST or selected statement changes
watch(
  () => [props.ast, props.selectedStatement],
  () => {
    nextTick(() => renderGraph())
  },
  { deep: true }
)

// Watch layout changes
watch(selectedLayout, handleLayoutChange)

onMounted(() => {
  nextTick(() => renderGraph())
})

onUnmounted(() => {
  if (cyInstance.value) {
    cyInstance.value.destroy()
    cyInstance.value = null
  }
})
</script>

<template>
  <div class="link-graph-viewer">
    <div class="graph-toolbar">
      <span class="graph-title">Граф связей</span>
      <div class="graph-controls">
        <select v-model="selectedLayout" class="layout-select" title="Алгоритм раскладки">
          <option v-for="layout in layouts" :key="layout.id" :value="layout.id">
            {{ layout.label }}
          </option>
        </select>
        <button class="graph-btn" title="Вписать граф в область" @click="handleFitGraph">
          Вписать
        </button>
        <button class="graph-btn" title="Экспорт в DOT (Graphviz)" @click="handleExportDOT">
          DOT
        </button>
      </div>
      <span v-if="graphStats.nodes > 0" class="graph-stats">
        {{ graphStats.nodes }} узлов, {{ graphStats.edges }} дуг
      </span>
    </div>

    <!-- DOT export panel -->
    <div v-if="showDotExport" class="dot-export-panel">
      <div class="dot-header">
        <span>DOT (Graphviz)</span>
        <button class="graph-btn copy-btn" @click="handleCopyDOT">Копировать</button>
      </div>
      <pre class="dot-output">{{ dotOutput }}</pre>
    </div>

    <!-- Graph container -->
    <div
      ref="containerRef"
      class="graph-container"
      :class="{ empty: !ast || ast.statements.length === 0 }"
    >
      <div v-if="!ast || ast.statements.length === 0" class="graph-empty">
        <span class="empty-icon">*+--*--&gt;*</span>
        <span class="empty-text">Введите формулы для визуализации графа связей</span>
      </div>
    </div>

    <!-- Legend -->
    <div class="graph-legend">
      <span class="legend-title">Легенда:</span>
      <span class="legend-item">
        <span class="legend-dot link-center-dot"></span> центр связи
      </span>
      <span class="legend-item"> <span class="legend-dot atom-dot"></span> атом </span>
      <span class="legend-item">
        <span class="legend-line link-start-line"></span>
        <span class="legend-cross">+</span> начало
      </span>
      <span class="legend-item">
        <span class="legend-line link-end-line"></span>
        <span class="legend-arrow">&rarr;</span> конец
      </span>
      <span class="legend-item"> <span class="legend-dot unary-dot"></span> ♂/♀ </span>
    </div>
  </div>
</template>

<style scoped>
.link-graph-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.graph-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: #94a3b8;
}

.graph-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.layout-select {
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}

.layout-select:hover {
  color: var(--text-color);
}

.graph-btn {
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.graph-btn:hover {
  background: #1a3a5c;
  color: var(--text-color);
}

.graph-stats {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}

/* DOT export panel */
.dot-export-panel {
  border-bottom: 1px solid var(--border-color);
  max-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.dot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  background: rgba(0, 0, 0, 0.15);
  font-size: 0.75rem;
  color: #94a3b8;
}

.copy-btn {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
}

.dot-output {
  padding: 0.5rem 0.75rem;
  font-size: 0.7rem;
  color: #94a3b8;
  overflow: auto;
  flex: 1;
  margin: 0;
  background: rgba(0, 0, 0, 0.1);
}

/* Graph container */
.graph-container {
  flex: 1;
  min-height: 200px;
  position: relative;
}

.graph-container.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.graph-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #475569;
}

.empty-icon {
  font-size: 1.5rem;
  font-family: 'JetBrains Mono', monospace;
  color: #334155;
}

.empty-text {
  font-size: 0.85rem;
}

/* Legend */
.graph-legend {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.legend-title {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #94a3b8;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.link-center-dot {
  background: #3b82f6;
}

.atom-dot {
  background: #22c55e;
  border-radius: 3px;
}

.unary-dot {
  background: #a855f7;
}

.legend-line {
  width: 15px;
  height: 2px;
}

.link-start-line {
  background: #3b82f6;
}

.link-end-line {
  background: #3b82f6;
}

.legend-cross {
  font-weight: bold;
  color: #3b82f6;
  font-size: 0.8rem;
}

.legend-arrow {
  color: #3b82f6;
  font-size: 0.85rem;
}
</style>
