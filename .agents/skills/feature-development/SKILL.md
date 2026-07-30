---
name: feature-development
description: Coordinate scoped feature development and substantial bug fixes in the scheduletm monorepo using specialized Codex subagents. Apply automatically when implementing a new backend, frontend, bot, full-stack, or infrastructure feature, or a non-trivial fix requiring architecture, tests, or review. Do not apply to explanation-only requests, tiny documentation edits, or simple read-only diagnosis unless the user asks for the team workflow.
---

# Feature development

Act as Orchestrator. Follow root `AGENTS.md`, preserve user changes, and never commit or push.

## Establish scope once

1. Start with one targeted search from the user's trigger. Inspect only relevant `PROJECT_MAP.md`, package scripts, neighboring implementation/tests, and current git status.
2. Identify affected packages, contract boundaries, protected paths, and existing user changes.
3. Share exact paths, discovered conventions, contract facts, and verification commands in delegated prompts. Instruct subagents not to repeat broad discovery.
4. Select only necessary roles. Keep findings in the session; create no process files.

## Select the pipeline

- Small backend: Backend Developer -> Reviewer.
- Small frontend: Frontend Developer -> Reviewer.
- Medium backend: Architect -> Backend Developer -> Tester -> Reviewer.
- Medium frontend: Architect -> Frontend Developer -> Tester -> Reviewer.
- Full-stack: Architect -> Backend Developer -> Frontend Developer -> Tester -> Reviewer.
- Large: Analyst -> Architect -> Tech Lead -> required Developers -> Tester -> Reviewer.
- Add DevOps only for Docker, build, CI/CD, or deployment configuration.
- Treat bot/API/database work as backend unless scope warrants a separate backend task.

Use `analyst`, `architect`, `tech-lead`, `backend-developer`, `frontend-developer`, `tester`, `reviewer`, and `devops` custom agents. The root agent is Orchestrator; use `orchestrator` only when explicitly delegating orchestration.

## Coordinate implementation

- Architect must define request/response/error/auth/compatibility behavior before full-stack implementation.
- Backend Developer owns backend, PHP only if present in explicit scope, SQL, API, bot, and backend tests. Frontend Developer owns React, TypeScript UI, state, API consumption, and frontend tests.
- Run backend and frontend in parallel only after the API contract is fixed, file sets are disjoint, and neither depends on unfinished work. Otherwise run sequentially; default full-stack order is backend then frontend.
- Assign each file to one editing agent at a time. Give later agents the prior summary and changed-file list.
- Use Tech Lead only for large work. Tester runs targeted checks. Reviewer reads the diff and directly connected files only.
- Route findings to the owning developer. Run at most two correction cycles, retesting and rereviewing only affected areas.

## Finish

Confirm requested behavior, relevant checks, and review. Report changed files, validation results, remaining risks, and blocked checks. Do not start unrelated improvements.
