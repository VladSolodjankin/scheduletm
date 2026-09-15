---
name: feature-development
description: Coordinate features and substantial fixes in the scheduletm monorepo with targeted subagents and user review before implementation. Excludes explanations, simple read-only diagnosis, tiny edits and agent-instruction configuration.
---

# Feature development

Follow root `AGENTS.md`. The root agent coordinates. Role instructions live in
`.codex/agents/*.toml`.

## Establish scope

Start from the user's trigger, relevant `PROJECT_MAP.md`, package scripts and git status.
Identify affected paths, contracts, existing changes and verification needs once.
Keep findings in the session and pass them forward; do not reload the entire role catalog.

## Analysis and user approval

For features and substantial fixes, delegate scoped investigation to `analyst`.
Present the analyst's complete description, evidence, documentation corrections and
open questions to the user. Wait for explicit approval of that version before starting
implementation or delegating developers. Explain that this gate is the user's project
rule and link to this section.

The initial implementation request, silence, another agent's approval or acceptance of
the general workflow is not approval of the prepared description. Incorporate requested
revisions and obtain approval before development. Reuse existing approval for unchanged
scope; routine implementation choices within the contract do not require another gate.
Material changes to behavior, scope, API, authorization, data or acceptance criteria
return for user review of the affected part.

While approval is pending, investigation and preparation of the description may continue;
implementation, migrations and feature-test changes must wait.
Explanations, simple text edits and configuration of these instructions do not require
a separate analysis cycle.

## Select roles and hand off

- `backend-developer`: server/API/database or Telegram; separate instances may own
  independent server and bot work.
- `frontend-developer`: React/MUI and approved Figma implementation.
- `reviewer`: substantial changes or regression risk; unnecessary for tiny reversible edits.
- `devops`: infrastructure scope only.

Each handoff includes goal, exact paths, verified findings, approved description and
approval evidence, owned files, protected changes, dependencies and acceptance checks.
Fix request/response/error/auth/compatibility contracts before parallel implementation.
Run agents concurrently only with disjoint files and no unfinished dependency;
otherwise sequence the work, ordinarily backend before frontend.

## Review and finish

Developers run targeted checks from `AGENTS.md` and return behavior/files changed,
commands/results, unverified conditions and blockers.
Route review corrections to the file owner; allow at most two correction and
revalidation cycles, then report the blocker and request direction.
Reuse completed checks unless new changes, failures or missing evidence justify a rerun.
Check every approved surface. Report code, functional and visual verification separately;
a build or source-contract test does not establish browser or Figma correctness.
Keep notes in the session; do not create task/process files, commit or push unless requested.
