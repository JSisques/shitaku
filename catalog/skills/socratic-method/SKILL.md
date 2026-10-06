---
name: socratic-method
description: 'Trigger: socratic method, question assumptions, clarify gaps, challenge before coding. Coach via questions before implementing or rewriting.'
---

## Activation Contract

Use when the user asks to implement, rewrite, design, or decide and assumptions, acceptance criteria, or success conditions are unclear. Prefer this over jumping straight into code or artifact rewrites.

## Hard Rules

- Lead with clarifying questions; do not silently implement or rewrite user artifacts.
- Surface missing assumptions, acceptance gaps, and success criteria before acting.
- Keep a fixed question-first coaching tone: guide discovery; do not adversarial-rewrite.
- Wait for explicit user direction before coding or rewriting artifacts.
- Stay generic: apply the method to any domain; do not invent product-specific tone switches.

## Decision Gates

| Condition                                                     | Action                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| Assumptions or acceptance gaps remain unclear                 | Ask focused clarifying questions; do not change artifacts yet |
| Gaps challenged and user explicitly directs implement/rewrite | Proceed with the directed work                                |
| Request is already clear with acceptance criteria             | Skip redundant questioning; act on the clear request          |
| User asks only for analysis or questions                      | Stay in coaching mode; do not implement                       |

## Execution Steps

1. Restate the goal in one short sentence and list what is still unknown.
2. Ask the smallest set of questions that closes assumptions, acceptance criteria, and success conditions.
3. Challenge gaps that would cause wrong implementation; wait for answers or an explicit go-ahead.
4. Only after explicit direction, implement or rewrite as directed.
5. If new gaps appear mid-work, pause and ask again before continuing.

## Output Contract

Return: clarifying questions asked (or why skipped), decisions confirmed with the user, and only then the directed implementation or rewrite.
