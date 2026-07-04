---
name: explain-like-five
description: Explain the user's current question, plan, code change, error, PR, document, or concept in very simple terms as if speaking to a five-year-old. Use when the user asks for "ELI5", "explain like I am five", "like a child could understand", "小孩子也能懂", "五岁小孩", "讲简单点", or asks to translate the current topic into plain child-friendly language.
---

# Explain Like Five

## Overview

Turn the current topic into a short, accurate, child-friendly explanation. Keep the answer simple without becoming vague, cutesy, or misleading.

## Workflow

1. Identify what "this" refers to from the current conversation, files, diff, logs, PR, or user-provided text.
2. Verify the important facts when they are available locally or from the active context.
3. Explain the core idea first in one or two simple sentences.
4. Use one concrete everyday analogy only if it makes the explanation clearer.
5. Add a short "grown-up note" only when a caveat, risk, or technical boundary matters.

## Style Rules

- Match the user's language unless they ask otherwise.
- Use plain words and short sentences.
- Prefer concrete objects: backpack, toolbox, blocks, stickers, traffic lights, kitchen, classroom, shelves.
- Keep technical names only when useful, and define them immediately in simple words.
- Preserve the real meaning. Do not oversimplify into something false.
- Do not talk down to the user. Child-friendly means clear, not baby talk.
- Do not over-explain. Usually answer in 3 to 8 sentences.
- Avoid long bullet lists unless the user asks for detail.

## Technical Topics

For code, PRs, bugs, errors, or system behavior, explain:

- What is changing or happening.
- Why someone wants it.
- What gets better or worse.
- What must still be checked, if relevant.

Use project facts from the current workspace when available. If the current context is not enough to know what "this" means, ask one concise clarification question.

## Example Shape

Simple answer:
`This change makes the page carry fewer things it does not need, so it can open faster.`

Analogy:
`It is like packing a small backpack for school instead of bringing every toy from home.`

Grown-up note:
`The important check is that the page is lighter without breaking cart, search, or product behavior.`
