# Алгоритм резолюции

> **Статус:** Шаблон для будущего контента
> **Источник:** `10-resolution-algorithm.md`
> **Этап:** 5.6

## Краткое описание

Алгоритм резолюции — резолюция запросов по форме в асети связей.

## Планируемое содержание

1. Структурная унификация
2. Применение аксиом
3. Проверка равенств
4. Трассировка доказательства

## Реализация

```typescript
// src/core/prover.ts
export function verify(node: ASTNode, state: ProverState): VerifyResult
export function checkEquality(a: ASTNode, b: ASTNode, state: ProverState): boolean
```

## См. также

- [Архитектура прувера](01-architecture.md)
- [Modus Ponens](03-modus-ponens.md)
- [Система аксиом](../02-axioms/01-overview.md)

---

*Контент будет добавлен на этапе 5.6.*
