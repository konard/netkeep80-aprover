# Modus Ponens

> **Статус:** Завершён
> **Этап:** 5.6

## Краткое описание

Modus Ponens (MP) — фундаментальное правило вывода в МТС: если доказано P и (P → Q), то доказано Q. Реализовано в рамках Фазы 4 разработки.

---

## 1. Формула

```
P, (P → Q) ⊢ Q
```

**Словами:** Из P и импликации «P влечёт Q» можно вывести Q.

---

## 2. Онтологический смысл в МТС

В контексте МТС Modus Ponens имеет особую интерпретацию:

| Классическая логика | МТС |
|---------------------|-----|
| P — утверждение (истина/ложь) | P — доказанный факт (связь в асети) |
| P → Q — логическая импликация | P → Q — направленная связь |
| Вывод Q — логический переход | Вывод Q — резолюция через форму связи |

**Ключевое отличие:** В МТС импликация `P → Q` — это не абстрактное логическое отношение, а **конкретная связь** в асети. Применение MP — это нахождение связи Q через форму `P → Q`.

---

## 3. Структуры данных

### ProvenImplication

```typescript
interface ProvenImplication {
  /** Антецедент P в (P → Q) */
  antecedent: ASTNode

  /** Консеквент Q в (P → Q) */
  consequent: ASTNode

  /** Источник импликации */
  source: string
}
```

### Хранение в ProverState

```typescript
interface ProverState {
  /** Доказанные факты (канонические строки) */
  facts: Set<string>

  /** Доказанные факты как AST-узлы */
  provenFacts: ASTNode[]

  /** Доказанные импликации для MP */
  provenImplications: ProvenImplication[]
}
```

---

## 4. Основные функции

### addProvenFact()

```typescript
function addProvenFact(state: ProverState, fact: ASTNode): void
```

Добавляет доказанный факт в состояние прувера:

1. **Нормализация** — применение правил десахаризации
2. **Проверка дублирования** — избежание повторов
3. **Регистрация** — добавление в `facts` и `provenFacts`
4. **Автоматическая регистрация импликаций** — если факт имеет форму `P → Q`

### addProvenImplication()

```typescript
function addProvenImplication(
  state: ProverState,
  antecedent: ASTNode,
  consequent: ASTNode,
  source: string
): void
```

Регистрирует импликацию для последующего применения MP:

1. **Нормализация** обоих узлов
2. **Проверка дублирования**
3. **Добавление** в `provenImplications`

### tryModusPonens()

```typescript
function tryModusPonens(
  goal: ASTNode,
  state: ProverState
): {
  found: boolean
  antecedent?: ASTNode
  implication?: ProvenImplication
  chain?: { fact: ASTNode; implication: ProvenImplication }[]
}
```

Пытается доказать цель через применение MP:

1. **Проверка** — цель уже доказана?
2. **Поиск импликации** — найти `(P → goal)` где P доказано
3. **Унификация** — попытка с подстановкой переменных
4. **Рекурсивные цепочки** — `P → Q → R` через `tryModusPonensChain`

### applyModusPonens()

```typescript
function applyModusPonens(state: ProverState): ASTNode[]
```

Автоматически применяет MP ко всем известным фактам и импликациям:

1. **Итерация** по всем импликациям
2. **Проверка** — антецедент доказан?
3. **Вывод** — добавление консеквента как нового факта
4. **Повторение** — пока выводятся новые факты

---

## 5. Алгоритм tryModusPonens

```
tryModusPonens(goal, state):
  1. Если goal в state.facts → вернуть { found: true }

  2. Для каждой impl в state.provenImplications:
     a. Если impl.consequent === goal:
        - Если impl.antecedent в state.facts:
          → вернуть { found: true, antecedent, implication }
        - Иначе: рекурсивно tryModusPonensChain(impl.antecedent)

     b. Попробовать унификацию:
        - subst = unify(impl.consequent, goal)
        - Если subst существует:
          - substAnt = applySubstitution(impl.antecedent, subst)
          - Если substAnt в state.facts:
            → вернуть { found: true, antecedent: substAnt }

  3. Вернуть { found: false }
```

---

## 6. Цепочки выводов

### Пример

```
Дано:
  1. ♂∞ (факт)
  2. ♂∞ → ∞♀ (импликация)
  3. ∞♀ → x (импликация)

Вывод:
  MP(1, 2): ∞♀
  MP(∞♀, 3): x
```

### Реализация tryModusPonensChain

```typescript
function tryModusPonensChain(
  goal: ASTNode,
  state: ProverState,
  maxDepth: number
): { found: boolean; chain?: ... }
```

**Алгоритм:**
1. Базовый случай: goal в `facts` → вернуть пустую цепочку
2. Для каждой импликации с консеквентом = goal:
   - Рекурсивно доказать антецедент (с уменьшением глубины)
   - Если успешно — добавить в цепочку

**Ограничение глубины:** `maxDepth = 5` предотвращает бесконечные циклы.

---

## 7. Автоматическое применение

### Алгоритм applyModusPonens

```
applyModusPonens(state):
  derivedFacts = []
  changed = true

  while changed:
    changed = false
    for impl in state.provenImplications:
      if antecedent в facts AND consequent НЕ в facts:
        добавить consequent в facts
        derivedFacts.push(consequent)
        changed = true

        if consequent это LinkExpr:
          addProvenImplication(consequent.left, consequent.right)

  return derivedFacts
```

**Особенность:** Выведенные импликации также регистрируются для последующего применения MP.

---

## 8. Интеграция с verify()

В функции `verify()` для `LinkExpr`:

```typescript
if (isLinkExpr(normalized)) {
  // 1. Регистрация импликации
  addProvenImplication(state, normalized.left, normalized.right, 'input')
  addProvenFact(state, normalized)

  // 2. Автоматическое применение MP
  const derivedFacts = applyModusPonens(state)

  // 3. Попытка доказать консеквент через MP
  const mpResult = tryModusPonens(normalized.right, state)

  // 4. Формирование результата
  return {
    success: true,
    message: `Импликация зарегистрирована`,
    proofSteps: [...],
    appliedAxioms: mpResult.found ? [AXIOMS.MP] : []
  }
}
```

---

## 9. Примеры

### Пример 1: Простое применение MP

```typescript
const state = createProverState()

// Добавляем факт P
addProvenFact(state, parseExpr('♂∞'))

// Добавляем импликацию P → Q
addProvenImplication(state, parseExpr('♂∞'), parseExpr('∞♀'), 'axiom')

// Пытаемся доказать Q
const result = tryModusPonens(parseExpr('∞♀'), state)
// result.found === true
// result.antecedent === ♂∞
```

### Пример 2: Цепочка выводов

```typescript
const state = createProverState()

// P
addProvenFact(state, parseExpr('♂∞'))

// P → Q
addProvenImplication(state, parseExpr('♂∞'), parseExpr('1'), 'def')

// Q → R
addProvenImplication(state, parseExpr('1'), parseExpr('∞♀'), 'derived')

// Доказать R через цепочку P → Q → R
const result = tryModusPonens(parseExpr('∞♀'), state)
// result.found === true
// result.chain содержит промежуточные шаги
```

### Пример 3: Автоматический вывод

```typescript
const state = createProverState()

// Добавляем факты и импликации
addProvenFact(state, parseExpr('♂∞'))
addProvenImplication(state, parseExpr('♂∞'), parseExpr('1'), 'A8')
addProvenImplication(state, parseExpr('1'), parseExpr('∞♀'), 'derived')

// Автоматически выводим все возможные факты
const derived = applyModusPonens(state)
// derived содержит: [1, ∞♀]
```

---

## 10. Трассировка и отладка

### ProofStep для MP

```typescript
{
  index: 2,
  action: 'Применение Modus Ponens',
  details: 'Из ♂∞ и (♂∞ → ∞♀) выводится ∞♀',
  axiom: AXIOMS.MP
}
```

### Трассировка в state.trace

```typescript
state.trace.push(`MP: ${antecedentStr} + (${antecedentStr} → ${consequentStr}) ⊢ ${consequentStr}`)
```

---

## 11. Реализация в коде

### Таблица функций

| Функция | Файл | Строка |
|---------|------|--------|
| `addProvenFact()` | `prover.ts` | 998 |
| `addProvenImplication()` | `prover.ts` | 1019 |
| `tryModusPonens()` | `prover.ts` | 1052 |
| `tryModusPonensChain()` | `prover.ts` | 1119 |
| `applyModusPonens()` | `prover.ts` | 1161 |

### Описание аксиомы MP

```typescript
MP: {
  id: 'MP',
  name: 'Modus Ponens',
  formula: 'P, (P → Q) ⊢ Q',
  description: 'Правило вывода: из P и (P → Q) следует Q'
}
```

---

## 12. Ограничения

1. **Глубина цепочек:** Максимум 5 уровней рекурсии
2. **Только прямое применение:** Нет обратного вывода (abduction)
3. **Нет контрапозиции:** `¬Q, (P → Q) ⊢ ¬P` не реализовано
4. **Нет вероятностного вывода:** Только детерминированное применение

---

## 13. Связь с системой аксиом

| Аксиома | Связь с MP |
|---------|-----------|
| А0 (Определение) | Определения создают импликации `s : F` → `(s = F)` |
| А3 (Связь) | Связи `a → b` могут регистрироваться как импликации |
| А5, А6 | Самозамыкания создают структурные импликации |
| А8, А9 | Единица/нуль смысла — базовые импликации |

---

## См. также

- [Архитектура прувера](01-architecture.md) — общая структура
- [Алгоритм резолюции](02-resolution.md) — детали резолюции
- [Интерактивный режим](04-interactive.md) — пошаговое применение MP
- [Аксиома А3: Связь](../02-axioms/06-link.md) — базовый конструктор импликаций

---

*Реализовано в рамках Фазы 4 разработки aprover.*
