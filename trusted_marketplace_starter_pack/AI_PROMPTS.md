# AI Coding Prompts --- Trusted Marketplace

Use these prompts one at a time. Attach or provide the relevant PRD/spec
files to the coding agent. Review every diff and run tests yourself.

## Prompt 1 --- Architecture review (no code yet)

Read `MASTER_PRD.md` and the proposed architecture/specifications.

Do not write code yet.

1.  Identify ambiguities, conflicts, and missing decisions.
2.  Propose a minimal modular-monolith architecture for C# and ASP.NET
    Core.
3.  Review the proposed database entities and relationships.
4.  Review the Buyer/Seller/Admin permission model.
5.  Confirm the chosen authentication approach fits the actual
    frontend/client topology.
6.  Identify security/privacy risks.
7.  Break the first release into small tasks with dependencies and
    acceptance criteria.
8.  Mark assumptions that require team approval.

Do not implement escrow, payment custody, unauthorised scraping, or an
opaque trust score. Do not generate the whole application.

Return recommendations and unresolved decisions only.

## Prompt 2 --- Repository foundation

Implement only the approved foundation tasks.

Requirements: - Follow the approved architecture and versions. - Add a
buildable solution, configuration pattern, database connection
configuration, logging, safe global error handling, health checks, and
test projects as specified. - Do not implement marketplace features
yet. - Do not hard-code secrets. - Add setup instructions and exact
build/test commands. - Add tests for any behavior introduced. - Keep
changes limited to the agreed task. - At the end, list changed files,
commands run, test results, and known limitations.

Do not claim tests passed unless they were actually run.

## Prompt 3 --- Authentication & Authorization

Read `AA_SPEC.md`, `API_CONTRACT.md`, `DATABASE_DESIGN.md`, and the
approved architecture.

Implement only the assigned A&A tasks.

Requirements: - Use the approved, maintained identity framework; do not
implement custom password hashing. - Follow the agreed cookie or token
design; do not invent a new authentication scheme. - Implement
registration, login, logout/session lifecycle, current-user endpoint,
and the agreed recovery functionality. - Enforce server-side
authorization policies and account status. - Never allow public
registration to assign Admin. - Keep role, account status, seller
verification, and subscription status separate. - Return safe,
consistent errors. - Do not expose secrets, password data, or private
verification evidence. - Add automated tests for valid flows and
negative cases, including privilege escalation and unauthorized
access. - Do not change unrelated modules or silently alter API
contracts. - Document configuration, environment variables, endpoints,
tests, and limitations.

Before coding, report any blocking ambiguity that would materially
change the implementation. If none exists, proceed with only the
approved scope.

## Prompt 4 --- Implement a feature module

Implement only **\[MODULE / TASK ID\]** from the approved task plan.

Before coding: 1. Summarise the requirements and dependencies. 2.
Identify the files likely to change. 3. Identify authorization, privacy,
and data-integrity risks. 4. Flag contract conflicts instead of
inventing a new contract.

Implementation requirements: - Follow the existing architecture and API
conventions. - Validate all input server-side. - Enforce ownership and
permissions server-side. - Add automated tests, including
failure/unauthorised cases. - Use migrations for schema changes. - Avoid
unnecessary dependencies and unrelated refactoring. - Update
documentation. - Run relevant tests and report the actual results. -
List changed files, assumptions, and remaining work.

## Prompt 5 --- Code review and security review

Review the current diff against the relevant requirements.

Do not rewrite the entire module.

Check: - Authentication and authorization correctness. - Resource
ownership and privilege escalation. - Input validation and error
handling. - Sensitive data and secret exposure. - Database integrity and
migration safety. - Concurrency and state transitions. - Logging and
privacy. - Test coverage and missing negative tests. - Unintended API
contract changes.

Return findings ordered by severity, with file/line references where
available. For each finding, explain impact and propose a minimal fix.
Do not claim a vulnerability is fixed until the code and tests confirm
it.

## Prompt 6 --- Integration readiness

Check whether this branch can safely merge into the shared project.

1.  Build the solution.
2.  Run relevant unit and integration tests.
3.  Verify the documented API contract.
4.  Check migration compatibility and configuration.
5.  Confirm no secrets or local-only paths were committed.
6.  Identify breaking changes for other modules.
7.  Update README/API documentation as needed.

Report exact commands and real results. Do not mark the task complete if
build or tests fail. Do not hide failures.
