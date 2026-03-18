<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { parseWithRecovery, ParseError } from './core/parser'
import { normalize } from './core/normalizer'
import { createProverState, verify, type ProofResult } from './core/prover'
import { astToString, type File, type SourceLocation } from './core/ast'
import Editor from './components/Editor.vue'
import ASTViewer from './components/ASTViewer.vue'
import ProverPanel from './components/ProverPanel.vue'
import ErrorPanel from './components/ErrorPanel.vue'
import {
  readFileContent,
  getFilePreview,
  isSupportedFile,
  getFileExtension,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  formatResultsForExport,
  downloadFile,
  openFileDialog,
  type FileMetadata,
} from './core/fileIO'
import { stringAnumFileToMtl, visualizeConversion, type ConversionStep } from './core/stringAnum'
import {
  quatAnumFileToMtl,
  visualizeQuatConversion,
  type QuatConversionStep,
} from './core/quatAnum'
import InteractiveProver from './components/InteractiveProver.vue'
import ProofExport from './components/ProofExport.vue'
import LinkGraphViewer from './components/LinkGraphViewer.vue'
import type { ASTNode } from './core/ast'
import type { ProverState, ProofStep } from './core/prover'

const input = ref(`// МТС — Ассоциативный прувер
// Примеры аксиом и формул

// А4. Смысл (акорень): ∞ : (∞ -> ∞)
∞ = ∞ -> ∞

// А5. Самозамыкание начала: ♂x : (♂x -> x)
♂v = ♂v -> v

// А6. Самозамыкание конца: x♀ : (x -> x♀)
r♀ = r -> r♀

// А7. Инверсия
!♂x = x♀
!x♀ = ♂x

// А11. Левоассоциативность
a -> b -> c = (a -> b) -> c

// Степени
a^2 = a -> a
a^3 = (a -> a) -> a
`)

const error = ref<string | null>(null)
const errorLocation = ref<SourceLocation | null>(null)
const ast = ref<File | null>(null)
const results = ref<{ stmt: string; result: ProofResult }[]>([])
const proverState = ref<ProverState | null>(null)

// Panel visibility state
const showAST = ref(true)
const showGraph = ref(false)

// Highlighted source location (from AST node hover)
const highlightedLoc = ref<SourceLocation | null>(null)

// Highlighted AST node (from editor cursor position)
const highlightedNodeLoc = ref<SourceLocation | null>(null)

// File operations state
const currentFileName = ref<string | null>(null)
const currentFileType = ref<'mtl' | 'astr' | 'anum'>('mtl')
const showRecentFiles = ref(false)
const recentFiles = ref<FileMetadata[]>([])
const isDragOver = ref(false)

// String anumber conversion state
const showConversion = ref(false)
const conversionSteps = ref<ConversionStep[]>([])
const originalAstrContent = ref<string | null>(null)

// Quaternary anumber conversion state
const quatConversionSteps = ref<QuatConversionStep[]>([])
const originalAnumContent = ref<string | null>(null)

// Interactive proof mode state
const showInteractive = ref(false)
const interactiveGoals = ref<ASTNode[]>([])

// Application version from package.json (injected by Vite at build time)
const appVersion = __APP_VERSION__

const toggleAST = () => {
  showAST.value = !showAST.value
}

const toggleGraph = () => {
  showGraph.value = !showGraph.value
}

// Toggle interactive proof mode
const toggleInteractive = () => {
  if (!showInteractive.value) {
    // Starting interactive mode - collect goals from AST
    if (ast.value && ast.value.statements.length > 0) {
      interactiveGoals.value = ast.value.statements.map(stmt => normalize(stmt.expr))
    }
  }
  showInteractive.value = !showInteractive.value
}

// Handle interactive proof completion
const handleProofComplete = (_steps: ProofStep[]) => {
  // Proof complete - could add notification or logging here if needed
}

// Close interactive mode
const closeInteractive = () => {
  showInteractive.value = false
}

// Handle AST node hover for source highlighting
const handleNodeHover = (loc: SourceLocation | null) => {
  highlightedLoc.value = loc
}

// Handle editor cursor position for AST node highlighting
const handleCursorPosition = (loc: SourceLocation | null) => {
  highlightedNodeLoc.value = loc
}

const parseAndVerify = () => {
  error.value = null
  errorLocation.value = null
  ast.value = null
  results.value = []
  proverState.value = null

  try {
    // Use parseWithRecovery to get partial results even on error
    const parseResult = parseWithRecovery(input.value)

    // Set error information if present
    if (parseResult.error) {
      error.value = parseResult.error.message
      errorLocation.value = parseResult.errorLocation || null
    }

    // Process partial AST if available
    if (parseResult.file) {
      ast.value = parseResult.file
      const state = createProverState()

      for (const stmt of parseResult.file.statements) {
        const stmtStr = astToString(stmt.expr)
        const normalized = normalize(stmt.expr)
        const result = verify(normalized, state)
        results.value.push({ stmt: stmtStr, result })
      }

      // Store prover state for export
      proverState.value = state
    }
  } catch (e) {
    if (e instanceof ParseError) {
      error.value = e.message
      errorLocation.value = e.token.loc
    } else if (e instanceof Error) {
      error.value = e.message
    } else {
      error.value = 'Unknown error'
    }
  }
}

// Auto-verify on input change
watch(input, parseAndVerify, { immediate: true })

// Stats for header
const stats = computed(() => {
  const total = results.value.length
  const passed = results.value.filter(r => r.result.success).length
  return { total, passed }
})

// File operations
const loadRecentFiles = () => {
  recentFiles.value = getRecentFiles()
}

const handleFileOpen = async () => {
  const files = await openFileDialog('.mtl,.astr,.anum', false)
  if (files && files.length > 0) {
    await loadFile(files[0])
  }
}

const loadFile = async (file: globalThis.File) => {
  if (!isSupportedFile(file.name)) {
    error.value = `Неподдерживаемый формат файла: ${file.name}. Поддерживаются: .mtl, .astr, .anum`
    return
  }

  try {
    const content = await readFileContent(file)
    const ext = getFileExtension(file.name)

    currentFileName.value = file.name

    if (ext === '.astr') {
      // Convert string anumber to formal notation
      currentFileType.value = 'astr'
      originalAstrContent.value = content

      // Generate conversion visualization for first non-empty line
      const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'))
      if (lines.length > 0) {
        conversionSteps.value = visualizeConversion(lines[0].trim())
        showConversion.value = true
      }

      // Convert to .mtl format
      const mtlContent = stringAnumFileToMtl(content)
      input.value = mtlContent
    } else if (ext === '.anum') {
      // Quaternary anumber support
      currentFileType.value = 'anum'
      originalAnumContent.value = content
      originalAstrContent.value = null

      // Generate conversion visualization for first non-empty line
      const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'))
      if (lines.length > 0) {
        quatConversionSteps.value = visualizeQuatConversion(lines[0].trim())
        conversionSteps.value = [] // Clear string anum steps
        showConversion.value = true
      }

      // Convert to .mtl format
      try {
        const mtlContent = quatAnumFileToMtl(content)
        input.value = mtlContent
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Ошибка парсинга .anum файла'
        return
      }
    } else {
      // .mtl file - direct load
      currentFileType.value = 'mtl'
      originalAstrContent.value = null
      showConversion.value = false
      conversionSteps.value = []
      input.value = content
    }

    const preview = getFilePreview(content)
    addRecentFile(file.name, file.size, preview)
    loadRecentFiles()
    showRecentFiles.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка чтения файла'
  }
}

const handleFileDrop = (file: globalThis.File) => {
  loadFile(file)
}

const handleSaveResults = () => {
  if (results.value.length === 0) return

  const content = formatResultsForExport(results.value, { includeDetails: true, format: 'text' })
  const baseName = currentFileName.value?.replace(/\.[^.]+$/, '') || 'results'
  downloadFile(content, `${baseName}-results.txt`, 'text/plain')
}

const handleSaveCode = () => {
  const baseName = currentFileName.value || 'code.mtl'
  downloadFile(input.value, baseName, 'text/plain')
}

const handleExportJson = () => {
  if (results.value.length === 0) return

  const content = formatResultsForExport(results.value, { includeDetails: true, format: 'json' })
  const baseName = currentFileName.value?.replace(/\.[^.]+$/, '') || 'results'
  downloadFile(content, `${baseName}-results.json`, 'application/json')
}

const handleNewFile = () => {
  currentFileName.value = null
  currentFileType.value = 'mtl'
  originalAstrContent.value = null
  originalAnumContent.value = null
  showConversion.value = false
  conversionSteps.value = []
  quatConversionSteps.value = []
  input.value = `// МТС — Ассоциативный прувер
// Введите формулы для верификации

`
}

const toggleConversion = () => {
  showConversion.value = !showConversion.value
}

const toggleRecentFiles = () => {
  showRecentFiles.value = !showRecentFiles.value
  if (showRecentFiles.value) {
    loadRecentFiles()
  }
}

const handleRecentFileClick = async (file: FileMetadata) => {
  // Recent files don't store content, so this is just a notification
  // In a real app, you'd need to re-open the file from disk
  // For now, we show a message indicating the file needs to be opened
  showRecentFiles.value = false
  // Note: In browser context, we can't re-read files from disk
  // This feature shows history but requires re-opening
  alert(`Для открытия файла "${file.name}" используйте кнопку "Открыть"`)
}

const handleRemoveRecentFile = (e: Event, name: string) => {
  e.stopPropagation()
  removeRecentFile(name)
  loadRecentFiles()
}

const handleClearRecentFiles = () => {
  clearRecentFiles()
  loadRecentFiles()
}

// Autosave
const autosaveInterval = ref<ReturnType<typeof setInterval> | null>(null)

const setupAutosave = () => {
  // Save every 30 seconds
  autosaveInterval.value = setInterval(() => {
    saveAutosave(input.value)
  }, 30000)
}

const loadAutosavedContent = () => {
  const saved = loadAutosave()
  if (saved && saved !== input.value) {
    // Could show a prompt here, but for simplicity we just load it
    // only if the current content is the default
    const defaultStart = '// МТС — Ассоциативный прувер'
    if (input.value.startsWith(defaultStart) && !saved.startsWith(defaultStart)) {
      // Don't overwrite default with empty/different autosave
    } else if (saved.trim()) {
      // input.value = saved
      // Disabled: don't auto-restore, let user choose via file operations
    }
  }
}

// Keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl+O: Open file
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault()
    handleFileOpen()
    return
  }

  // Ctrl+S: Save code
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSaveCode()
    return
  }

  // Ctrl+Shift+S: Save results
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault()
    handleSaveResults()
    return
  }

  // Ctrl+N: New file
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    handleNewFile()
    return
  }

  // Escape: Close recent files dropdown
  if (e.key === 'Escape' && showRecentFiles.value) {
    showRecentFiles.value = false
    return
  }
}

// Click outside handler for recent files dropdown
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (
    showRecentFiles.value &&
    !target.closest('.recent-files-dropdown') &&
    !target.closest('.recent-btn')
  ) {
    showRecentFiles.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadRecentFiles()
  setupAutosave()
  loadAutosavedContent()
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (autosaveInterval.value) {
    clearInterval(autosaveInterval.value)
  }
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1>aprover</h1>
        <span class="version">v{{ appVersion }}</span>
      </div>
      <p class="subtitle">Ассоциативный прувер для формальной нотации Метатеории Связей (МТС)</p>
      <div class="header-right">
        <div class="toolbar">
          <button class="toolbar-btn" title="Новый файл (Ctrl+N)" @click="handleNewFile">
            <span class="btn-icon">📄</span>
            <span class="btn-text">Новый</span>
          </button>
          <button class="toolbar-btn" title="Открыть файл (Ctrl+O)" @click="handleFileOpen">
            <span class="btn-icon">📂</span>
            <span class="btn-text">Открыть</span>
          </button>
          <div class="dropdown-container">
            <button
              class="toolbar-btn recent-btn"
              title="Недавние файлы"
              @click="toggleRecentFiles"
            >
              <span class="btn-icon">🕐</span>
              <span class="btn-text">Недавние</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div v-if="showRecentFiles" class="recent-files-dropdown">
              <div v-if="recentFiles.length === 0" class="recent-empty">Нет недавних файлов</div>
              <div v-else>
                <div
                  v-for="file in recentFiles"
                  :key="file.name"
                  class="recent-file-item"
                  @click="handleRecentFileClick(file)"
                >
                  <span class="recent-file-name">{{ file.name }}</span>
                  <span class="recent-file-preview">{{ file.preview }}</span>
                  <button
                    class="recent-file-remove"
                    title="Удалить из списка"
                    @click="handleRemoveRecentFile($event, file.name)"
                  >
                    ×
                  </button>
                </div>
                <div class="recent-actions">
                  <button class="recent-clear-btn" @click="handleClearRecentFiles">
                    Очистить историю
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="toolbar-separator"></div>
          <button class="toolbar-btn" title="Сохранить код (Ctrl+S)" @click="handleSaveCode">
            <span class="btn-icon">💾</span>
            <span class="btn-text">Сохранить</span>
          </button>
          <button
            class="toolbar-btn"
            :disabled="results.length === 0"
            title="Сохранить результаты"
            @click="handleSaveResults"
          >
            <span class="btn-icon">📋</span>
            <span class="btn-text">Результаты</span>
          </button>
          <button
            class="toolbar-btn"
            :disabled="results.length === 0"
            title="Экспорт в JSON"
            @click="handleExportJson"
          >
            <span class="btn-icon">{ }</span>
            <span class="btn-text">JSON</span>
          </button>
          <ProofExport
            :results="results"
            :state="proverState || undefined"
            :base-file-name="currentFileName || undefined"
          />
        </div>
        <div class="toolbar-separator"></div>
        <button
          v-if="currentFileType === 'astr' || currentFileType === 'anum'"
          class="toggle-btn"
          :class="{ active: showConversion }"
          title="Показать процесс конвертации"
          @click="toggleConversion"
        >
          {{ showConversion ? 'Hide Conv' : 'Show Conv' }}
        </button>
        <button class="toggle-btn" :class="{ active: showAST }" @click="toggleAST">
          {{ showAST ? 'Hide AST' : 'Show AST' }}
        </button>
        <button
          class="toggle-btn graph-btn-toggle"
          :class="{ active: showGraph }"
          :disabled="!ast || ast.statements.length === 0"
          title="Визуализация графа связей"
          @click="toggleGraph"
        >
          {{ showGraph ? 'Hide Graph' : 'Graph' }}
        </button>
        <button
          class="toggle-btn interactive-btn"
          :class="{ active: showInteractive }"
          :disabled="!ast || ast.statements.length === 0"
          title="Интерактивный режим доказательства"
          @click="toggleInteractive"
        >
          {{ showInteractive ? 'Exit INT' : 'INT' }}
        </button>
        <span v-if="currentFileType !== 'mtl'" class="file-type-badge" :class="currentFileType">
          {{ currentFileType.toUpperCase() }}
        </span>
      </div>
    </header>

    <!-- Interactive proof mode panel -->
    <InteractiveProver
      :active="showInteractive"
      :initial-goals="interactiveGoals"
      @close="closeInteractive"
      @proof-complete="handleProofComplete"
    />

    <!-- Conversion panel for .astr files -->
    <div v-if="showConversion && conversionSteps.length > 0" class="conversion-panel astr-panel">
      <div class="conversion-header">
        <span class="conversion-title">🔄 Конвертация строковых ачисел</span>
        <span class="conversion-subtitle"
          >Процесс преобразования: строка → цепочка формальных запросов</span
        >
      </div>
      <div class="conversion-steps">
        <div
          v-for="(step, index) in conversionSteps"
          :key="index"
          class="conversion-step"
          :class="{ initial: index === 0 }"
        >
          <div class="step-number">{{ index === 0 ? '∞' : index }}</div>
          <div class="step-content">
            <div v-if="step.char" class="step-char">
              <span class="char-label">Символ:</span>
              <span class="char-value">'{{ step.char }}'</span>
            </div>
            <div class="step-description">{{ step.description }}</div>
            <div class="step-formal">
              <code>{{ step.formal }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Conversion panel for .anum files (quaternary notation) -->
    <div
      v-if="showConversion && quatConversionSteps.length > 0"
      class="conversion-panel anum-panel"
    >
      <div class="conversion-header anum-header">
        <span class="conversion-title">🔢 Конвертация четверичных ачисел</span>
        <span class="conversion-subtitle">Процесс преобразования: абиты → формальные запросы</span>
      </div>
      <div class="abit-legend">
        <span class="legend-item"><code>[</code> = ♂∞</span>
        <span class="legend-item"><code>]</code> = ∞♀</span>
        <span class="legend-item"><code>1</code> = ♂∞ → ∞♀</span>
        <span class="legend-item"><code>0</code> = ∞♀ → ♂∞</span>
      </div>
      <div class="conversion-steps">
        <div
          v-for="(step, index) in quatConversionSteps"
          :key="index"
          class="conversion-step"
          :class="{ initial: index === 0 }"
        >
          <div class="step-number">{{ index === 0 ? '∞' : index }}</div>
          <div class="step-content">
            <div v-if="step.abit" class="step-char">
              <span class="char-label">Абит:</span>
              <span class="char-value abit-value">'{{ step.abit }}'</span>
            </div>
            <div v-if="step.definition && index > 0" class="step-definition">
              <span class="def-label">≡</span>
              <span class="def-value">{{ step.definition }}</span>
            </div>
            <div class="step-description">{{ step.description }}</div>
            <div class="step-formal">
              <code>{{ step.formal }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>

    <main
      class="app-main"
      :class="{
        'with-ast': showAST,
        'with-graph': showGraph,
        'with-ast-and-graph': showAST && showGraph,
      }"
    >
      <div class="panel editor-panel">
        <Editor
          v-model="input"
          :highlighted-loc="highlightedLoc"
          :error-loc="errorLocation"
          :file-name="currentFileName || undefined"
          :is-drag-over="isDragOver"
          @file-drop="handleFileDrop"
          @cursor-position="handleCursorPosition"
        />
      </div>

      <div v-if="showAST" class="panel ast-panel">
        <ASTViewer
          :ast="ast"
          :error="error"
          :highlighted-node-loc="highlightedNodeLoc"
          @node-hover="handleNodeHover"
        />
      </div>

      <div v-if="showGraph" class="panel graph-panel">
        <LinkGraphViewer :ast="ast" />
      </div>

      <div class="panel results-panel">
        <ErrorPanel :error="error" />
        <ProverPanel :results="results" :has-error="!!error" />
      </div>
    </main>

    <footer class="app-footer">
      <div v-if="stats.total > 0" class="footer-stats">
        <span>{{ stats.passed }}/{{ stats.total }} statements verified</span>
      </div>
      <div class="footer-links">
        <span>МТС — Метатеория Связей</span>
        <span class="separator">|</span>
        <a href="https://github.com/netkeep80/aprover" target="_blank" rel="noopener">GitHub</a>
      </div>
    </footer>
  </div>
</template>

<style>
:root {
  --bg-color: #1a1a2e;
  --panel-bg: #16213e;
  --text-color: #eee;
  --accent-color: #0f3460;
  --success-color: #4ade80;
  --error-color: #f87171;
  --border-color: #334155;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 1800px;
  margin: 0 auto;
  padding: 0.5rem;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--panel-bg);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.app-header h1 {
  font-size: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.version {
  color: #64748b;
  font-size: 0.75rem;
}

.subtitle {
  color: #64748b;
  font-size: 0.8rem;
  margin-left: 1.5rem;
  flex: 1;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Toolbar styles */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: #1a3a5c;
  color: var(--text-color);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn .btn-icon {
  font-size: 0.85rem;
}

.toolbar-btn .btn-text {
  display: none;
}

@media (min-width: 1024px) {
  .toolbar-btn .btn-text {
    display: inline;
  }
}

.toolbar-separator {
  width: 1px;
  height: 1.5rem;
  background: var(--border-color);
  margin: 0 0.25rem;
}

.dropdown-arrow {
  font-size: 0.6rem;
  margin-left: 0.15rem;
}

/* Recent files dropdown */
.dropdown-container {
  position: relative;
}

.recent-files-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  min-width: 280px;
  max-width: 350px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  overflow: hidden;
}

.recent-empty {
  padding: 1rem;
  color: #64748b;
  text-align: center;
  font-size: 0.85rem;
}

.recent-file-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
  position: relative;
}

.recent-file-item:hover {
  background: var(--accent-color);
}

.recent-file-item:last-child {
  border-bottom: none;
}

.recent-file-name {
  font-size: 0.85rem;
  color: var(--text-color);
  font-weight: 500;
}

.recent-file-preview {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.15rem;
}

.recent-file-remove {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.recent-file-item:hover .recent-file-remove {
  opacity: 1;
}

.recent-file-remove:hover {
  color: var(--error-color);
}

.recent-actions {
  padding: 0.5rem;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.recent-clear-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.recent-clear-btn:hover {
  color: var(--error-color);
}

.toggle-btn {
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #1a3a5c;
  color: var(--text-color);
}

.toggle-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-btn.graph-btn-toggle.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-color: #3b82f6;
}

.toggle-btn.graph-btn-toggle:not(:disabled):hover {
  background: #2563eb;
  color: white;
}

.toggle-btn.interactive-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
}

.toggle-btn.interactive-btn:not(:disabled):hover {
  background: linear-gradient(135deg, #7c93f0 0%, #8b5cbf 100%);
}

.toggle-btn.interactive-btn:disabled {
  background: var(--accent-color);
  color: #64748b;
}

.app-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.app-main.with-ast {
  grid-template-columns: 1fr 1fr 1fr;
}

.app-main.with-graph {
  grid-template-columns: 1fr 1fr 1fr;
}

.app-main.with-ast-and-graph {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

@media (max-width: 1200px) {
  .app-main.with-ast {
    grid-template-columns: 1fr 1fr;
  }

  .app-main.with-ast .ast-panel {
    grid-column: span 2;
    max-height: 300px;
  }

  .app-main.with-graph {
    grid-template-columns: 1fr 1fr;
  }

  .app-main.with-graph .graph-panel {
    grid-column: span 2;
    max-height: 400px;
  }

  .app-main.with-ast-and-graph {
    grid-template-columns: 1fr 1fr;
  }

  .app-main.with-ast-and-graph .ast-panel,
  .app-main.with-ast-and-graph .graph-panel {
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .app-main,
  .app-main.with-ast,
  .app-main.with-graph,
  .app-main.with-ast-and-graph {
    grid-template-columns: 1fr;
  }

  .app-main.with-ast .ast-panel,
  .app-main.with-graph .graph-panel,
  .app-main.with-ast-and-graph .ast-panel,
  .app-main.with-ast-and-graph .graph-panel {
    grid-column: span 1;
  }

  .panel {
    max-height: 400px;
  }

  .app-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .subtitle {
    width: 100%;
    margin-left: 0;
    order: 3;
  }
}

.panel {
  background: var(--panel-bg);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  min-height: 400px;
}

.app-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  margin-top: 0.5rem;
  color: #64748b;
  font-size: 0.8rem;
  background: var(--panel-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.footer-stats {
  color: var(--success-color);
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.separator {
  color: #4a5568;
}

.footer-links a {
  color: #667eea;
  text-decoration: none;
}

.footer-links a:hover {
  text-decoration: underline;
}

/* File type badge */
.file-type-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.file-type-badge.astr {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.file-type-badge.anum {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

/* Conversion panel */
.conversion-panel {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.conversion-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.conversion-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.conversion-subtitle {
  font-size: 0.75rem;
  opacity: 0.9;
}

.conversion-steps {
  display: flex;
  overflow-x: auto;
  padding: 1rem;
  gap: 0.5rem;
}

.conversion-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 150px;
  padding: 0.75rem;
  background: var(--accent-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  position: relative;
}

.conversion-step:not(:last-child)::after {
  content: '→';
  position: absolute;
  right: -1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 1.2rem;
}

.conversion-step.initial {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

.step-number {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.step-content {
  text-align: center;
  width: 100%;
}

.step-char {
  margin-bottom: 0.25rem;
}

.char-label {
  font-size: 0.7rem;
  color: #94a3b8;
}

.char-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  color: #fbbf24;
  margin-left: 0.25rem;
}

.step-description {
  font-size: 0.7rem;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.step-formal {
  font-size: 0.75rem;
  word-break: break-all;
}

.step-formal code {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Quaternary anumber conversion panel styles */
.anum-header {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.abit-legend {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.legend-item {
  font-size: 0.75rem;
  color: #94a3b8;
}

.legend-item code {
  background: rgba(245, 158, 11, 0.3);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-weight: 600;
  color: #fbbf24;
  margin-right: 0.25rem;
}

.abit-value {
  color: #f59e0b;
}

.step-definition {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

.def-label {
  font-size: 0.75rem;
  color: #64748b;
}

.def-value {
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  color: #f59e0b;
}
</style>
