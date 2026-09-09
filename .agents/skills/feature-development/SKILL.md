---
name: feature-development
description: Coordinate scoped feature development and substantial bug fixes in the scheduletm monorepo using specialized Codex subagents. Apply automatically when implementing a new backend, frontend, bot, full-stack, or infrastructure feature, or a non-trivial fix requiring architecture, tests, or review. Do not apply to explanation-only requests, tiny documentation edits, or simple read-only diagnosis unless the user asks for the team workflow.
---

# Feature development

Act as Orchestrator. Follow root `AGENTS.md` and read `agents/README.md` from the repository root. Preserve user changes; do not commit or push unless explicitly requested.

## Establish scope once

1. Start with one targeted search from the user's trigger. Inspect only relevant `PROJECT_MAP.md`, package scripts, neighboring implementation/tests, and current git status.
2. Identify affected packages, contract boundaries, protected paths, and existing user changes.
3. Share exact paths, discovered conventions, contract facts, and verification commands in delegated prompts. Instruct subagents not to repeat broad discovery.
4. Select only necessary roles. Keep findings in the session; create no process files.

## Analysis and user approval

For features and substantial fixes, delegate targeted analysis to `analyst` using `agents/analyst.md`. The analyst returns a complete reviewable task description, evidence, documentation discrepancies and open questions; it must not launch implementation. Add read-only Architect assistance before review only when the contract needs clarification.

Present the complete description to the user and wait for explicit approval of that version before implementation or developer delegation. Explain that this pause comes from the user's review requirement in `agents/README.md` and link it. Neither the initial implementation request, silence, nor another agent's approval satisfies this requirement. Revisions to the description require the user's approval before development. Reuse existing approval for the same version and scope.

Do not implement code, migrations or feature tests while waiting. Read-only investigation and documentation preparation may continue. Return material changes in behavior, scope, API, authorization, data or acceptance criteria for renewed review of the affected part; routine implementation choices within the approved contract do not require another gate.

## Select implementation roles after approval

- Use the relevant Backend or Frontend Developer with its own targeted checks for ordinary tasks.
- Add Reviewer for substantial changes or regression risk; it is not mandatory for every tiny edit.
- Add Architect for unresolved cross-module contracts, not automatically for every medium or full-stack task.
- Add Tester for complex integration or independent scenario validation; avoid duplicating developer checks without reason.
- Add Tech Lead only for large coordination needs and DevOps only for infrastructure scope.
- Treat bot/API/database work as backend. Use separate backend instances with disjoint files when server and bot work can proceed independently.
- Read only the applicable role documents linked from `agents/README.md`; do not load the entire role catalog.

Use `analyst`, `architect`, `tech-lead`, `backend-developer`, `frontend-developer`, `tester`, `reviewer`, and `devops` custom agents. The root agent is Orchestrator; use `orchestrator` only when explicitly delegating orchestration.

## Coordinate implementation

- The user-approved description must define request/response/error/auth/compatibility behavior before full-stack implementation; a separate Architect is conditional.
- Backend Developer follows `agents/backend-developer.md`. Frontend Developer follows `agents/frontend-developer.md`, including Figma context and browser comparison for design implementation.
- Include the approved description and evidence of user approval in each implementation handoff, alongside file ownership, acceptance criteria and verification commands.
- Run backend and frontend in parallel only after the API contract is fixed, file sets are disjoint, and neither depends on unfinished work. Otherwise run sequentially; default full-stack order is backend then frontend.
- Assign each file to one editing agent at a time. Give later agents the prior summary and changed-file list.
- Use Tech Lead only for large work. Tester runs targeted checks. Reviewer reads the diff and directly connected files only.
- Route findings to the owning developer. Run at most two correction cycles, retesting and rereviewing only affected areas.

## Finish

Confirm requested behavior, relevant checks, and review. Report changed files, validation results, remaining risks, and blocked checks. Do not start unrelated improvements.
