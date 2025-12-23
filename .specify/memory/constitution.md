<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.1 → 1.1.2
Modified principles:
  - II. Reader Simplicity: Removed "category" from navigation list (spec clarified single-tag taxonomy)
Added sections: None
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ Compatible
  - .specify/templates/spec-template.md: ✅ Compatible
  - .specify/templates/tasks-template.md: ✅ Compatible
Follow-up TODOs: None
-->

# Markdown Blog Constitution

## Core Principles

### I. Author Simplicity

The blog MUST remove all friction from the publishing workflow. Authors write markdown files with front matter and place them in the articles folder. Publication is automatic and immediate.

**Non-negotiable rules:**
- No manual build steps required to publish
- No configuration files to edit per article
- No CLI commands to run after writing
- No deployment step required for content changes
- Front matter is the ONLY metadata mechanism
- New articles visible immediately (or within seconds) after file creation
- Invalid files are skipped with warnings, never blocking valid content
- Drafts (marked `draft: true` in front matter) are excluded automatically

**Rationale**: The value of a blog is in the content, not the publishing process. Every obstacle between "idea" and "published" reduces the likelihood of writing.

### II. Reader Simplicity

Readers MUST experience a lightweight, distraction-free interface focused entirely on content consumption and discovery. The visual design MUST be easily changeable without touching content or structure.

**Non-negotiable rules:**
- Pages load fast with minimal JavaScript
- Navigation by date and tag is intuitive and consistent
- No registration, popups, or interruptions required to read content
- Mobile and desktop experiences are equally functional
- Cross-links between articles work seamlessly

**Themability requirements:**
- HTML MUST be minimal and semantic—structure only, no presentation logic
- All visual styling MUST be in CSS—no inline styles, no style attributes in markup
- Swapping the stylesheet MUST completely change the site's look
- No CSS framework classes that couple markup to specific visual styles

**Rationale**: Readers come for content. Complexity in the reading experience drives them away. Semantic HTML with pure CSS styling enables rapid visual experimentation without touching code.

### III. Test Confidence

The test suite MUST provide near-100% confidence that when tests pass, the blog functions correctly in production. Manual verification after code changes is unacceptable.

**Non-negotiable rules:**
- Unit tests cover all business logic and utilities exhaustively
- Integration tests verify component interactions and data flow
- E2E tests validate critical user journeys (publish, navigate, read)
- Tests MUST be written before implementation (TDD)
- A passing test suite means the feature works—no manual QA required

**Test pyramid discipline:**
- Unit tests: Many (fast, isolated, comprehensive coverage)
- Integration tests: Some (verify boundaries and contracts)
- E2E tests: Few (critical paths only, expensive to maintain)

**Rationale**: Confidence enables velocity. Without test confidence, every change requires manual verification, which slows development and introduces regression risk.

### IV. Minimal Complexity

The codebase MUST remain simple and avoid over-engineering. Every abstraction, dependency, and architectural decision requires justification.

**Non-negotiable rules:**
- YAGNI: Do not build features "for later"
- Prefer standard library over third-party dependencies
- No premature abstraction—three similar lines are better than one unnecessary helper
- Configuration MUST have sensible defaults; customization is optional, not required
- Complexity MUST be justified in code comments or design documents

**Rationale**: Complexity compounds. Today's clever abstraction becomes tomorrow's maintenance burden.

### V. Incremental Development

Development MUST proceed through small, deliverable increments. Each change delivers working value. No big-bang releases or multi-month plans.

**Non-negotiable rules:**
- Every increment MUST be deployable and functional on its own
- "Good enough now" beats "perfect later"—ship and iterate
- No grand architectural rewrites; evolve the system incrementally
- Features are broken into independently deliverable slices
- Each PR should represent a complete, working improvement
- Avoid planning horizons longer than a few focused tasks

**Rationale**: Small increments reduce risk, provide faster feedback, and ensure continuous delivery of value. Big-bang development delays value and increases the chance of building the wrong thing.

## Development Philosophy

The development approach follows from the core principles:

- **Start with tests**: Define expected behavior before writing implementation
- **Small increments**: Ship independently testable user stories
- **Simplicity bias**: When choosing between approaches, prefer the simpler one
- **Content-first**: Every decision should be evaluated by its impact on authors and readers

## Quality Standards

- All PRs MUST pass the full test suite
- Code review MUST verify alignment with constitution principles
- Performance budgets: Pages MUST load in under 2 seconds on average connections
- Accessibility: WCAG 2.1 AA compliance for all reader-facing pages
- Documentation: Features are documented in code; external docs only when necessary

## Governance

This constitution is the authoritative guide for all development decisions on this project. When in doubt, refer to these principles.

**Amendment process:**
1. Propose changes with rationale in a PR
2. Changes require explicit justification for why existing principles are insufficient
3. Version increment follows semantic versioning (see below)
4. All affected code and documentation MUST be updated in the same PR

**Versioning policy:**
- MAJOR: Principle removed or fundamentally redefined
- MINOR: New principle added or existing principle materially expanded
- PATCH: Clarifications, wording improvements, non-semantic changes

**Compliance review:**
- Constitution Check is a gate in the planning phase
- PRs that violate principles MUST document the violation and justification in Complexity Tracking

**Version**: 1.1.2 | **Ratified**: 2025-12-23 | **Last Amended**: 2025-12-23
