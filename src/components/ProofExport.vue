<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ProofResult, ProverState } from '../core/prover'
import type { ASTNode } from '../core/ast'
import {
  exportToLaTeX,
  exportToText,
  exportToJSON,
  exportToDOT,
  getExportExtension,
  getExportMimeType,
  type ExportFormat,
  type LaTeXExportOptions,
  type TextExportOptions,
  type JSONExportOptions,
  type DOTExportOptions,
} from '../core/proofExport'
import { downloadFile } from '../core/fileIO'

// Props
const props = defineProps<{
  results: { stmt: string; result: ProofResult }[]
  goal?: ASTNode
  state?: ProverState
  baseFileName?: string
}>()

// Emits
const emit = defineEmits<{
  (e: 'exported', format: ExportFormat, content: string): void
}>()

// State
const showDropdown = ref(false)
const selectedFormat = ref<ExportFormat>('text')
const showOptions = ref(false)

// LaTeX options
const latexOptions = ref<LaTeXExportOptions>({
  standalone: false,
  useProofEnvironment: true,
  includeAxiomDefinitions: false,
  documentClass: 'article',
  language: 'ru',
})

// Text options
const textOptions = ref<TextExportOptions>({
  includeStepNumbers: true,
  includeTimestamps: true,
  includeAxiomDescriptions: true,
  language: 'ru',
})

// JSON options
const jsonOptions = ref<JSONExportOptions>({
  pretty: true,
  includeAST: false,
  includeState: false,
  includeTimestamps: true,
})

// DOT options
const dotOptions = ref<DOTExportOptions>({
  rankdir: 'TB',
  includeAxiomLabels: true,
  nodeShape: 'box',
  colorScheme: 'default',
  includeLegend: true,
})

// Computed
const hasResults = computed(() => props.results && props.results.length > 0)

const formatDescriptions: Record<
  ExportFormat,
  { icon: string; name: string; description: string }
> = {
  latex: {
    icon: '📜',
    name: 'LaTeX',
    description: 'Для научных статей и документации',
  },
  text: {
    icon: '📄',
    name: 'Текст',
    description: 'Человекочитаемый формат',
  },
  json: {
    icon: '{ }',
    name: 'JSON',
    description: 'Машиночитаемый формат с трассировкой',
  },
  dot: {
    icon: '🔗',
    name: 'DOT',
    description: 'Граф для Graphviz визуализации',
  },
}

// Methods
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
  if (!showDropdown.value) {
    showOptions.value = false
  }
}

const closeDropdown = () => {
  showDropdown.value = false
  showOptions.value = false
}

const selectFormat = (format: ExportFormat) => {
  selectedFormat.value = format
  showOptions.value = true
}

const getFileName = () => {
  const base = props.baseFileName?.replace(/\.[^.]+$/, '') || 'proof'
  const ext = getExportExtension(selectedFormat.value)
  return `${base}-export.${ext}`
}

const exportProof = () => {
  if (!hasResults.value) return

  // Combine all results into one export
  // For now, export the first result (or implement multi-result export)
  const firstResult = props.results[0]
  let content = ''

  switch (selectedFormat.value) {
    case 'latex':
      content = exportToLaTeX(firstResult.result, props.goal, latexOptions.value)
      break
    case 'text':
      content = exportToText(firstResult.result, props.goal, textOptions.value)
      break
    case 'json':
      content = exportToJSON(firstResult.result, props.goal, props.state, jsonOptions.value)
      break
    case 'dot':
      content = exportToDOT(firstResult.result, props.goal, dotOptions.value)
      break
  }

  // Download the file
  const fileName = getFileName()
  const mimeType = getExportMimeType(selectedFormat.value)
  downloadFile(content, fileName, mimeType)

  // Emit event
  emit('exported', selectedFormat.value, content)

  // Close dropdown
  closeDropdown()
}

const exportAll = () => {
  if (!hasResults.value) return

  // Export all results in the selected format
  const allContent: string[] = []

  for (let i = 0; i < props.results.length; i++) {
    const { result } = props.results[i]

    switch (selectedFormat.value) {
      case 'latex':
        allContent.push(
          `% === Доказательство ${i + 1} ===\n` +
            exportToLaTeX(result, undefined, latexOptions.value)
        )
        break
      case 'text':
        allContent.push(
          `=== Доказательство ${i + 1} ===\n` + exportToText(result, undefined, textOptions.value)
        )
        break
      case 'json':
        // For JSON, create an array of all proofs
        break
      case 'dot':
        // For DOT, combine graphs with subgraph clusters
        allContent.push(`// Proof ${i + 1}\n` + exportToDOT(result, undefined, dotOptions.value))
        break
    }
  }

  let content = ''
  if (selectedFormat.value === 'json') {
    // Create array of all proofs
    const allProofs = props.results.map(({ result }) => JSON.parse(exportToJSON(result)))
    content = JSON.stringify(allProofs, null, jsonOptions.value.pretty ? 2 : 0)
  } else {
    content = allContent.join('\n\n')
  }

  // Download the file
  const base = props.baseFileName?.replace(/\.[^.]+$/, '') || 'proofs'
  const ext = getExportExtension(selectedFormat.value)
  const fileName = `${base}-all.${ext}`
  const mimeType = getExportMimeType(selectedFormat.value)
  downloadFile(content, fileName, mimeType)

  // Emit event
  emit('exported', selectedFormat.value, content)

  // Close dropdown
  closeDropdown()
}

// Preview content
const previewContent = computed(() => {
  if (!hasResults.value) return ''

  const firstResult = props.results[0]
  let content = ''

  switch (selectedFormat.value) {
    case 'latex':
      content = exportToLaTeX(firstResult.result, props.goal, latexOptions.value)
      break
    case 'text':
      content = exportToText(firstResult.result, props.goal, textOptions.value)
      break
    case 'json':
      content = exportToJSON(firstResult.result, props.goal, props.state, jsonOptions.value)
      break
    case 'dot':
      content = exportToDOT(firstResult.result, props.goal, dotOptions.value)
      break
  }

  // Truncate for preview
  const maxLines = 15
  const lines = content.split('\n')
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + '\n... (продолжение)'
  }
  return content
})
</script>

<template>
  <div class="proof-export">
    <button
      class="export-btn"
      :disabled="!hasResults"
      title="Экспорт доказательств"
      @click="toggleDropdown"
    >
      <span class="btn-icon">📤</span>
      <span class="btn-text">Экспорт</span>
      <span class="dropdown-arrow">▼</span>
    </button>

    <div v-if="showDropdown" class="export-dropdown">
      <div class="dropdown-header">
        <span class="dropdown-title">Экспорт доказательств</span>
        <button class="close-btn" @click="closeDropdown">×</button>
      </div>

      <div class="dropdown-content">
        <!-- Format selection -->
        <div class="format-list">
          <div
            v-for="(info, format) in formatDescriptions"
            :key="format"
            class="format-item"
            :class="{ selected: selectedFormat === format }"
            @click="selectFormat(format)"
          >
            <span class="format-icon">{{ info.icon }}</span>
            <div class="format-info">
              <span class="format-name">{{ info.name }}</span>
              <span class="format-desc">{{ info.description }}</span>
            </div>
            <span v-if="selectedFormat === format" class="check-mark">✓</span>
          </div>
        </div>

        <!-- Options panel -->
        <div v-if="showOptions" class="options-panel">
          <div class="options-header">
            <span>Настройки {{ formatDescriptions[selectedFormat].name }}</span>
          </div>

          <!-- LaTeX options -->
          <div v-if="selectedFormat === 'latex'" class="options-content">
            <label class="option-row">
              <input v-model="latexOptions.standalone" type="checkbox" />
              <span>Standalone документ (с preamble)</span>
            </label>
            <label class="option-row">
              <input v-model="latexOptions.useProofEnvironment" type="checkbox" />
              <span>Использовать proof environment</span>
            </label>
            <label class="option-row">
              <input v-model="latexOptions.includeAxiomDefinitions" type="checkbox" />
              <span>Включить определения аксиом</span>
            </label>
            <div class="option-row">
              <span>Язык:</span>
              <select v-model="latexOptions.language">
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <!-- Text options -->
          <div v-if="selectedFormat === 'text'" class="options-content">
            <label class="option-row">
              <input v-model="textOptions.includeStepNumbers" type="checkbox" />
              <span>Номера шагов</span>
            </label>
            <label class="option-row">
              <input v-model="textOptions.includeTimestamps" type="checkbox" />
              <span>Временные метки</span>
            </label>
            <label class="option-row">
              <input v-model="textOptions.includeAxiomDescriptions" type="checkbox" />
              <span>Описания аксиом</span>
            </label>
            <div class="option-row">
              <span>Язык:</span>
              <select v-model="textOptions.language">
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <!-- JSON options -->
          <div v-if="selectedFormat === 'json'" class="options-content">
            <label class="option-row">
              <input v-model="jsonOptions.pretty" type="checkbox" />
              <span>Форматированный вывод</span>
            </label>
            <label class="option-row">
              <input v-model="jsonOptions.includeAST" type="checkbox" />
              <span>Включить AST</span>
            </label>
            <label class="option-row">
              <input v-model="jsonOptions.includeState" type="checkbox" />
              <span>Включить состояние прувера</span>
            </label>
            <label class="option-row">
              <input v-model="jsonOptions.includeTimestamps" type="checkbox" />
              <span>Временные метки</span>
            </label>
          </div>

          <!-- DOT options -->
          <div v-if="selectedFormat === 'dot'" class="options-content">
            <div class="option-row">
              <span>Направление:</span>
              <select v-model="dotOptions.rankdir">
                <option value="TB">Сверху вниз</option>
                <option value="LR">Слева направо</option>
                <option value="BT">Снизу вверх</option>
                <option value="RL">Справа налево</option>
              </select>
            </div>
            <label class="option-row">
              <input v-model="dotOptions.includeAxiomLabels" type="checkbox" />
              <span>Метки аксиом на рёбрах</span>
            </label>
            <div class="option-row">
              <span>Форма узлов:</span>
              <select v-model="dotOptions.nodeShape">
                <option value="box">Прямоугольник</option>
                <option value="ellipse">Эллипс</option>
                <option value="diamond">Ромб</option>
              </select>
            </div>
            <div class="option-row">
              <span>Цветовая схема:</span>
              <select v-model="dotOptions.colorScheme">
                <option value="default">По умолчанию</option>
                <option value="colorful">Яркая</option>
                <option value="monochrome">Чёрно-белая</option>
              </select>
            </div>
            <label class="option-row">
              <input v-model="dotOptions.includeLegend" type="checkbox" />
              <span>Включить легенду</span>
            </label>
          </div>

          <!-- Preview -->
          <div class="preview-section">
            <div class="preview-header">
              <span>Предпросмотр</span>
            </div>
            <pre class="preview-content">{{ previewContent }}</pre>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="dropdown-actions">
          <button class="action-btn primary" :disabled="!hasResults" @click="exportProof">
            <span class="btn-icon">💾</span>
            Экспортировать
          </button>
          <button
            v-if="results.length > 1"
            class="action-btn secondary"
            :disabled="!hasResults"
            @click="exportAll"
          >
            <span class="btn-icon">📦</span>
            Экспортировать все ({{ results.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proof-export {
  position: relative;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.export-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c93f0 0%, #8b5cbf 100%);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--accent-color);
}

.btn-icon {
  font-size: 0.85rem;
}

.btn-text {
  display: none;
}

@media (min-width: 1024px) {
  .btn-text {
    display: inline;
  }
}

.dropdown-arrow {
  font-size: 0.6rem;
  margin-left: 0.15rem;
}

.export-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  width: 400px;
  max-height: 80vh;
  background: var(--panel-bg, #16213e);
  border: 1px solid var(--border-color, #334155);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 200;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.dropdown-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  opacity: 0.8;
}

.dropdown-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.format-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.format-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--accent-color, #0f3460);
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-item:hover {
  background: #1a3a5c;
}

.format-item.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}

.format-icon {
  font-size: 1.5rem;
}

.format-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.format-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.format-desc {
  font-size: 0.75rem;
  color: #94a3b8;
}

.check-mark {
  color: #667eea;
  font-size: 1.2rem;
  font-weight: bold;
}

.options-panel {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.options-header {
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
}

.options-content {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.option-row input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}

.option-row select {
  background: var(--accent-color, #0f3460);
  color: var(--text-color, #eee);
  border: 1px solid var(--border-color, #334155);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
}

.preview-section {
  margin-top: 0.75rem;
  border-top: 1px solid var(--border-color, #334155);
  padding-top: 0.75rem;
}

.preview-header {
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.preview-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.dropdown-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--border-color, #334155);
  background: rgba(0, 0, 0, 0.1);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.6rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.action-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c93f0 0%, #8b5cbf 100%);
}

.action-btn.secondary {
  background: var(--accent-color, #0f3460);
  color: var(--text-color, #eee);
  border: 1px solid var(--border-color, #334155);
}

.action-btn.secondary:hover:not(:disabled) {
  background: #1a3a5c;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
