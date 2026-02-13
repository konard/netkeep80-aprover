<script setup lang="ts">
import { defineProps, computed, ref } from 'vue'
import type { ProofResult, ProofStep, ProofHint } from '../core/prover'

const props = defineProps<{
  results: { stmt: string; result: ProofResult }[]
}>()

// Track which proof items are expanded to show detailed steps
const expandedItems = ref<Set<number>>(new Set())

const toggleExpanded = (index: number) => {
  if (expandedItems.value.has(index)) {
    expandedItems.value.delete(index)
  } else {
    expandedItems.value.add(index)
  }
  // Trigger reactivity
  expandedItems.value = new Set(expandedItems.value)
}

const isExpanded = (index: number) => expandedItems.value.has(index)

const stats = computed(() => {
  const total = props.results.length
  const passed = props.results.filter(r => r.result.success).length
  const failed = total - passed
  return { total, passed, failed }
})

// Get hint icon based on type
const getHintIcon = (hint: ProofHint) => {
  switch (hint.type) {
    case 'missing_definition':
      return '📖'
    case 'structure_mismatch':
      return '🔧'
    case 'unification_failed':
      return '⚠️'
    case 'suggestion':
      return '💡'
    default:
      return '📝'
  }
}

// Check if result has detailed proof steps
const hasDetailedSteps = (result: ProofResult) => {
  return result.proofSteps && result.proofSteps.length > 0
}
</script>

<template>
  <div class="prover-panel">
    <div class="prover-header">
      <span class="prover-icon">PRV</span>
      <span class="prover-title">Prover Results</span>
      <div v-if="results.length > 0" class="prover-stats">
        <span class="stat stat-passed">{{ stats.passed }} passed</span>
        <span v-if="stats.failed > 0" class="stat stat-failed">{{ stats.failed }} failed</span>
      </div>
    </div>

    <div class="prover-content">
      <div v-if="results.length === 0" class="prover-empty">
        <span>No statements to verify</span>
      </div>

      <div v-else class="results-list">
        <div
          v-for="(item, index) in results"
          :key="index"
          class="result-item"
          :class="{ success: item.result.success, failure: !item.result.success }"
        >
          <div class="result-header" @click="toggleExpanded(index)">
            <span class="result-status">
              {{ item.result.success ? '✓' : '✗' }}
            </span>
            <span class="result-stmt">{{ item.stmt }}</span>
            <span
              v-if="hasDetailedSteps(item.result)"
              class="expand-toggle"
              :class="{ expanded: isExpanded(index) }"
            >
              {{ isExpanded(index) ? '▼' : '▶' }}
            </span>
          </div>
          <div class="result-message">
            {{ item.result.message }}
          </div>

          <!-- Detailed proof steps (shown when expanded) -->
          <div
            v-if="hasDetailedSteps(item.result) && isExpanded(index)"
            class="proof-details"
          >
            <div class="proof-steps-header">
              <span class="steps-icon">📜</span>
              Шаги доказательства:
            </div>
            <div class="proof-steps-list">
              <div
                v-for="step in item.result.proofSteps"
                :key="step.number"
                class="proof-step"
              >
                <div class="step-header">
                  <span class="step-number">{{ step.number }}.</span>
                  <span class="step-action">{{ step.action }}</span>
                  <span v-if="step.axiom" class="step-axiom" :title="step.axiom.description">
                    [{{ step.axiom.id }}]
                  </span>
                </div>
                <div v-if="step.axiom" class="step-axiom-info">
                  <span class="axiom-name">{{ step.axiom.name }}</span>
                  <span class="axiom-formula">{{ step.axiom.formula }}</span>
                </div>
                <div v-if="step.before || step.after" class="step-transformation">
                  <span v-if="step.before" class="step-before">{{ step.before }}</span>
                  <span v-if="step.before && step.after" class="step-arrow">→</span>
                  <span v-if="step.after" class="step-after">{{ step.after }}</span>
                </div>
                <div v-if="step.details" class="step-details">
                  {{ step.details }}
                </div>
              </div>
            </div>

            <!-- Hints for failed verifications -->
            <div
              v-if="item.result.hints && item.result.hints.length > 0"
              class="proof-hints"
            >
              <div class="hints-header">
                <span class="hints-icon">💡</span>
                Подсказки:
              </div>
              <div class="hints-list">
                <div
                  v-for="(hint, hintIdx) in item.result.hints"
                  :key="hintIdx"
                  class="hint-item"
                  :class="hint.type"
                >
                  <span class="hint-icon">{{ getHintIcon(hint) }}</span>
                  <div class="hint-content">
                    <span class="hint-message">{{ hint.message }}</span>
                    <span v-if="hint.suggestion" class="hint-suggestion">
                      {{ hint.suggestion }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Legacy simple steps (shown when no detailed steps available) -->
          <div
            v-else-if="item.result.steps && item.result.steps.length > 0 && !hasDetailedSteps(item.result)"
            class="result-steps"
          >
            <div class="steps-header">Proof steps:</div>
            <ol class="steps-list">
              <li v-for="(step, stepIndex) in item.result.steps" :key="stepIndex">
                {{ step }}
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prover-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.prover-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.prover-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.prover-title {
  color: #94a3b8;
}

.prover-stats {
  margin-left: auto;
  display: flex;
  gap: 0.75rem;
}

.stat {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
}

.stat-passed {
  color: var(--success-color);
  background: rgba(74, 222, 128, 0.1);
}

.stat-failed {
  color: var(--error-color);
  background: rgba(248, 113, 113, 0.1);
}

.prover-content {
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
}

.prover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  background: var(--panel-bg);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--border-color);
}

.result-item.success {
  border-left-color: var(--success-color);
}

.result-item.failure {
  border-left-color: var(--error-color);
}

.result-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
  user-select: none;
}

.result-header:hover {
  opacity: 0.9;
}

.result-status {
  font-weight: bold;
  font-size: 1rem;
}

.result-item.success .result-status {
  color: var(--success-color);
}

.result-item.failure .result-status {
  color: var(--error-color);
}

.result-stmt {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  word-break: break-all;
  flex: 1;
}

.expand-toggle {
  color: #64748b;
  font-size: 0.75rem;
  transition: transform 0.2s;
  padding: 0.1rem 0.3rem;
}

.expand-toggle.expanded {
  color: #94a3b8;
}

.result-message {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-left: 1.5rem;
}

/* Legacy steps */
.result-steps {
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.steps-header {
  color: #64748b;
  font-size: 0.75rem;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.steps-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.steps-list li {
  margin-bottom: 0.15rem;
}

/* Detailed proof steps */
.proof-details {
  margin-top: 0.75rem;
  margin-left: 1.5rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
}

.proof-steps-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.steps-icon,
.hints-icon {
  font-size: 1rem;
}

.proof-steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.proof-step {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  border-left: 2px solid #667eea;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.step-number {
  color: #667eea;
  font-weight: bold;
  font-size: 0.85rem;
  min-width: 1.5rem;
}

.step-action {
  color: #e2e8f0;
  font-size: 0.85rem;
  flex: 1;
}

.step-axiom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  cursor: help;
}

.step-axiom-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-left: 1.5rem;
  margin-bottom: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 3px;
  font-size: 0.75rem;
}

.axiom-name {
  color: #a5b4fc;
  font-weight: 500;
}

.axiom-formula {
  color: #94a3b8;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.step-transformation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1.5rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.step-before {
  color: #fca5a5;
}

.step-arrow {
  color: #667eea;
}

.step-after {
  color: #86efac;
}

.step-details {
  margin-left: 1.5rem;
  color: #64748b;
  font-size: 0.75rem;
  font-style: italic;
}

/* Hints section */
.proof-hints {
  margin-top: 0.75rem;
  border-top: 1px dashed var(--border-color);
  padding-top: 0.5rem;
}

.hints-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fbbf24;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.hints-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hint-item {
  display: flex;
  gap: 0.5rem;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  border-left: 2px solid #fbbf24;
}

.hint-item.missing_definition {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.hint-item.structure_mismatch {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.hint-item.unification_failed {
  border-left-color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

.hint-item.suggestion {
  border-left-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.hint-icon {
  font-size: 1rem;
}

.hint-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.hint-message {
  color: #e2e8f0;
  font-size: 0.8rem;
}

.hint-suggestion {
  color: #86efac;
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
</style>
