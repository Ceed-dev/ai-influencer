# v5.0 AI-Influencer Implementation

## Project Structure

- **Implementation root**: this directory (`v5/`)
- **Git repository root**: parent directory (`../`)
- **Spec files**: `../docs/v5-specification/` (01-13, read-only during implementation)
- **Feature tracking**: `feature_list.json` (276 features, 10 agents, 12 categories)
- **Progress log**: `progress.txt` (append-only)
- **Type definitions**: `types/` (frozen, do not modify without leader approval)

## Required Reading

Before starting any implementation work, read these three documents in order:

1. **[10-implementation-guide.md](../docs/v5-specification/10-implementation-guide.md)** - What to do: team structure, task assignments, directory layout, module interfaces
2. **[13-agent-harness.md](../docs/v5-specification/13-agent-harness.md)** - How to do it: session startup checklist, single-feature workflow, quality gates, recovery procedures
3. **[12-test-specifications.md](../docs/v5-specification/12-test-specifications.md)** - Test definitions: every feature's test_ids reference this file. Read the relevant TEST-xxx sections when implementing each feature

## Core Rules

- **1 feature = 1 cycle = 1 commit** - never bundle multiple features
- **Follow the harness workflow** (13-agent-harness.md section 6) for every feature
- **Run session startup checklist** (13-agent-harness.md section 5) at every context window start
- **All config values from DB** (system_settings table) - no hardcoding
- **Adhere to types/** - all implementations must match frozen type definitions exactly
- **Record everything in progress.txt** - START, FAIL, COMPLETE, SMOKE, BLOCKED, SESSION events
- **Smoke test after every feature** - `npm run test:smoke` before moving to next feature

## Git

- Repository root is `../` (parent directory)
- Branch strategy: `feat/{agent-name}/{feature-id}` off `develop`
- Never commit directly to `main` or `develop`
- Commit message format: `feat({module}): {description} ({feature-id}, tests: {test-ids})`

## Quick Reference

```bash
# Session startup
cat progress.txt | tail -50          # Check last state
bash init.sh --check-only            # Health check
npm run test:smoke                   # Smoke test

# During work
npm run test:unit                    # Unit tests
npm run typecheck                    # Type check
npm run lint                         # Lint
npm run quality                      # All three above

# Feature selection
node -e "const f=require('./feature_list.json'); console.log(f.features.filter(x=>x.agent==='{agent-name}'&&!x.passes).map(x=>x.id+' '+x.priority+' '+x.description).join('\n'))"
```
