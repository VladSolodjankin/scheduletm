# Agent workflow

This folder contains team instructions for `server/` (Node/Express/PostgreSQL), `web/` (React/MUI), and `bot/` (Telegram). Shared constraints and verification commands are defined in the root `AGENTS.md`.

## Mandatory review before development

1. The coordinator establishes the task scope and gives the analyst concrete inputs and paths.
2. The [Analyst](analyst.md) verifies current behavior and prepares a task description for the user. When needed, the architect helps clarify the contract before review.
3. The coordinator presents the complete description, open questions, and discrepancies between documentation and code, then waits for explicit approval of that version.
4. Only after approval does the coordinator hand the task to developers. The analyst must not initiate development.

This workflow is mandatory for new features and substantial fixes. A small task may have a short description, but its size does not remove user review when an analysis stage is performed. Simple text edits, configuration of these instructions, and explanations do not require a separate analysis cycle.

The initial request to implement a feature, silence, another agent's approval, acceptance of the general team workflow, or a request to revise the description does not count as approval of the prepared task. The user must explicitly authorize development based on the presented description. Existing approval of the same version and scope remains valid; do not ask for it again.

Before approval, investigation, requirements clarification, and preparation of documentation for review are allowed. Changes to implementation, migrations, or tests for the new functionality are prohibited, as is delegating implementation in parallel with analysis. Existing safe checks may be run to establish facts.

If behavior, API, permissions, data, scope, or acceptance criteria change after approval, first show the user the revised description and obtain approval of the affected part. Local technical decisions within the agreed contract do not require another review.

## Selecting roles

The main agent in the current conversation acts as coordinator. A separate `orchestrator` is needed only when coordination is explicitly delegated.

| Role | When needed | Instructions |
| --- | --- | --- |
| `analyst` | Preparing a feature or substantial fix for user review | [Analyst](analyst.md) |
| `backend-developer` | API, database, Telegram bot | [Backend](backend-developer.md) |
| `frontend-developer` | React and implementation of an existing Figma design | [Frontend and Figma](frontend-developer.md) |
| `reviewer` | Substantial changes and changes with regression risk | [Reviewer](reviewer.md) |
| `architect`, `tester`, `devops`, `tech-lead` | Only when there is a concrete need | [Supporting roles](supporting-roles.md) |

After approval, an ordinary task is handled by the relevant developer with their own targeted checks. Reviewer handles substantial changes; separate Architect and Tester stages are not mandatory for every medium-sized task.

Frontend and backend work may run in parallel once the approved API contract is fixed, provided that file ownership does not overlap and neither task depends on unfinished implementation. For concurrent `server/` and `bot/` work, use two backend-agent instances with separate file ownership. Only one agent may edit a given file at a time.

## Task handoff and completion

Each agent assignment must include the goal, relevant paths, verified facts, approved contract, evidence of user approval, owned files, protected user changes, dependencies, and acceptance criteria. Pass along previous agents' findings to avoid repeating broad discovery.

The agent returns changed files, implemented behavior, verification commands and results, unverified conditions, and blockers. Route corrections to the file owner; allow at most two correction and revalidation cycles.

The coordinator checks the result against the approved description and reports the outcome to the user. Passing typecheck or source-contract tests does not replace functional and visual verification of the affected UI.

Keep permanent team instructions here. Present descriptions of individual tasks in the conversation and link them to existing product documentation. Create separate task or report files only when explicitly requested by the user.
