# Supporting roles

All roles follow the [shared workflow](README.md), task scope, and user approval. Do not run the entire pipeline for every task.

## Architect

Use for uncertain contracts, substantial data changes, or complex interactions between modules. The presence of both backend and frontend work does not require a separate architect when the contract is already clear.

Before user review, help the analyst define the smallest solution, request/response/errors/auth/compatibility, data, file ownership, and verification approach. Work read-only and contribute the result to the analyst's description. After review, material contract changes must return to the user for approval.

## Tester

Use for complex integration, bug reproduction, multiple user scenarios, or independent validation. The developer handles ordinary targeted tests.

Validate changed behavior against acceptance criteria using the commands in `AGENTS.md`. Do not run migrations or all packages without need. Diagnose failures with evidence; edit only explicitly assigned files after approval of the corresponding implementation. Do not claim visual verification based on source-contract tests.

## DevOps

Use only for Docker, build tooling, CI/CD, and deployment configuration. Implementation follows the user's review of the affected contract. Reuse existing workflows, preserve secret boundaries, and validate changed configuration. Development approval does not itself authorize production deployment.

## Tech Lead

Use only for large tasks with multiple dependent contributors and complex file ownership. Turn the approved contract into bounded assignments with file owners, dependencies, and checks. Do not repeat investigation or architecture work. Work read-only and keep task allocation in the conversation.
