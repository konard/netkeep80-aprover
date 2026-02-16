# Интерактивный режим доказательства

> **Статус:** Завершён
> **Этап:** 5.6

## Краткое описание

Интерактивный режим позволяет пользователю управлять процессом доказательства пошагово: выбирать применяемые правила, отменять действия, получать подсказки и сохранять историю.

---

## 1. Возможности

### Обзор

| Возможность | Описание |
|-------------|----------|
| Пошаговое доказательство | Полный контроль над каждым шагом |
| Три стратегии | Automatic, manual, guided |
| Подсказки | Список доступных шагов с оценкой уверенности |
| Undo/Redo | Откат и повтор шагов |
| История | Навигация по истории доказательства |
| Множественные цели | Одновременная работа с несколькими целями |

---

## 2. Стратегии доказательства

### Описание стратегий

| Стратегия | Название | Описание |
|-----------|----------|----------|
| `automatic` | Автоматический | Прувер применяет все доступные правила автоматически |
| `manual` | Ручной | Пользователь выбирает каждый шаг самостоятельно |
| `guided` | С подсказками | Прувер предлагает шаги, пользователь выбирает из вариантов |

### Константы

```typescript
const STRATEGY_DESCRIPTIONS: Record<ProofStrategy, { name: string; description: string }> = {
  automatic: {
    name: 'Автоматический',
    description: 'Прувер автоматически применяет все доступные правила вывода'
  },
  manual: {
    name: 'Ручной',
    description: 'Пользователь выбирает каждый шаг доказательства'
  },
  guided: {
    name: 'С подсказками',
    description: 'Прувер предлагает шаги, пользователь выбирает из вариантов'
  }
}
```

---

## 3. Класс ProofSession

### Создание сессии

```typescript
import { createProofSession, ProofSession } from './src/core/interactive'

const session = createProofSession('guided')
```

### Основные методы

| Метод | Описание |
|-------|----------|
| `addGoal(goal)` | Добавить цель доказательства |
| `addGoalFromString(input)` | Добавить цель из строки |
| `getCurrentGoal()` | Получить текущую цель |
| `getRemainingGoals()` | Получить все оставшиеся цели |
| `getAvailableSteps()` | Получить доступные шаги |
| `applyStep(stepId)` | Применить конкретный шаг |
| `applyBestStep()` | Применить лучший шаг (автоматически) |
| `runAutomatic()` | Запустить автоматическое доказательство |
| `undo()` | Отменить последнее действие |
| `redo()` | Повторить отменённое действие |
| `getHistory()` | Получить историю сессии |
| `jumpToHistory(index)` | Перейти к точке в истории |
| `reset()` | Сбросить сессию |

---

## 4. Структуры данных

### AvailableStep

```typescript
interface AvailableStep {
  /** Уникальный идентификатор */
  id: string

  /** Тип шага */
  type: StepType

  /** Человекочитаемое описание */
  description: string

  /** Применяемая аксиома (если есть) */
  axiom?: AxiomInfo

  /** Выражение до шага */
  before: string

  /** Ожидаемое выражение после */
  after: string

  /** Оценка уверенности (0-1) */
  confidence: number

  /** Дополнительные детали */
  details?: string
}
```

### StepType

```typescript
type StepType =
  | 'axiom'         // Применение аксиомы
  | 'definition'    // Применение определения
  | 'modus_ponens'  // Modus Ponens
  | 'transitivity'  // Транзитивность равенства
  | 'symmetry'      // Симметрия равенства
  | 'congruence'    // Конгруэнция
  | 'normalize'     // Нормализация
  | 'expand'        // Раскрытие определений
  | 'unify'         // Унификация
```

### ProofSnapshot

```typescript
interface ProofSnapshot {
  timestamp: number
  state: ProverState
  currentGoal: ASTNode | null
  goals: ASTNode[]
  steps: ProofStep[]
  actionDescription: string
}
```

### StepResult

```typescript
interface StepResult {
  success: boolean
  result?: ProofResult
  newGoals?: ASTNode[]
  closedGoals?: ASTNode[]
  error?: string
}
```

---

## 5. Генерация доступных шагов

### Алгоритм getAvailableSteps()

```
getAvailableSteps():
  steps = []

  // 1. Нормализация (всегда доступна)
  steps.push({ type: 'normalize', confidence: 0.5 })

  // 2. Для EqExpr:
  if goal.type === 'Equality':
    - Рефлексивность (A1) если left === right: confidence = 1.0
    - Male axiom (A5) если есть ♂: confidence = 0.8
    - Female axiom (A6) если есть ♀: confidence = 0.8
    - Infinity axiom (A4) если есть ∞: confidence = 0.8
    - Симметрия (A1): confidence = 0.3
    - Раскрытие определений (A0): confidence = 0.6
    - Унификация: confidence = 0.7
    - Конгруэнция (A2) для LinkExpr: confidence = 0.6
    - Транзитивность (A1) если есть provenEqualities: confidence = 0.5

  // 3. Для LinkExpr:
  if goal.type === 'Link':
    - Modus Ponens если есть provenFacts: confidence = 0.7
    - Регистрация импликации: confidence = 0.5

  // 4. Для DefExpr:
  if goal.type === 'Definition':
    - Регистрация определения: confidence = 1.0

  // 5. Сортировка по confidence (убывание)
  return steps.sort((a, b) => b.confidence - a.confidence)
```

---

## 6. Применение шагов

### applyStep()

```typescript
function applyStep(stepId: string): StepResult {
  // 1. Найти шаг по ID
  const step = availableSteps.find(s => s.id === stepId)
  if (!step) return { success: false, error: 'Шаг не найден' }

  // 2. Сохранить snapshot для undo
  saveSnapshot(`Применение: ${step.description}`)

  // 3. Верифицировать текущую цель
  const result = verify(currentGoal, state)

  // 4. Записать шаг
  allSteps.push({
    index: allSteps.length + 1,
    action: step.description,
    before: step.before,
    after: result.success ? '✓ Доказано' : step.after,
    axiom: step.axiom,
    details: step.details
  })

  // 5. Если успешно — удалить цель
  if (result.success) {
    goals.splice(currentGoalIndex, 1)
    updateStatus()
  }

  // 6. Особый случай: конгруэнция создаёт подцели
  if (step.type === 'congruence' && isEqExpr(goal) && ...) {
    // Заменить цель на две подцели
  }

  return { success: true, result }
}
```

### applyBestStep()

```typescript
function applyBestStep(): StepResult {
  const steps = getAvailableSteps()
  if (steps.length === 0) {
    return { success: false, error: 'Нет доступных шагов' }
  }
  // Применить шаг с наивысшей confidence
  return applyStep(steps[0].id)
}
```

---

## 7. Undo/Redo

### История состояний

```typescript
private history: ProofSnapshot[] = []
private historyIndex: number = -1
private future: ProofSnapshot[] = []
```

### undo()

```typescript
function undo(): boolean {
  if (!canUndo()) return false

  // Сохранить текущее состояние в future
  future.unshift(createSnapshot('Текущее состояние'))

  // Восстановить предыдущее состояние
  historyIndex--
  restoreSnapshot(history[historyIndex])

  return true
}
```

### redo()

```typescript
function redo(): boolean {
  if (!canRedo()) return false

  // Восстановить состояние из future
  const snapshot = future.shift()
  restoreSnapshot(snapshot)
  historyIndex++

  return true
}
```

### jumpToHistory()

```typescript
function jumpToHistory(index: number): boolean {
  if (index < 0 || index >= history.length) return false

  // Сохранить всё после index в future
  if (index < historyIndex) {
    const toFuture = history.slice(index + 1, historyIndex + 1)
    future = toFuture.concat(future)
  }

  historyIndex = index
  restoreSnapshot(history[index])

  return true
}
```

---

## 8. Автоматический режим

### runAutomatic()

```typescript
function runAutomatic(): StepResult[] {
  const results: StepResult[] = []
  let iterations = 0
  const maxIterations = 100

  while (getCurrentGoal() && iterations < maxIterations) {
    const result = applyBestStep()
    results.push(result)

    if (!result.success) break

    iterations++
  }

  return results
}
```

**Ограничения:**
- Максимум 100 итераций
- Остановка при первой неудаче

---

## 9. Вспомогательные функции

### quickProof()

```typescript
function quickProof(
  goal: ASTNode,
  state?: ProverState
): {
  success: boolean
  steps: ProofStep[]
  finalState: ProverState
}
```

Быстрая попытка автоматического доказательства:

```typescript
const session = new ProofSession('automatic')
if (state) session.state = cloneState(state)
session.addGoal(goal)
session.runAutomatic()

return {
  success: session.status === 'completed',
  steps: session.getProofSteps(),
  finalState: session.getState()
}
```

### getSuggestedSteps()

```typescript
function getSuggestedSteps(
  goal: ASTNode,
  state: ProverState,
  maxSteps: number = 5
): AvailableStep[]
```

Получение подсказок без создания полной сессии:

```typescript
const session = new ProofSession('guided')
session.state = cloneState(state)
session.addGoal(goal)
return session.getAvailableSteps().slice(0, maxSteps)
```

---

## 10. Статус сессии

### SessionStatus

```typescript
type SessionStatus = 'initial' | 'in_progress' | 'completed' | 'failed'
```

| Статус | Описание |
|--------|----------|
| `initial` | Сессия создана, целей нет |
| `in_progress` | Есть цели для доказательства |
| `completed` | Все цели доказаны |
| `failed` | Доказательство невозможно |

### Обновление статуса

```typescript
private updateStatus(): void {
  if (goals.length === 0) {
    _status = allSteps.length > 0 ? 'completed' : 'initial'
  } else {
    _status = 'in_progress'
  }
}
```

---

## 11. Использование в UI

### Кнопка INT в панели инструментов

1. Нажать **INT** для переключения в интерактивный режим
2. Ввести цель доказательства
3. Выбрать стратегию (auto, manual, guided)
4. Применять шаги из списка
5. Использовать ⟲/⟳ для undo/redo
6. Просматривать историю в правой панели

### Пример сессии

```typescript
// 1. Создание сессии
const session = createProofSession('guided')

// 2. Добавление цели
session.addGoalFromString('∞ = ∞ → ∞')

// 3. Получение подсказок
const steps = session.getAvailableSteps()
console.log(steps)
// [
//   { id: 'step-1-...', type: 'axiom', axiom: A4, confidence: 0.8, ... },
//   { id: 'step-2-...', type: 'normalize', confidence: 0.5, ... },
//   ...
// ]

// 4. Применение шага
const result = session.applyStep(steps[0].id)
console.log(result.success) // true

// 5. Проверка статуса
console.log(session.status) // 'completed'

// 6. Получение истории
const history = session.getHistory()
console.log(history)
// [
//   { index: 0, description: 'Начало сессии', timestamp: ... },
//   { index: 1, description: 'Добавлена цель: ∞ = (∞ → ∞)', timestamp: ... },
//   { index: 2, description: 'Применение: Применить аксиому ∞ = (∞ → ∞)', timestamp: ... }
// ]
```

---

## 12. Реализация в коде

### Таблица экспортов

| Экспорт | Тип | Описание |
|---------|-----|----------|
| `ProofSession` | class | Класс сессии |
| `createProofSession()` | function | Фабрика сессий |
| `getSuggestedSteps()` | function | Получение подсказок |
| `quickProof()` | function | Быстрое доказательство |
| `ProofStrategy` | type | Тип стратегии |
| `AvailableStep` | interface | Доступный шаг |
| `StepResult` | interface | Результат шага |
| `StepType` | type | Тип шага |
| `STRATEGY_DESCRIPTIONS` | const | Описания стратегий |

### Расположение в коде

| Элемент | Файл | Строка |
|---------|------|--------|
| `ProofSession` | `interactive.ts` | 132 |
| `createProofSession()` | `interactive.ts` | 817 |
| `getSuggestedSteps()` | `interactive.ts` | 825 |
| `quickProof()` | `interactive.ts` | 840 |
| `getAvailableSteps()` | `interactive.ts` | 331 |
| `applyStep()` | `interactive.ts` | 532 |
| `undo()` | `interactive.ts` | 662 |
| `redo()` | `interactive.ts` | 682 |

---

## 13. Связь с другими компонентами

### Зависимости

```typescript
import { verify, createProverState, AXIOMS } from './prover'
import { normalize, toCanonicalString } from './normalizer'
import { parseExpr } from './parser'
```

### Использование в UI

- `InteractiveProver.vue` — компонент интерактивного режима
- `App.vue` — интеграция с основным приложением

---

## См. также

- [Архитектура прувера](01-architecture.md) — общая структура
- [Алгоритм резолюции](02-resolution.md) — детали резолюции
- [Modus Ponens](03-modus-ponens.md) — правило вывода
- [API документация](../../API.md) — программный интерфейс

---

*Реализовано в рамках Фазы 4 разработки aprover.*
