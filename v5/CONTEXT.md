# v5.0 Implementation Context

> This file tracks the current state of the v5.0 implementation for session continuity.
> Updated: 2026-03-04

## Current State: Production-Ready

### Quality Gates
- **TypeScript**: 0 errors
- **ESLint**: 0 errors, 15 warnings (non-critical `no-explicit-any` in algorithm files)
- **Tests**: 244 suites / 1124 tests — ALL PASSING
- **Features**: 276/276 implemented

### Source Stats
- ~200+ source files
- 4 LangGraph graphs, 122 MCP tools, 21 REST API routes (dashboard)
- 34 DB tables, 156 indexes, 15 triggers, 126 system_settings

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
- Cloud SQL: `ai_influencer` DB created, pgvector enabled, 12 migration files applied (34 tables)
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

### Session 12: Sidebar UX Improvement

**Collapsible sidebar + independent scroll:**
- Sidebar: collapsible to icon-only mode on desktop (PanelLeftClose/PanelLeftOpen toggle)
- Sidebar: lucide-react icons for all 17 nav items, tooltip on collapsed hover
- Layout: `h-screen overflow-hidden` on root, sidebar and main content scroll independently
- Collapse state persisted in localStorage (`ai-influencer-sidebar-collapsed`)
- CSS variables: `--sidebar-width: 14rem`, `--sidebar-width-collapsed: 3rem`
- Mobile behavior unchanged (hamburger menu, slide-in overlay)

**Infrastructure:**
- `deploy.sh` script: 1-command deploy (git push → VM pull → build → restart)
- `CLAUDE.md` rewritten for review/refinement phase (removed implementation-phase rules)
- Cloud SQL: automated daily backups + PITR enabled (7-day retention, 04:00-08:00 JST)

### Session 13: i18n — Japanese/English Toggle

**i18n infrastructure (3 new files):**
- `dashboard/lib/i18n/index.tsx` — LanguageProvider (React Context + localStorage), `useTranslation()` hook returning `{ t, lang, setLang }`
- `dashboard/lib/i18n/en.json` — ~360 English translation keys (nested structure)
- `dashboard/lib/i18n/ja.json` — ~360 Japanese translation keys

**All dashboard text internationalized (22 files modified):**
- Layout: `layout.tsx` (LanguageProvider wrapper), Header, Sidebar, LayoutShell
- Login page: all text via `t()`
- All 17 pages: hardcoded strings → `t("key")` calls
- Default language: English, persisted via localStorage (`ai-influencer-lang`)

**Language toggle UI:**
- Custom slide toggle in Header (EN/JA labels inside track, active label on sliding thumb)
- Smooth CSS transition animation (`transition-transform duration-200`)
- Accessible: `role="switch"`, `aria-checked`, `aria-label`

**Test updates (12 files):**
- Tests use `fs.readFileSync` to check source strings → updated to check i18n keys instead of hardcoded text

**Quality gates:** TypeScript 0 errors, 38/38 dashboard test suites, 186/186 tests passing

### Session 14: Metadata, Security, Build Cleanup

**Metadata settings (layout.tsx):**
- `title.template`: `%s | AI Influencer` for per-page titles
- `robots`: `noindex, nofollow` (internal auth-protected dashboard)
- `appleWebApp`: capable, title, statusBarStyle: black-translucent
- `formatDetection`: telephone: false
- `viewport`: device-width, initialScale: 1, themeColor: `#002b36` (Solarized dark)

**Dynamic `<html lang>` sync:**
- `LanguageProvider` now updates `document.documentElement.lang` on language change
- Ensures screen readers detect correct language (en/ja)

**Security headers (next.config.js):**
- `X-Frame-Options: DENY` — clickjacking prevention
- `X-Content-Type-Options: nosniff` — MIME sniffing prevention
- `Referrer-Policy: strict-origin-when-cross-origin` — referrer leakage control
- `X-DNS-Prefetch-Control: on` — DNS prefetch for navigation speed
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disable unused browser APIs
- Verified on production with `curl -sI`

**Next.js upgrade:**
- 14.2.18 → 14.2.35 (resolved 11 critical CVEs)
- Remaining: 1 high (Next.js 16-only fix, accepted for 14.x)

**Build warning fix:**
- `agents/page.tsx`: 7 instances of `useState(() => { fetch(...) })` → `useEffect(() => {}, [])`
- Root cause: useState initializer runs during SSR/static generation, relative `/api/*` URLs fail without host
- Also fixed trailing `?` in empty URLSearchParams

**Unused dependency cleanup:**
- Removed `@radix-ui/react-switch` package + `components/ui/switch.tsx` (custom toggle used instead)

**Quality gates:** TypeScript 0 errors, build 0 warnings, npm audit 0 critical

### Session 15: Settings Page i18n + Layout Fix

**Settings page i18n (3 files updated):**
- `en.json`: Added `settings.categories.*` (8 labels), `settings.descriptions.*` (126 English descriptions), `settings.valueTypes.*` (6 types)
- `ja.json`: Added `settings.categories.*` (8 Japanese labels), `settings.descriptions.*` (126 Japanese descriptions from spec §11.5 SSOT)
- Japanese descriptions sourced directly from `02-architecture.md` §11.5 master table

**Settings page component (`settings/page.tsx`):**
- Category tabs: `{cat}` → `{t("settings.categories." + cat)}` — EN: "Production", "Cost Control" etc. / JA: "プロダクション", "コスト管理" etc.
- Descriptions: `{s.description}` → i18n lookup with DB fallback via `getDescription()` helper
- Type badges: `{s.value_type}` → `formatValueType()` helper — `integer`→`Integer`, `json`→`JSON` (English unified)
- Actions column: Added `w-[120px]` fixed width on TableHead + TableCell to prevent layout shift during Edit→Save/Cancel toggle

**Spec update (`02-architecture.md` §11.3):**
- Added i18n description: category tabs, descriptions i18n (EN/JA), type badges English-unified, DB fallback

**Playwright verification (10 checks):**
- EN mode: category tabs, descriptions, type badges verified
- JA mode: tabs and descriptions switch to Japanese
- Edit→Save+Cancel: no layout shift on other rows
- Cancel: returns to Edit button state
- Tab switching: correct filtering per category

### Session 19: Spec/CONTEXT Consistency Fix (2026-03-04)

**Strict review by negative-review agent — 13 issues found and fixed**

**Critical fixes (33→34 tables, 103→122 MCP tools):**
- `02-architecture.md`: テーブル数 33→34 (6箇所), MCPツール数 103→122 (3箇所), REST API合計 124→143
- `10-implementation-guide.md`: テーブル数 33→34 (8箇所), MCPツール数 103→122 + 8→13ディレクトリ, `playbook/` ディレクトリ追加
- `CONTEXT.md`: テーブル数 33→34, MCPツール数 111→122, migration files 9→12

**content_playbooks feature (commit `fbbc8a6`) — documented:**
- `sql/012_create_content_playbooks.sql`: `content_playbooks` テーブル (vector(1536), HNSW index)
- `src/mcp-server/tools/playbook/`: 4 MCP ツール (get_playbook, save_playbook, search_playbooks, update_playbook_effectiveness)
- Cloud SQL に migration 適用済み
- `dashboard/lib/database-tables.ts` に `content_playbooks` 追加済み (tool_management グループ)

**Minor code fix:**
- `dashboard/app/database/page.tsx`: `key={rowIdx}` → `key={row["id"] !== undefined ? String(row["id"]) : rowIdx}` (主キー優先)

**Commits:**
- `63d0b41 feat(dashboard): add content_playbooks to Database Viewer whitelist` (this session, prior)
- (this fix) doc consistency commit

### Session 18: Database Viewer Page (2026-03-04)

**New feature: read-only raw DB inspector (`/database`) — 16th dashboard page**

**New files (4):**
- `dashboard/lib/database-tables.ts` — `ALLOWED_TABLES` (34件ホワイトリスト) + `TABLE_GROUPS` 共有定数
- `dashboard/app/api/database/tables/route.ts` — GET `/api/database/tables`: 全34テーブルのメタデータ（行数・カラム定義）
- `dashboard/app/api/database/[table]/route.ts` — GET `/api/database/[table]?page&sort&order`: ページネーション付き生データ
- `dashboard/app/database/page.tsx` — UI: 7グループ分類 + SWR 60秒ポーリング + LIVE インジケータ

**Modified files (3):**
- `dashboard/components/layout/Sidebar.tsx` — Database ナビアイテム追加
- `dashboard/lib/i18n/en.json` / `ja.json` — `database.*` i18n キー追加（totalCount含む）

**Key design decisions:**
- `pg_stat_user_tables.n_live_tup` でリアルタイム行数（`pg_class.reltuples` は ANALYZE 未実行で -1 になるため不適）
- `information_schema.columns` に `table_schema = 'public'` フィルタ（スキーマ混在防止）
- vector 列は `ORDER BY` 不可 → `sortableColumns` から除外、ヘッダークリック無効
- `accounts.auth_credentials` → `[MASKED]`、`system_settings` の `CRED_*` 値 → `••••••••`
- `Number.isFinite()` ガード（`Math.max(1, NaN) === NaN` バグ対策）
- `TABLE_GROUPS` を `lib/database-tables.ts` に一元化（page.tsx で独自定義していた DRY 違反を解消）

**Best practices applied (7 fixes across 3 review rounds):**
1. `pg_stat_user_tables` に `schemaname = 'public'` 追加
2. `TABLE_GROUPS` DRY 違反解消（lib からimport）
3. `find(t => ...)` の変数シャドウ修正 → `find(tbl => ...)`
4. ページネーション `"total rows"` ハードコード → i18n 化
5. `handleSort` の setter 内 setter アンチパターン解消
6. `selectedMeta` を `useMemo` 化
7. `useEffect` で `lastUpdatedAt === null` 時の不要 interval 生成を排除

**Spec docs updated:**
- `02-architecture.md` §6.10/#16追加, §6.13/#20-#21追加, §6.14/#16セクション新設, REST API 19→21
- `10-implementation-guide.md` ディレクトリ構造・REST API表・ページ一覧 全更新 (15→16画面, 19→21 REST API)

**Commit:** `1b640af feat(dashboard): add Database Viewer page (/database)` (develop branch)

### Session 17: Dashboard Team Access Setup (2026-03-03)

**Team members added to dashboard access:**
- `zach@0xqube.xyz` — viewer role
- `badhan@0xqube.xyz` — viewer role

**Changes made:**
- `sql/010_auth_settings.sql` — Updated INSERT to include all 3 users (pochi=admin, zach=viewer, badhan=badhan=viewer)
- `docs/v5-specification/03-database-schema.md` — Updated example INSERT values to match
- Cloud SQL (`ai_influencer` DB): `AUTH_ALLOWED_EMAILS` and `AUTH_USER_ROLES` updated via direct SQL

**Auth architecture confirmed:**
- Gate 1: GCP OAuth consent screen (Testing mode) — **zach / badhan must also be added as test users in GCP Console manually**
- Gate 2: App whitelist (`AUTH_ALLOWED_EMAILS` in system_settings) — Done ✅
- viewer role: all pages readable, POST/PUT/DELETE/PATCH API returns 403 Forbidden
- admin role: full access (pochi@0xqube.xyz only)

**Live test results (https://ai-dash.0xqube.xyz):**
- Unauthenticated GET /api/* → 401 ✅
- Unauthenticated POST /api/* → 401 ✅
- Unauthenticated page → 307 redirect to /login ✅
- /login (public path) → 200 ✅

**Security fix (same session):**
- `get-youtube-token.mjs` / `sql/011_youtube_oauth_credentials.sql` に平文の Google OAuth Client ID/Secret が混入していた
- `git filter-repo` で全329コミットの履歴から完全削除
- スクリプトは `process.env` 参照、SQLは空文字デフォルトに修正
- `develop` branch を force push で GitHub に反映

**Pending (manual by user):**
- GCPコンソール: OAuth consent screen → Test users に zach / badhan を追加（Testingモードのため必須）

### Session 16: Settings Type-Aware Editor UI

**Type-aware editing by value_type (5 files):**
- `dashboard/components/ui/switch.tsx` — New Radix-free Switch component (forwardRef, `cn()` pattern, Solarized-compatible)
- `dashboard/app/settings/setting-editors.tsx` — Type-dispatched editor components:
  - `SettingValueCell`: integer/float → `<Input type="number">` (min/max/step from constraints), boolean → `<Switch>` toggle, enum → `<NativeSelect>` (options from constraints), string → `<Input>` (CRED_* → password mask), json → inline preview
  - `JsonEditorPanel`: AUTH_ALLOWED_EMAILS → tag list (Badge chips + Add), AUTH_USER_ROLES → key-value editor (email + role select + delete + Add Row), METRICS_FOLLOWUP_DAYS → number tag list, fallback → JSON textarea
- `dashboard/app/settings/page.tsx` — State: `editValue: string` → `editValue: unknown` + `expandedJsonKey` for JSON accordion rows. JSON types expand as `colSpan={5}` row below. CRED_* masked as `••••••••` when not editing
- `dashboard/lib/i18n/en.json` / `ja.json` — +12 i18n keys each (enabled/disabled, addEmail/addRow/addDay, emailPlaceholder, dayPlaceholder, role, masked, editJson, constraintRange, stepHint)

**Spec update (`02-architecture.md` §11.3):**
- Settings table component descriptions updated to reflect type-aware SettingValueCell + JsonEditorPanel (replaced EditSettingModal/SaveConfirmDialog)

**Production deployment:** rsync → build → docker restart → verified at https://ai-dash.0xqube.xyz

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
| L1: Human Dashboard | Next.js 14 + Shadcn/ui + Tailwind CSS + Recharts + i18n (EN/JA) | Complete |
| L2: LangGraph Orchestration | LangGraph.js 4 graphs → langchain-mcp-adapters → MCP Protocol | Complete |
| L3: MCP Tool Server | 111 tools via stdio transport | Complete |
| L4: Data Stores | PostgreSQL 16 + pgvector + Google Drive | Complete |

### DB Schema Key Facts
- `system_settings`: columns are `setting_key`, `setting_value`
- `metrics`: direct columns (`views`, `likes`, `engagement_rate`)
- `task_queue`: `started_at`, `completed_at`, `last_error_at` (NO `updated_at`)
- `accounts`: `auth_credentials` JSONB for all OAuth data
- `content` status: planned→producing→ready→posted→measured→analyzed
