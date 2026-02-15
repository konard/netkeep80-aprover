<script setup lang="ts">
import { defineEmits, defineProps, ref, watch, computed } from 'vue'
import type { SourceLocation } from '../core/ast'

const props = defineProps<{
  modelValue: string
  highlightedLoc?: SourceLocation | null
  errorLoc?: SourceLocation | null
  fileName?: string
  isDragOver?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'file-drop': [file: File]
  'cursor-position': [loc: SourceLocation | null]
}>()

// Symbol insertion functionality
const insertSymbol = (symbol: string) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentValue = props.modelValue

  // Insert symbol at cursor position
  const newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end)

  emit('update:modelValue', newValue)

  // Restore focus and cursor position after the inserted symbol
  setTimeout(() => {
    textarea.focus()
    const newCursorPos = start + symbol.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  }, 0)
}

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

// Simple syntax highlighting via CSS classes on overlay
// For now, we just use the textarea with proper styling
// Future: implement CodeMirror or Monaco integration

// Token-based syntax highlighting to avoid HTML attribute conflicts
interface Token {
  type: string
  value: string
}

// Tokenize a line of code (not including comments)
function tokenizeLine(code: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < code.length) {
    // Multi-character operators (check first)
    if (code.slice(pos, pos + 3) === '!->') {
      tokens.push({ type: 'operator', value: '!->' })
      pos += 3
      continue
    }
    if (code.slice(pos, pos + 2) === '->') {
      tokens.push({ type: 'operator', value: '->' })
      pos += 2
      continue
    }
    if (code.slice(pos, pos + 2) === '!=') {
      tokens.push({ type: 'equality', value: '!=' })
      pos += 2
      continue
    }
    if (code.slice(pos, pos + 2) === '¬=') {
      tokens.push({ type: 'equality', value: '¬=' })
      pos += 2
      continue
    }

    const char = code[pos]

    // Special symbols
    if (char === '∞') {
      tokens.push({ type: 'symbol infinity', value: char })
      pos++
      continue
    }
    if (char === '♂') {
      tokens.push({ type: 'symbol male', value: char })
      pos++
      continue
    }
    if (char === '♀') {
      tokens.push({ type: 'symbol female', value: char })
      pos++
      continue
    }
    if (char === '≠') {
      tokens.push({ type: 'equality', value: char })
      pos++
      continue
    }

    // Standalone negation
    if ((char === '!' || char === '¬') && code[pos + 1] !== '-' && code[pos + 1] !== '=') {
      tokens.push({ type: 'negation', value: char })
      pos++
      continue
    }

    // Power operator
    if (char === '^') {
      tokens.push({ type: 'power', value: char })
      pos++
      continue
    }

    // Definition colon (surrounded by whitespace)
    if (
      char === ':' &&
      pos > 0 &&
      pos < code.length - 1 &&
      /\s/.test(code[pos - 1]) &&
      /\s/.test(code[pos + 1])
    ) {
      tokens.push({ type: 'define', value: char })
      pos++
      continue
    }

    // Equality sign (standalone)
    if (char === '=') {
      tokens.push({ type: 'equality', value: char })
      pos++
      continue
    }

    // Brackets
    if (char === '(' || char === ')') {
      tokens.push({ type: 'bracket paren', value: char })
      pos++
      continue
    }
    if (char === '{' || char === '}') {
      tokens.push({ type: 'bracket brace', value: char })
      pos++
      continue
    }
    if (char === '[' || char === ']') {
      tokens.push({ type: 'bracket square', value: char })
      pos++
      continue
    }

    // Dot (statement terminator)
    if (char === '.' && (pos === code.length - 1 || /\s/.test(code[pos + 1]))) {
      tokens.push({ type: 'dot', value: char })
      pos++
      continue
    }

    // Numbers (0 and 1 as special constants)
    if (
      (char === '0' || char === '1') &&
      (pos === 0 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos - 1])) &&
      (pos === code.length - 1 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos + 1]))
    ) {
      tokens.push({ type: 'number', value: char })
      pos++
      continue
    }

    // Identifiers
    if (/[a-zA-Zа-яА-ЯёЁ_]/.test(char)) {
      let id = char
      pos++
      while (pos < code.length && /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos])) {
        id += code[pos]
        pos++
      }
      tokens.push({ type: 'identifier', value: id })
      continue
    }

    // Plain text (whitespace, etc.)
    tokens.push({ type: 'text', value: char })
    pos++
  }

  return tokens
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convert tokens to highlighted HTML
function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map(token => {
      const escaped = escapeHtml(token.value)
      if (token.type === 'text') {
        return escaped
      }
      return `<span class="${token.type}">${escaped}</span>`
    })
    .join('')
}

// Create a highlight marker for AST node selection
function applyHighlightMarker(
  html: string,
  lineIndex: number,
  loc: SourceLocation | null | undefined
): string {
  if (!loc) return html

  const startLine = loc.start.line - 1 // 0-indexed
  const endLine = loc.end.line - 1

  if (lineIndex < startLine || lineIndex > endLine) {
    return html
  }

  // For simplicity, highlight the entire line content if it's within the range
  // A more precise implementation would track character positions
  if (lineIndex === startLine && lineIndex === endLine) {
    // Single line highlight - highlight from start column to end column
    return `<span class="ast-highlight">${html}</span>`
  } else if (lineIndex === startLine) {
    // First line of multi-line - highlight from start column to end
    return `<span class="ast-highlight">${html}</span>`
  } else if (lineIndex === endLine) {
    // Last line of multi-line - highlight from start to end column
    return `<span class="ast-highlight">${html}</span>`
  } else {
    // Middle lines - highlight entire line
    return `<span class="ast-highlight">${html}</span>`
  }
}

// Apply error highlighting to the character at error position
function applyErrorHighlight(
  html: string,
  line: string,
  lineIndex: number,
  errorLoc: SourceLocation | null | undefined
): string {
  if (!errorLoc) return html

  const errorLine = errorLoc.start.line - 1 // Convert to 0-indexed line
  const errorCol = errorLoc.start.column - 1 // Convert to 0-indexed column (lexer uses 1-based)

  if (lineIndex !== errorLine) {
    return html
  }

  // Find the position in the HTML to insert error highlight
  // We need to highlight the character at errorCol (0-indexed)
  // Since html may contain <span> tags, we need to count actual characters
  let charCount = 0
  let insertPos = 0
  let inTag = false
  let foundPosition = false

  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      inTag = true
    } else if (html[i] === '>') {
      inTag = false
      continue
    }

    if (!inTag) {
      if (charCount === errorCol) {
        insertPos = i
        foundPosition = true
        break
      }
      charCount++
    }
  }

  // If we found the position, wrap the character at that position in error highlight
  if (foundPosition && insertPos < html.length) {
    // Find the end of the current character (might be inside a span)
    let endPos = insertPos + 1
    // If the character is part of an HTML entity, extend to the end of entity
    if (html[insertPos] === '&') {
      while (endPos < html.length && html[endPos] !== ';') {
        endPos++
      }
      if (html[endPos] === ';') endPos++
    }

    const before = html.substring(0, insertPos)
    const char = html.substring(insertPos, endPos)
    const after = html.substring(endPos)
    return `${before}<span class="error-highlight">${char}</span>${after}`
  }

  return html
}

const highlightedContent = computed(() => {
  const text = props.modelValue
  const loc = props.highlightedLoc
  const errLoc = props.errorLoc

  // Process line by line to handle comments correctly
  const lines = text.split('\n')
  const processedLines = lines.map((line, lineIndex) => {
    let result: string
    // Check for comment
    const commentIndex = line.indexOf('//')
    if (commentIndex !== -1) {
      const beforeComment = line.substring(0, commentIndex)
      const comment = line.substring(commentIndex)
      const tokens = tokenizeLine(beforeComment)
      result = tokensToHtml(tokens) + `<span class="comment">${escapeHtml(comment)}</span>`
    } else {
      const tokens = tokenizeLine(line)
      result = tokensToHtml(tokens)
    }

    // Apply error highlight first (so it's on top)
    result = applyErrorHighlight(result, line, lineIndex, errLoc)

    // Apply AST node highlight if applicable
    result = applyHighlightMarker(result, lineIndex, loc)

    return result
  })

  return processedLines.join('\n')
})

// Sync scroll between textarea and highlight layer
const handleScroll = () => {
  const textarea = textareaRef.value
  const highlight = document.querySelector('.highlight-layer') as HTMLElement
  if (textarea && highlight) {
    highlight.scrollTop = textarea.scrollTop
    highlight.scrollLeft = textarea.scrollLeft
  }
}

watch(
  () => props.modelValue,
  () => {
    // Trigger re-render of highlighted content
  }
)

// Drag and drop handling
const isDragging = ref(false)

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    emit('file-drop', file)
  }
}

// Computed display file name
const displayFileName = computed(() => {
  return props.fileName || 'input.mtl'
})

// File extension badge
const fileExtBadge = computed(() => {
  const name = displayFileName.value
  const ext = name.split('.').pop()?.toUpperCase()
  return ext || 'MTL'
})

// Track cursor position for AST highlighting
const handleMouseMove = (e: MouseEvent) => {
  const textarea = textareaRef.value
  if (!textarea) return

  // Get cursor position in textarea
  const rect = textarea.getBoundingClientRect()
  const x = e.clientX - rect.left + textarea.scrollLeft
  const y = e.clientY - rect.top + textarea.scrollTop

  // Calculate line and column from mouse position
  const lines = props.modelValue.split('\n')
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight)
  const charWidth = parseFloat(getComputedStyle(textarea).fontSize) * 0.6 // approximate

  const lineIndex = Math.floor(y / lineHeight)
  const colIndex = Math.floor(x / charWidth) - 1 // adjust for padding

  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex]
    const column = Math.max(0, Math.min(colIndex, line.length))

    // Calculate absolute offset
    let offset = 0
    for (let i = 0; i < lineIndex; i++) {
      offset += lines[i].length + 1 // +1 for newline
    }
    offset += column

    const loc: SourceLocation = {
      start: { line: lineIndex + 1, column, offset },
      end: { line: lineIndex + 1, column, offset },
    }

    emit('cursor-position', loc)
  }
}

const handleMouseLeave = () => {
  emit('cursor-position', null)
}
</script>

<template>
  <div
    class="editor-container"
    :class="{ 'drag-over': isDragging || isDragOver }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="editor-header">
      <span class="file-icon">{{ fileExtBadge }}</span>
      <span class="file-name">{{ displayFileName }}</span>
      <div class="symbol-buttons">
        <button
          class="symbol-btn"
          title="Вставить символ ∞ (бесконечность)"
          @click="insertSymbol('∞')"
        >
          ∞
        </button>
        <button class="symbol-btn" title="Вставить символ ♂ (начало)" @click="insertSymbol('♂')">
          ♂
        </button>
        <button class="symbol-btn" title="Вставить символ ♀ (конец)" @click="insertSymbol('♀')">
          ♀
        </button>
        <button class="symbol-btn" title="Вставить символ ¬ (инверсия)" @click="insertSymbol('¬')">
          ¬
        </button>
        <button
          class="symbol-btn"
          title="Вставить символ ≠ (неравенство)"
          @click="insertSymbol('≠')"
        >
          ≠
        </button>
      </div>
    </div>
    <div class="editor-content" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
      <div class="highlight-layer" v-html="highlightedContent"></div>
      <textarea
        ref="textareaRef"
        v-model="localValue"
        class="code-input"
        spellcheck="false"
        placeholder="// Введите формулы МТС...&#10;// Например:&#10;∞ = ∞ -> ∞.&#10;&#10;// Или перетащите файл .mtl сюда"
        @scroll="handleScroll"
      ></textarea>
      <div v-if="isDragging || isDragOver" class="drop-overlay">
        <div class="drop-message">
          <span class="drop-icon">📁</span>
          <span>Отпустите файл для загрузки</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
  justify-content: space-between;
}

.file-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.file-name {
  color: #94a3b8;
}

.editor-content {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--text-color);
  pointer-events: none;
  overflow: auto;
  text-align: left;
}

.code-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 1rem;
  background: transparent;
  border: none;
  color: transparent;
  caret-color: var(--text-color);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  resize: none;
  outline: none;
  text-align: left;
}

.code-input::placeholder {
  color: #4a5568;
}

/* Syntax highlighting classes */
:deep(.comment) {
  color: #6b7280;
  font-style: italic;
}

:deep(.operator) {
  color: #f472b6;
  font-weight: 500;
}

:deep(.symbol) {
  font-weight: bold;
}

:deep(.symbol.infinity) {
  color: #fbbf24;
}

:deep(.symbol.male) {
  color: #60a5fa;
}

:deep(.symbol.female) {
  color: #f472b6;
}

:deep(.negation) {
  color: #ef4444;
  font-weight: bold;
}

:deep(.power) {
  color: #8b5cf6;
}

:deep(.define) {
  color: #60a5fa;
  font-weight: bold;
}

:deep(.equality) {
  color: #34d399;
  font-weight: 500;
}

:deep(.bracket) {
  color: #94a3b8;
}

:deep(.bracket.paren) {
  color: #fbbf24;
}

:deep(.bracket.brace) {
  color: #f472b6;
}

:deep(.bracket.square) {
  color: #60a5fa;
}

:deep(.number) {
  color: #a78bfa;
  font-weight: bold;
}

:deep(.identifier) {
  color: #e2e8f0;
}

:deep(.dot) {
  color: #94a3b8;
}

:deep(.ast-highlight) {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.5);
}

:deep(.error-highlight) {
  background: rgba(248, 113, 113, 0.4);
  border-radius: 2px;
  box-shadow: 0 0 0 2px var(--error-color);
  padding: 0 2px;
  animation: pulse-error 1.5s ease-in-out infinite;
}

@keyframes pulse-error {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--error-color);
  }
  50% {
    box-shadow:
      0 0 0 2px var(--error-color),
      0 0 8px 2px var(--error-color);
  }
}

/* Drag and drop overlay */
.editor-container.drag-over {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.15);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 4px;
}

.drop-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color);
  font-size: 1rem;
}

.drop-icon {
  font-size: 2rem;
}

/* Symbol insertion buttons */
.symbol-buttons {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.symbol-btn {
  background: rgba(102, 126, 234, 0.2);
  color: var(--text-color);
  border: 1px solid rgba(102, 126, 234, 0.4);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.symbol-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  border-color: rgba(102, 126, 234, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.symbol-btn:active {
  transform: translateY(0);
}

/* Highlight the special symbols with their syntax highlighting colors */
.symbol-btn:nth-child(1) {
  /* ∞ - infinity */
  color: #fbbf24;
  font-weight: bold;
}

.symbol-btn:nth-child(2) {
  /* ♂ - male */
  color: #60a5fa;
  font-weight: bold;
}

.symbol-btn:nth-child(3) {
  /* ♀ - female */
  color: #f472b6;
  font-weight: bold;
}
</style>
