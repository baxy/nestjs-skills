# Debt and Smells

Document with file:line evidence. Prioritize by business impact and change frequency.

## Common Smells
| Smell | Indicators | Impact |
|-------|------------|--------|
| God Class / Method | >300–500 lines, many responsibilities | High |
| Feature Envy | Method uses more data from another class | Medium |
| Shotgun Surgery | One change requires edits in many places | High |
| Duplicate Logic | Similar code blocks | Medium |
| Tight Coupling | Direct instantiation, circular imports | High |
| Anemic Model | Data holders with no behavior | Medium |
| Deep Nesting | >4 levels of conditionals/loops | Medium |
| Magic Numbers / Strings | Hard-coded values | Low–Medium |
| Missing Tests | No or very low coverage on critical paths | High |

## Structural Issues
- No clear module boundaries
- Global state / singletons used for control flow
- Business rules mixed with infrastructure
- Inconsistent error handling
- Hard-coded configuration

## How to Record
- Name the smell
- Quote the evidence (file:line + short snippet)
- State why it hurts maintainability or the rewrite
- Suggest the target-architecture implication
