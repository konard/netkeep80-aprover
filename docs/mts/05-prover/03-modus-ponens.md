# Modus Ponens

> **Статус:** Шаблон для будущего контента
> **Этап:** 5.6

## Краткое описание

Modus Ponens (MP) — фундаментальное правило вывода: если доказано P и (P → Q), то доказано Q.

## Формула

```
P, (P → Q) ⊢ Q
```

## Возможности

- **Автоматическое применение MP**: прувер автоматически применяет правило MP к известным фактам
- **Цепочки выводов**: поддержка цепочек P, P → Q, Q → R ⊢ R
- **Отслеживание импликаций**: все Link-выражения (a → b) регистрируются как импликации
- **Трассировка вывода**: отслеживание пути доказательства через MP

## Реализация

```typescript
// src/core/prover.ts
export function tryModusPonens(goal: ASTNode, state: ProverState): VerifyResult
export function addProvenFact(state: ProverState, fact: ASTNode): void
export function addProvenImplication(state: ProverState, P: ASTNode, Q: ASTNode): void
```

## См. также

- [Архитектура прувера](01-architecture.md)
- [Алгоритм резолюции](02-resolution.md)
- [Интерактивный режим](04-interactive.md)

---

*Контент будет добавлен на этапе 5.6.*
