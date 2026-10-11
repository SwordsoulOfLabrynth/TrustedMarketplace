# Team and Git Workflow

## 1. Working agreement

-   One approved architecture and one API contract.
-   One developer owns each task; another person reviews high-risk
    changes.
-   AI-generated code is a draft, not automatically trusted code.
-   Every task has acceptance criteria and tests.
-   Keep pull requests small and focused.
-   Integrate frequently to prevent end-stage merge conflicts.

## 2. Branching

Suggested: - `main`: protected, reviewed, always intended to build. -
`feature/T-10-identity-setup` - `feature/T-11-registration` - `fix/...`

Use pull requests to merge. Avoid multiple developers directly editing
the same files without coordination.

## 3. Pull request checklist

-   [ ] Linked task ID and requirements.
-   [ ] Scope is limited to the task.
-   [ ] Build succeeds.
-   [ ] Relevant tests pass.
-   [ ] Negative authorization tests included where relevant.
-   [ ] API contract and docs updated if needed.
-   [ ] No secrets, tokens, private documents, or local credentials
    committed.
-   [ ] Database migrations reviewed.
-   [ ] Breaking changes communicated.
-   [ ] Reviewer approval recorded.

## 4. Definition of done

A task is done only when: 1. The behavior matches acceptance criteria.
2. Tests cover success and relevant failure/unauthorized cases. 3. The
build and relevant tests pass. 4. Documentation and configuration
instructions are updated. 5. The code is reviewed and merged. 6. Known
limitations are recorded.

## 5. Suggested ownership for a small team

-   **Product/technical lead:** scope, PRD, architecture, integration,
    product decisions.
-   **Backend owner:** API, domain logic, persistence, identity
    integration.
-   **Frontend owner:** buyer/seller/admin user flows and responsive UI.
-   **Quality/search/operations owner (if available):** tests, pilot
    data, search evaluation, demo readiness.

With only two developers, combine roles but keep code review and testing
responsibilities explicit.

## 6. Demo discipline

-   Maintain a stable demo environment.
-   Prepare non-sensitive seed data.
-   Rehearse the full critical user journey.
-   Have a fallback recording or screenshots in case the network fails.
-   Do not demonstrate fake metrics as real outcomes.
-   Clearly distinguish implemented features from roadmap items.
