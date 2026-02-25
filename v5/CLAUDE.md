# v5.0 AI-Influencer

## Project Structure

- **Implementation root**: this directory (`v5/`)
- **Git repository root**: parent directory (`../`)
- **Spec files**: `../docs/v5-specification/` (01-13)
- **Type definitions**: `types/`
- **Dashboard**: `dashboard/` (Next.js 14, standalone app)
- **MCP Server + Workers + Agents**: `src/`
- **Tests**: `tests/`
- **SQL migrations**: `sql/`

## Current Phase: Review & Refinement

Base implementation of all 276 features is complete (276/276, 244 test suites, 1,124 tests).
Now in the phase of detailed review, verification, and improvement with the project owner.

## Core Rules

- **All config values from DB** (system_settings table) - no hardcoding
- **Code and spec docs are updated together** - when code changes, update the relevant spec doc(s) under `docs/v5-specification/` and vice versa
- **TypeScript strict mode** - `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` enabled
- **ESM with .js extensions** - all imports use `.js` suffix

## Git

- Repository root is `../` (parent directory)
- Work on `develop` branch, merge to `main` via PR
- Commit messages: concise, descriptive, with `Co-Authored-By` tag

## Quality Checks

```bash
npm run test:unit                    # Unit tests
npm run typecheck                    # Type check
npm run lint                         # Lint
npm run quality                      # All three above
```

## Key Architecture

- **4-Layer**: Dashboard (Next.js) → LangGraph (4 graphs) → MCP Server (111 tools, stdio) → PostgreSQL + pgvector
- **LangGraph → MCP**: via `callMcpTool()` in `src/agents/common/mcp-client.ts` (langchain-mcp-adapters, stdio transport)
- **Dashboard auth**: NextAuth.js v4 + Google OAuth, email whitelist + RBAC from `system_settings`
- **Dashboard UI**: Shadcn/ui + Tailwind CSS + Recharts, Solarized theme (Dark/Light)

## Key Spec References

| Topic | File |
|-------|------|
| Architecture | `02-architecture.md` |
| DB Schema (33 tables) | `03-database-schema.md` |
| Agent Design | `04-agent-design.md` |
| Test Specs | `12-test-specifications.md` |
| Directory Layout | `10-implementation-guide.md` |
