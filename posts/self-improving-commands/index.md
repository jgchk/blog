---
title: The Self-Improving Command Pattern
date: 2025-12-23
tags:
  - AI Agents
  - Prompt Engineering
  - Patterns
  - Automation
draft: false
---

Teaching AI agents to learn from their mistakes.

## The Problem

When you write a prompt or command for an AI agent, you're essentially encoding your knowledge about how to do a task well. But here's the challenge: **you don't know what you don't know**.

You write detailed instructions. The agent follows them. The output is... fine. But something's off. Maybe it over-compressed a critical section. Maybe it lost nuance that seemed obvious to you but wasn't explicit in your instructions. You fix the output manually, move on, and the next time you run the command? Same mistake.

The knowledge of what went wrong lives in your head, not in the command.

## A Three-Agent Feedback Loop

The pattern I've been experimenting with closes this gap by structuring a command as three distinct agents with adversarial roles:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────────┐                                              │
│   │  COMMAND.md  │ ◄────────────────────────────────────┐       │
│   └──────┬───────┘                                      │       │
│          │                                              │       │
│          │ spawns                                       │       │
│          ▼                                              │       │
│   ┌──────────────────┐                                  │       │
│   │ 1. Worker Agent  │                                  │       │
│   │   (does task)    │                                  │       │
│   └──────┬───────────┘                                  │       │
│          │                                              │       │
│          │ produces                                     │       │
│          ▼                                              │       │
│   ┌──────────────────┐                                  │       │
│   │    output.md     │                                  │       │
│   └──────┬───────────┘                                  │       │
│          │                                              │       │
│          │ reviewed by                                  │       │
│          ▼                                              │       │
│   ┌──────────────────┐                                  │       │
│   │ 2. Review Agent  │                                  │       │
│   │   (critiques)    │                                  │       │
│   └──────┬───────────┘                                  │       │
│          │                                              │       │
│          │ produces                                     │       │
│          ▼                                              │       │
│   ┌──────────────────┐                                  │       │
│   │   feedback.md    │                                  │       │
│   └──────┬───────────┘                                  │       │
│          │                                         updates      │
│          │ consumed by                                  │       │
│          ▼                                              │       │
│   ┌─────────────────────┐                               │       │
│   │ 3. Integration Agent│ ──────────────────────────────┘       │
│   │   (improves cmd)    │                                       │
│   └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Agent 1: The Worker

The first agent does the actual work. In my case, it's compressing a design document from ~40,000 tokens down to under 25,000. It follows detailed instructions about what to preserve, what to condense, and common mistakes to avoid.

### Agent 2: The Reviewer

A **separate** agent reads both the original and the output, then critically evaluates the work. The key word is "separate"—this creates an adversarial relationship. The reviewer's job is to find problems, not to justify decisions.

The review agent:

- Compares input and output systematically
- Checks against a predefined quality rubric
- Identifies specific failures with concrete examples
- Writes structured feedback to a file

### Agent 3: The Integrator

Here's where it gets interesting. The third agent reads the review feedback and **updates the original command file**. It looks for patterns in what went wrong and adds guidance to prevent the same mistakes next time.

This is the key insight: **the command improves itself**.

## Why Three Separate Agents?

You might wonder: why not have one agent do the work, review itself, and update the instructions?

Self-review doesn't work well. When an agent reviews its own output, it's biased toward justifying its decisions rather than critiquing them. The same "blind spots" that caused the original mistakes persist during self-review.

By spawning a fresh agent with the explicit role of "critic," you get genuinely adversarial evaluation. The review agent has no investment in the output being good—its only job is finding problems.

## The Accumulating Intelligence

Each run of the command potentially adds to its instructions. After several iterations, my compression command has accumulated guidance like:

> **Anti-pattern examples (CRITICAL - often lost in condensation):**
>
> - Before/after code comparisons showing what NOT to do
> - These teach developers to recognize and avoid common mistakes
> - Keep the BAD code example alongside the GOOD fix

> **Novel architectural patterns not used elsewhere in codebase (CRITICAL):**
>
> - If a pattern is new to this codebase, keep FULL explanation
> - Don't assume familiarity—explain WHY both parts are needed

These weren't in the original command. They emerged from review cycles where the compression agent made these exact mistakes, the review agent caught them, and the integration agent codified the lesson.

## Integration Agent Rules

The integration agent needs constraints to avoid degrading the command over time:

1. **Be specific, not vague** — Don't add "be careful with important content." Add "preserve rollback code with flag-based cleanup patterns."

2. **Check for duplicates** — If guidance already exists, strengthen it rather than adding redundant text.

3. **Know when to skip** — If feedback is too specific to one document (not a generalizable pattern), don't add it.

4. **Preserve structure** — Add to existing sections; don't reorganize the command.

5. **Never remove** — Only add or strengthen guidance. Removal risks losing hard-won lessons.

## When This Pattern Shines

This pattern is valuable when:

- **The task has learnable failure modes** — There are recurring mistakes that better instructions can prevent
- **Quality is measurable** — The review agent needs clear criteria to evaluate against
- **The command will be run repeatedly** — Investment in improvement pays off over multiple runs
- **Mistakes are costly** — Manual correction is expensive enough to justify the overhead

## Limitations

The pattern adds overhead: three agent invocations instead of one. For simple, one-off tasks, it's overkill.

There's also a risk of instruction bloat. Over many iterations, the command could accumulate so much guidance that it becomes unwieldy. Periodic human review of the accumulated instructions helps.

## The Broader Principle

What I find compelling about this pattern isn't the specific implementation—it's the principle: **close the feedback loop**.

Traditional prompts are open-loop systems. You write instructions, the agent executes, and knowledge about what went wrong stays in your head (or is lost entirely). By adding review and integration phases, you create a closed-loop system where experience accumulates in the command itself.

The command becomes a living document that encodes not just your initial understanding, but every lesson learned from running it.

---

_This pattern emerged from practical frustration with a document compression task where the same types of content kept getting over-compressed. After the third time manually restoring rollback code that the agent had summarized away, I decided to make the agent remember that lesson itself._
