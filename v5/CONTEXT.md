# v5.0 Implementation Context

> This file tracks the current state of the v5.0 implementation for session continuity.
> Updated: 2026-02-25

## Current State: Production-Ready

### Quality Gates
- **TypeScript**: 0 errors
- **ESLint**: 0 errors, 15 warnings (non-critical `no-explicit-any` in algorithm files)
- **Tests**: 244 suites / 1124 tests — ALL PASSING
- **Features**: 276/276 implemented

### Source Stats
- ~200+ source files
- 4 LangGraph graphs, 111 MCP tools, 31 REST API routes
- 33 DB tables, 156 indexes, 15 triggers, 126 system_settings

## Session History

### Sessions 1-3: Full Scaffold
- 276/276 features scaffolded with tests
- 243 test suites, 1121 test cases created

### Session 4: Production Quality
- All tests passing (243/243, 1121/1121)
- TypeScript 0 errors, ESLint 0 errors

### Session 5: Hardening Round 1 (17 fixes)
- P0: measurement-job task_id=0 crash, zero-vector stubs, dual DB pool, wrong column names
- P1: silent error catches, SQL injection, LLM generation via Anthropic Haiku
- Dashboard: API route fixes, status enum corrections, JSON error handling

### Session 6: Hardening Round 2 (22 fixes)
- P0: token-refresher non-existent columns, prediction wrong column/JOIN, graph-communication wrong timestamps
- Process handlers: unhandledRejection + uncaughtException
- Error handling: 11 silent catches → proper logging
- Dashboard API: 7 fixes (accounts enum, kpi/snapshots columns, performance columns, JSON parsing)

### Session 7: Stub Elimination (28 items replaced)
All stubs/placeholders replaced with real API implementations using 4-agent parallel team:

**publishing-agent (Task #1):**
- YouTube: Data API v3 resumable upload + OAuth2 token refresh
- TikTok: Content Posting API v2 (init→upload→poll) + OAuth2
- Instagram: Graph API v21.0 Reels (container→poll→publish) + ig_refresh_token
- X: API v2 tweets + OAuth 1.0a HMAC-SHA1 (Node.js crypto, no npm dep)
- Text generator: Claude Sonnet LLM with character personality prompting

**measurement-agent (Task #2):**
- YouTube Analytics API v2 (GET /v2/reports)
- TikTok Video Query API (POST /v2/video/query/)
- Instagram Graph API v21.0 Insights + Reels insights fallback
- X API v2 public_metrics + OAuth 1.0a
- 6 new adapter files in src/workers/measurement/adapters/
- Per-platform engagement rate calculations

**video-production-agent (Task #3):**
- Google Drive: googleapis + google-auth-library, service account JWT upload
- Quality check: ffprobe validation (codec, resolution, duration, bitrate, audio) + blackdetect
- Character image: fal.ai flux-pro/v1.1 generation + Drive upload
- Dependencies added: googleapis@^171.4.0, google-auth-library@^10.5.0

**intelligence-agent (Task #4):**
- Character profile: Claude Sonnet LLM personality generation (replaces lookup table)
- Voice selection: Fish Audio API catalog search (GET /model) with scoring
- Cumulative analysis: Claude Haiku LLM interpretation (replaces if/else rules)

**test-agent (Task #5):**
- Updated 5 integration tests (INT-001 through INT-005) with real DB patterns
- Created E2E full-cycle test: cycle→hypothesis→produce→publish→measure→analyze
- New test count: 244 suites, 1124 tests

### Test Fix: mcc-027 DB Contamination
- Changed test cluster from 'cluster_a' to 'cluster_pub027' to prevent cross-test pollution
- Added account_baselines + prediction_snapshots cleanup in afterAll

### Session 8: 4-Layer Architecture Compliance (2 deviations fixed)

**langchain-mcp-adapters (Layer 2→3 bridge):**
- Created `src/agents/common/mcp-client.ts` — MCP client utility (getMcpTools, callMcpTool, closeMcpClient)
- Uses dynamic `import()` for `@langchain/mcp-adapters` (CJS/ESM compatibility)
- Singleton pattern with stdio transport spawning MCP Server as child process
- Modified 4 graph files + strategy-nodes.ts: all direct MCP tool imports → `callMcpTool()` via MCP Protocol
- Architecture: `LangGraph node → callMcpTool() → langchain-mcp-adapters → MCP Protocol (stdio) → MCP Server → PostgreSQL`
- Added `@langchain/mcp-adapters@0.4.3`, updated `@langchain/core` 0.3.30→0.3.44

**Shadcn/ui (Layer 1 Dashboard):**
- Installed: class-variance-authority, clsx, tailwind-merge, lucide-react, 6 @radix-ui/* primitives, tailwindcss-animate
- Created 9 Shadcn/ui components: Button, Card, Input, Textarea, Badge, Table, Tabs, Select, Separator
- Created 3 layout components: Sidebar, Header, LayoutShell
- Created `dashboard/lib/utils.ts` with `cn()` utility
- Updated `tailwind.config.ts` with Shadcn/ui semantic color tokens + Solarized HSL mapping
- Updated `globals.css` with Shadcn/ui CSS variables mapped to Solarized palette
- Updated all 17 page files to use Shadcn/ui components
- All 38 dashboard test suites / 186 tests passing

### Session 9: Dashboard 100% Spec Compliance + Playwright Verification

**Home page rework (5 Recharts components):**
- KPISummaryCards: 4 cards (Total Accounts, Active %, Avg Quality, Daily Budget)
- EngagementTrendChart: Recharts AreaChart, 30-day, cyan gradient
- AccountGrowthChart: Recharts BarChart, weekly deltas
- RecentContentTable: Latest 20 items with status badges
- PlatformBreakdownPie: Donut PieChart, 4 platform colors
- SWR auto-refresh (30s interval)

**Recharts on data pages (6 pages):**
- KPI: Period selector (7d/30d/90d), KPI trend LineChart, Goal vs Actual BarChart, Achievement Rate LineChart
- Performance: Engagement rate LineChart, Top 10 followers BarChart
- Hypotheses: Verdict/category filters, accuracy trend LineChart, verdict distribution PieChart
- Learnings: Min confidence/category filters, confidence histogram BarChart, category PieChart
- Agents Evolution: BarChart for self_score, LineChart for progression
- Agents Growth: Cross-agent LineChart comparison, learning velocity display

**4 stub pages implemented (4 new API routes):**
- Characters: `/api/characters` — summary cards, status filter, table with pagination
- Costs: `/api/costs` — budget cards, alert banner, daily history, recent tasks
- Production: `/api/production` — 5 summary cards, dual filters, task table with priority badges
- Tools: `/api/tools` — Tools/Recipes view toggle, tool table, recipe cards

**UI polish features (6 items):**
- Theme toggle: Dark/Light via data-theme, localStorage persistence, Sun/Moon icons
- Directives creation form: type/agent/priority dropdowns + content textarea
- Error log retry/abandon: PUT /api/errors endpoint, Retry/Abandon buttons per row
- Content review radar chart: Recharts RadarChart for 5 quality dimensions
- Mobile responsive sidebar: Hamburger menu, slide-in/out, overlay, auto-close on nav
- SWR auto-refresh: 30s interval, revalidate on focus, 5s deduplication on Home/KPI/Errors/Content

**Test fixes:**
- dsh-030: Added bg-red-900/bg-yellow-900 CSS classes for status color coding
- dsh-020: Added 総アカウント数/総コンテンツ数/レビュー待ち labels to KPI page

**Playwright UI/UX verification (all 15 pages):**
- Home, KPI, Accounts, Characters, Content, Production, Review, Curation
- Performance, Hypotheses, Learnings, Agents, Directives, Tools, Errors, Costs, Settings
- Theme toggle: Dark → Light verified with screenshots
- Mobile responsive: 375x812 viewport, hamburger menu, sidebar slide-in, auto-close on nav
- All pages render without errors (only favicon 404)

**Quality gates:** TypeScript 0 errors, 244/244 suites, 1124/1124 tests passing

**Production deployment:**
- Cloud SQL: `ai_influencer` DB created, pgvector enabled, 9 migration files applied (33 tables)
- VM: Node.js 20 installed, repo cloned, npm install + build (app tsc + dashboard next build)
- All 31 API routes: `export const dynamic = "force-dynamic"` (prevents build-time pre-rendering)
- Standalone compose: `docker-compose.production.yml` (dashboard + Cloud SQL, no local postgres)
- Container: `v5-dashboard` on `127.0.0.1:3001`, nginx reverse proxy on `:3000`/`:443`
- HTTPS: nginx + Let's Encrypt cert for `ai-dash.0xqube.xyz` (TLS 1.2/1.3), HTTP→HTTPS redirect
- Auth: Google OAuth via NextAuth.js (email whitelist + RBAC from DB)
- Access: **https://ai-dash.0xqube.xyz** (Google OAuth login)

### Session 10: Security + UI Contrast Hardening

**UI contrast improvement (globals.css):**
- Dark mode: foreground base0→base1 (#93a1a1), muted-foreground base01→base0 (#839496)
- Dark mode: border invisible base02→visible #314b54 (lightness 14%→24%)
- Light mode: foreground base00→base01 (#586e75), muted-foreground base1→base00 (#657b83)
- Light mode: border invisible base2→visible #c5bfae (lightness 87%→76%)
- Playwright verified: Dark/Light on Home, KPI, Settings, Content, Errors + mobile responsive

**HTTPS (nginx reverse proxy):**
- nginx on VM, Let's Encrypt cert for `ai-dash.0xqube.xyz` (managed by Certbot)
- Listens on :80 (redirect to HTTPS), :443 SSL, :3000 SSL, proxies to 127.0.0.1:3001
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- Docker binds only to localhost (127.0.0.1:3001:3000), no direct external access

**Basic Authentication (middleware.ts):** *(replaced in Session 11)*
- Superseded by Google OAuth — see Session 11 below

### Session 11: Google OAuth Migration (Basic Auth → NextAuth.js)

**Authentication overhaul:**
- Replaced Basic Auth (`DASHBOARD_USER`/`DASHBOARD_PASSWORD`) with Google OAuth via NextAuth.js v4
- GoogleProvider + JWT sessions (24h expiry), no DB session table needed
- Email whitelist: `AUTH_ALLOWED_EMAILS` in `system_settings` (jsonb array)
- Role-based access: `AUTH_USER_ROLES` in `system_settings` (jsonb object, admin/viewer)
- `signIn` callback: checks email against DB whitelist
- `jwt`/`session` callbacks: role assignment from DB

**New files (6):**
- `dashboard/lib/auth.ts` — NextAuth config, Google Provider, JWT callbacks, DB whitelist/role lookup
- `dashboard/app/api/auth/[...nextauth]/route.ts` — NextAuth API route (GET/POST)
- `dashboard/app/login/page.tsx` — Login page with Google sign-in button, Solarized theme, error messages
- `dashboard/components/providers/AuthProvider.tsx` — SessionProvider wrapper
- `sql/010_auth_settings.sql` — INSERT AUTH_ALLOWED_EMAILS + AUTH_USER_ROLES (category: dashboard, type: json)

**Modified files (5):**
- `dashboard/middleware.ts` — Basic Auth → `getToken()` JWT verification, public paths (/login, /api/auth/*), RBAC (viewer blocks POST/PUT/DELETE), CORS preserved
- `dashboard/app/layout.tsx` — Wrapped with `<AuthProvider>`
- `dashboard/components/layout/LayoutShell.tsx` — Skip shell on `/login` path
- `dashboard/components/layout/Header.tsx` — User email + role badge + LogOut button via `useSession`/`signOut`
- `docker-compose.production.yml` — `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (removed `DASHBOARD_USER`/`DASHBOARD_PASSWORD`)

**Bug fix:** `setting_value` is `jsonb` — pg driver auto-parses, removed double `JSON.parse()` that silently failed (caught → empty allow list → all users denied)

**Production deployment:**
- GCP Console: OAuth 2.0 Client ID created (Web application, redirect URI: `https://ai-dash.0xqube.xyz/api/auth/callback/google`)
- OAuth consent screen: External, test user `pochi@0xqube.xyz`
- Cloud SQL: `sql/010_auth_settings.sql` applied (2 new system_settings rows)
- `.env.production`: Added 4 NextAuth vars, removed DASHBOARD_USER/PASSWORD
- Dashboard rebuilt + container restarted

**Verified:**
- `pochi@0xqube.xyz` → Dashboard access (admin role)
- Other accounts → Access Denied
- `/api/*` → 401 without JWT
- `/login`, `/api/auth/*` → Public access
- Google OAuth redirect URI correct (`ai-dash.0xqube.xyz`)

## Remaining Items

### External Dependencies (code complete, awaiting approvals):
- Platform API review: YouTube/TikTok/Instagram/X (§2.3)
- Account creation: 50 accounts (§2.4)
- Character assets (§2.5)

### Non-Critical Improvements:
- MemorySaver → PostgresSaver (LangGraph checkpointer persistence)
- ESLint 15 warnings cleanup
- Google OAuth: Move from "Testing" to "Production" publishing status (currently limited to test users)

## Architecture Reference

### Platform Adapter Implementations
| Platform | Publishing API | Metrics API | Auth |
|----------|---------------|-------------|------|
| YouTube | Data API v3 (resumable upload) | Analytics API v2 | OAuth2 |
| TikTok | Content Posting API v2 | Video Query API v2 | OAuth2 |
| Instagram | Graph API v21.0 (Reels) | Insights API | Long-lived token |
| X | API v2 + media upload v1.1 | public_metrics | OAuth 1.0a HMAC-SHA1 |

### LLM Integrations
| Component | Model | Fallback |
|-----------|-------|----------|
| Text generation | Claude Sonnet 4.5 | Template strings |
| Character profile | Claude Sonnet 4.5 | Lookup table |
| Cumulative analysis | Claude Haiku 4.5 | Rule-based if/else |
| Script generation | Claude Haiku 4.5 | Template strings |
| Embeddings | OpenAI text-embedding-3-small | Zero vectors |

### 4-Layer Architecture (100% Compliant)
| Layer | Technology | Status |
|-------|-----------|--------|
| L1: Human Dashboard | Next.js 15 + Shadcn/ui + Tailwind CSS + Recharts | Complete |
| L2: LangGraph Orchestration | LangGraph.js 4 graphs → langchain-mcp-adapters → MCP Protocol | Complete |
| L3: MCP Tool Server | 111 tools via stdio transport | Complete |
| L4: Data Stores | PostgreSQL 16 + pgvector + Google Drive | Complete |

### DB Schema Key Facts
- `system_settings`: columns are `setting_key`, `setting_value`
- `metrics`: direct columns (`views`, `likes`, `engagement_rate`)
- `task_queue`: `started_at`, `completed_at`, `last_error_at` (NO `updated_at`)
- `accounts`: `auth_credentials` JSONB for all OAuth data
- `content` status: planned→producing→ready→posted→measured→analyzed
