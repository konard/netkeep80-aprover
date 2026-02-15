<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ProofSession,
  createProofSession,
  STRATEGY_DESCRIPTIONS,
  type ProofStrategy,
  type AvailableStep,
  type StepResult,
} from '../core/interactive'
import type { ASTNode } from '../core/ast'
import { toCanonicalString } from '../core/normalizer'

const props = defineProps<{
  /** Initial goals to add to the session */
  initialGoals?: ASTNode[]
  /** Whether interactive mode is active */
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'proof-complete', steps: any[]): void
}>()

// Session state
const session = ref<ProofSession>(createProofSession('guided'))
const availableSteps = ref<AvailableStep[]>([])
const lastResult = ref<StepResult | null>(null)
const showHistory = ref(false)

// Strategy selection
const strategies: ProofStrategy[] = ['automatic', 'manual', 'guided']
const currentStrategy = computed(() => session.value.getStrategy())

// Computed state
const currentGoal = computed(() => {
  const goal = session.value.getCurrentGoal()
  return goal ? toCanonicalString(goal) : null
})

const remainingGoals = computed(() => {
  return session.value.getRemainingGoals().map(g => toCanonicalString(g))
})

const proofSteps = computed(() => session.value.getProofSteps())

const sessionStatus = computed(() => session.value.status)

const canUndo = computed(() => session.value.canUndo())
const canRedo = computed(() => session.value.canRedo())

const history = computed(() => session.value.getHistory())

// Initialize with goals when active
watch(
  () => props.active,
  active => {
    if (active && props.initialGoals && props.initialGoals.length > 0) {
      session.value = createProofSession('guided')
      session.value.addGoals(props.initialGoals)
      refreshSteps()
    }
  },
  { immediate: true }
)

// Refresh available steps
const refreshSteps = () => {
  availableSteps.value = session.value.getAvailableSteps()
}

// Set strategy
const setStrategy = (strategy: ProofStrategy) => {
  session.value.setStrategy(strategy)
  refreshSteps()
}

// Apply a specific step
const applyStep = (stepId: string) => {
  lastResult.value = session.value.applyStep(stepId)
  refreshSteps()

  if (session.value.status === 'completed') {
    emit('proof-complete', session.value.getProofSteps())
  }
}

// Apply best step (for automatic mode)
const applyBestStep = () => {
  lastResult.value = session.value.applyBestStep()
  refreshSteps()

  if (session.value.status === 'completed') {
    emit('proof-complete', session.value.getProofSteps())
  }
}

// Run automatic proof
const runAutomatic = () => {
  session.value.runAutomatic()
  refreshSteps()

  if (session.value.status === 'completed') {
    emit('proof-complete', session.value.getProofSteps())
  }
}

// Undo/Redo
const undo = () => {
  if (session.value.undo()) {
    refreshSteps()
  }
}

const redo = () => {
  if (session.value.redo()) {
    refreshSteps()
  }
}

// Jump to history point
const jumpToHistory = (index: number) => {
  if (session.value.jumpToHistory(index)) {
    refreshSteps()
  }
}

// Reset session
const reset = () => {
  session.value.reset()
  if (props.initialGoals) {
    session.value.addGoals(props.initialGoals)
  }
  refreshSteps()
  lastResult.value = null
}

// Close interactive mode
const close = () => {
  emit('close')
}

// Get confidence class for step
const getConfidenceClass = (confidence: number): string => {
  if (confidence >= 0.9) return 'confidence-high'
  if (confidence >= 0.6) return 'confidence-medium'
  return 'confidence-low'
}
</script>

<template>
  <div v-if="active" class="interactive-prover">
    <div class="prover-header">
      <div class="header-left">
        <span class="prover-icon">INT</span>
        <span class="prover-title">Интерактивный режим доказательства</span>
        <span class="status-badge" :class="sessionStatus">
          {{
            sessionStatus === 'initial'
              ? 'Начало'
              : sessionStatus === 'in_progress'
                ? 'В процессе'
                : sessionStatus === 'completed'
                  ? 'Завершено'
                  : 'Ошибка'
          }}
        </span>
      </div>
      <div class="header-right">
        <button class="control-btn" :disabled="!canUndo" title="Отмена (Undo)" @click="undo">
          ↩
        </button>
        <button class="control-btn" :disabled="!canRedo" title="Повтор (Redo)" @click="redo">
          ↪
        </button>
        <button class="control-btn" title="История" @click="showHistory = !showHistory">📜</button>
        <button class="control-btn" title="Сбросить" @click="reset">🔄</button>
        <button class="close-btn" title="Закрыть" @click="close">×</button>
      </div>
    </div>

    <div class="prover-content">
      <!-- Strategy selector -->
      <div class="strategy-section">
        <span class="section-label">Стратегия:</span>
        <div class="strategy-buttons">
          <button
            v-for="strategy in strategies"
            :key="strategy"
            class="strategy-btn"
            :class="{ active: currentStrategy === strategy }"
            :title="STRATEGY_DESCRIPTIONS[strategy].description"
            @click="setStrategy(strategy)"
          >
            {{ STRATEGY_DESCRIPTIONS[strategy].name }}
          </button>
        </div>
        <button
          v-if="currentStrategy === 'automatic'"
          class="auto-run-btn"
          :disabled="sessionStatus !== 'in_progress'"
          @click="runAutomatic"
        >
          ▶ Запустить автоматически
        </button>
        <button
          v-if="currentStrategy === 'guided'"
          class="auto-run-btn"
          :disabled="sessionStatus !== 'in_progress' || availableSteps.length === 0"
          @click="applyBestStep"
        >
          ▶ Применить лучший шаг
        </button>
      </div>

      <!-- Current goal -->
      <div class="goal-section">
        <div class="section-header">
          <span class="section-label">Текущая цель:</span>
          <span v-if="remainingGoals.length > 1" class="goals-count">
            ({{ remainingGoals.length }} осталось)
          </span>
        </div>
        <div v-if="currentGoal" class="current-goal">
          <code>{{ currentGoal }}</code>
        </div>
        <div v-else class="no-goal">
          <span v-if="sessionStatus === 'completed'">✓ Все цели доказаны!</span>
          <span v-else>Нет активных целей</span>
        </div>
      </div>

      <!-- Available steps -->
      <div
        v-if="availableSteps.length > 0 && sessionStatus === 'in_progress'"
        class="steps-section"
      >
        <div class="section-header">
          <span class="section-label">Доступные шаги:</span>
        </div>
        <div class="steps-list">
          <div
            v-for="step in availableSteps"
            :key="step.id"
            class="step-item"
            :class="getConfidenceClass(step.confidence)"
            @click="applyStep(step.id)"
          >
            <div class="step-header">
              <span class="step-type">{{ step.type }}</span>
              <span v-if="step.axiom" class="step-axiom" :title="step.axiom.formula">
                [{{ step.axiom.id }}]
              </span>
              <span
                class="step-confidence"
                :title="`Уверенность: ${Math.round(step.confidence * 100)}%`"
              >
                {{ Math.round(step.confidence * 100) }}%
              </span>
            </div>
            <div class="step-description">{{ step.description }}</div>
            <div v-if="step.details" class="step-details">{{ step.details }}</div>
          </div>
        </div>
      </div>

      <!-- Proof steps taken -->
      <div v-if="proofSteps.length > 0" class="proof-steps-section">
        <div class="section-header">
          <span class="section-label">Шаги доказательства:</span>
        </div>
        <div class="proof-steps-list">
          <div v-for="step in proofSteps" :key="step.index" class="proof-step-item">
            <span class="step-index">{{ step.index }}.</span>
            <span class="step-action">{{ step.action }}</span>
            <span v-if="step.axiom" class="step-axiom-badge">
              {{ step.axiom.id }}
            </span>
          </div>
        </div>
      </div>

      <!-- Last result message -->
      <div v-if="lastResult" class="result-section">
        <div
          class="result-message"
          :class="{ success: lastResult.success, failure: !lastResult.success }"
        >
          <span v-if="lastResult.success">✓</span>
          <span v-else>✗</span>
          <span v-if="lastResult.result">{{ lastResult.result.message }}</span>
          <span v-else-if="lastResult.error">{{ lastResult.error }}</span>
        </div>
      </div>

      <!-- History panel -->
      <div v-if="showHistory" class="history-section">
        <div class="section-header">
          <span class="section-label">История:</span>
          <button class="close-history-btn" @click="showHistory = false">×</button>
        </div>
        <div class="history-list">
          <div
            v-for="item in history"
            :key="item.index"
            class="history-item"
            @click="jumpToHistory(item.index)"
          >
            <span class="history-index">{{ item.index + 1 }}.</span>
            <span class="history-description">{{ item.description }}</span>
            <span class="history-time">
              {{ new Date(item.timestamp).toLocaleTimeString() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interactive-prover {
  background: var(--panel-bg);
  border: 2px solid #667eea;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.prover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.prover-icon {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.prover-title {
  font-weight: 500;
  font-size: 0.9rem;
}

.status-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.initial {
  background: rgba(255, 255, 255, 0.2);
}

.status-badge.in_progress {
  background: #fbbf24;
  color: #000;
}

.status-badge.completed {
  background: var(--success-color);
  color: #000;
}

.status-badge.failed {
  background: var(--error-color);
}

.header-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.control-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.control-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.close-btn:hover {
  color: var(--error-color);
}

.prover-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.section-label {
  font-size: 0.85rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.goals-count {
  font-size: 0.75rem;
  color: #64748b;
}

/* Strategy section */
.strategy-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.strategy-buttons {
  display: flex;
  gap: 0.25rem;
}

.strategy-btn {
  background: var(--accent-color);
  border: 1px solid var(--border-color);
  color: #94a3b8;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.strategy-btn:hover {
  background: #1a3a5c;
  color: var(--text-color);
}

.strategy-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.auto-run-btn {
  background: var(--success-color);
  border: none;
  color: #000;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: background 0.2s;
}

.auto-run-btn:hover:not(:disabled) {
  background: #22c55e;
}

.auto-run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Goal section */
.current-goal {
  background: var(--accent-color);
  padding: 0.75rem;
  border-radius: 4px;
  border-left: 3px solid #667eea;
}

.current-goal code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  color: var(--text-color);
}

.no-goal {
  color: #64748b;
  font-style: italic;
  padding: 0.5rem;
}

/* Steps section */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-item {
  background: var(--accent-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.step-item:hover {
  background: #1a3a5c;
  border-color: #667eea;
}

.step-item.confidence-high {
  border-left: 3px solid var(--success-color);
}

.step-item.confidence-medium {
  border-left: 3px solid #fbbf24;
}

.step-item.confidence-low {
  border-left: 3px solid #64748b;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.step-type {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.step-axiom {
  color: #a78bfa;
  font-size: 0.75rem;
  font-weight: 500;
}

.step-confidence {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}

.step-description {
  font-size: 0.85rem;
  color: var(--text-color);
}

.step-details {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
  font-style: italic;
}

/* Proof steps section */
.proof-steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.proof-step-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  font-size: 0.8rem;
}

.step-index {
  color: #667eea;
  font-weight: 600;
}

.step-action {
  color: var(--text-color);
}

.step-axiom-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: bold;
  margin-left: auto;
}

/* Result section */
.result-section {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.result-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.result-message.success {
  background: rgba(74, 222, 128, 0.1);
  color: var(--success-color);
}

.result-message.failure {
  background: rgba(248, 113, 113, 0.1);
  color: var(--error-color);
}

/* History section */
.history-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 0.75rem;
}

.close-history-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 1rem;
  margin-left: auto;
}

.close-history-btn:hover {
  color: var(--text-color);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: var(--accent-color);
}

.history-index {
  color: #64748b;
  font-size: 0.75rem;
}

.history-description {
  font-size: 0.8rem;
  color: var(--text-color);
  flex: 1;
}

.history-time {
  font-size: 0.7rem;
  color: #64748b;
}
</style>
