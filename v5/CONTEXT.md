# v5.0 Implementation Context

> This file tracks the current state of the v5.0 implementation for session continuity.
> Updated: 2026-03-10

## Current State: Production-Ready

### Quality Gates
- **TypeScript**: 0 errors
- **ESLint**: 0 errors, 15 warnings (non-critical `no-explicit-any` in algorithm files)
- **Tests**: 244 suites / 1127 tests — ALL PASSING
- **Features**: 276/276 implemented

### Source Stats
- ~200+ source files
- 4 LangGraph graphs, 115 MCP tools, 48 REST API routes (dashboard: core 33 + OAuth 7 + demo 8)
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

**Demo data fallback追加 (commit `91df510`):**
- `/api/accounts`, `/api/content`, `/api/kpi/snapshots`, `/api/kpi/summary`: DBに実データがない場合にリアルなデモデータを返す自動フォールバック
- `dashboard/lib/demo-data.ts` 新規作成（実データが入ったら自動無効化）

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

### Session 21: TikTok OAuth Complete Dashboard Flow (2026-03-05)

**TikTok OAuth browser-based flow — full dashboard implementation:**

**New files (5):**
- `dashboard/app/api/auth/tiktok/callback/route.ts` — OAuth callback: code→token exchange, user info fetch, accounts DB upsert (open_id重複チェック → UPDATE or INSERT with auto-generated ACC_XXXX ID)
- `dashboard/app/auth/tiktok/start/page.tsx` — admin専用ページ (getServerSession roleチェック), character select + fetch characters from DB
- `dashboard/app/auth/tiktok/start/TikTokStartForm.tsx` — "use client": character/username form, state=base64(JSON), redirect to TikTok auth URL
- `dashboard/app/auth/tiktok/result/page.tsx` — public (no auth), searchParams pass-through
- `dashboard/app/auth/tiktok/result/TikTokResultContent.tsx` — success/error display with i18n

**Modified files (5):**
- `dashboard/app/api/settings/[key]/route.ts` — GET handler追加 (admin専用, `{ value }` 返却), TikTokStartFormがclient_key取得に使用
- `dashboard/middleware.ts` — `/auth/tiktok/result` をPUBLIC_PATHSに追加
- `dashboard/components/layout/LayoutShell.tsx` — result pageにsidebar/headerなし
- `dashboard/lib/i18n/en.json` / `ja.json` — `tiktokAuth.*` 10キー追加 (EN + JA)

**Security fixes (separate commit):**
- GET /api/settings/:key: admin roleチェック追加 (viewer权限からのアクセス遮断)
- /auth/tiktok/start: server componentでadminチェック→非adminは/loginへリダイレクト
- token response全フィールド検証 (access_token/refresh_token/open_id/expires_in)
- quote-stripping除去 (pg jsonb auto-parse済み)
- エラー詳細をURLから除去しconsole.errorへ

**Type + spec fixes (separate commit):**
- `types/database.ts`: `token_expiry` → `expires_at` (YouTube/TikTok/Instagram全PF), YouTube/TikTokのclient_id/key除去 (system_settingsに保存)
- `docs/v5-specification/03-database-schema.md`: テーブル + コード例を同様に修正

**Redirect URI:** `https://ai-dash.0xqube.xyz/api/auth/tiktok/callback`
**Remaining (Developer Portal側):** App icon/description入力 → Submit for review → 承認後OAuthフロー実行 → E2Eテスト

**Bugfix (commit `bceb292`):**
- `TikTokStartForm.tsx`: OAuthリクエストのscopeに `video.publish` を追加（Direct Postに必須、漏れていた）
- 修正後: `video.publish,video.upload,video.list,user.info.basic`

**Commits:** `d76acbb`, `793b96a`, `5a1c19d`, `bceb292`
**Quality gates:** TypeScript 0 errors (v5 root + dashboard), build成功, VMデプロイ済み

### Session 28: /demo/instagram — Meta App Review Demo Page (2026-03-10)

**目的**: Instagram Meta App Review提出用スクリーンキャスト動画撮影のため、5スコープ全てをカバーするデモページを実装。

**実装ファイル（新規6ファイル）:**
- `dashboard/app/demo/instagram/page.tsx` — サーバーコンポーネント（admin認証 + activeアカウント取得）
- `dashboard/app/demo/instagram/InstagramDemoClient.tsx` — 3ステップUI（Account Info / Publish / Insights）
- `dashboard/app/api/demo/instagram/account/route.ts` — `instagram_basic` + `pages_show_list`
- `dashboard/app/api/demo/instagram/publish/route.ts` — `instagram_content_publish`（HTTPS URL検証、即時ポーリング）
- `dashboard/app/api/demo/instagram/insights/route.ts` — `instagram_manage_insights`（`period=day`, `metric_type=total_value`）※page insightsはPage Access Token必要のためAPI呼び出しなし（Step 1 Pageカードで代替）
- `dashboard/public/test-post.jpg` — VM上に配置した1080×1080 JPEG（Publish Stepのデフォルト画像）

**更新ファイル（3ファイル）:**
- `dashboard/app/demo/page.tsx` — InstagramカードをDEMOS配列に追加
- `dashboard/lib/i18n/en.json` / `ja.json` — `instagramDemo`キー39個追加、pageTitlesに`/demo/instagram`追加

**セキュリティ修正（テスト/レビューエージェント2体で発見）:**
- トークンをURLクエリパラメータではなく`Authorization: Bearer`ヘッダーで送信（全APIルート）
- `imageUrl`のHTTPS URL検証追加
- IMAGE containerの初回ポーリングは即時実行（不要な3秒待機を削除）
- 全APIコール失敗時はHTTP 502返却（サイレント200 OKではなく）
- 部分失敗時は`warnings`フィールドをレスポンスに含め、クライアントでamberバナー表示

**カバースコープ:**
| ステップ | スコープ |
|---------|---------|
| Step 1: Account Info | `instagram_basic`, `pages_show_list` |
| Step 2: Publish Photo | `instagram_content_publish` |
| Step 3: View Insights | `instagram_manage_insights`, `pages_read_engagement` |

**品質ゲート:** TypeScript 0エラー / ESLint 0エラー / ビルド成功 / VMデプロイ済み

**デプロイ:** `https://ai-dash.0xqube.xyz/demo/instagram`（デモアクセスURL: `/login?demo=8d2abfbc-acdd-4e22-92e6-2f065f9bd021`）

**Commits:** `29593bf`, `5a001d8`

**仕様書更新:** `02-architecture.md` #17セクション、`10-implementation-guide.md` ディレクトリ構造

---

### Session 34: 本番環境完全監査 + 全差分デプロイ (2026-03-10)

**目的**: 本番VM（ai-influencer-vm）の最新状態確認・整合性修正・各種再確認。

**発見・修正した問題:**

1. **`api/auth/instagram/deauthorize/route.ts` 未デプロイ**（重大）
   - VMに空の`deauthorize/`ディレクトリと旧`route.ts`（親ディレクトリ）が残存
   - `POST /api/auth/instagram/deauthorize`（Meta Webhook）が404になっていた
   - 正しいファイルをデプロイ、旧ファイル削除

2. **dashboard 5ファイルがローカルより古いバージョン**
   - `app/accounts/page.tsx`: プラットフォームアイコン・件数バッジ・空状態メッセージなし
   - `api/accounts/route.ts`, `api/content/route.ts`, `api/kpi/snapshots/route.ts`, `api/kpi/summary/route.ts`: Demo data fallbackなし（Meta App Reviewレビュアーに影響）

3. **src/ 22ファイルの差分**（主要なもの）
   - `mcp-server/tools/playbook/` 4ファイル完全欠落 → デプロイ
   - `mcp-server/index.ts`: Playbookツール未登録 → デプロイ
   - `workers/posting/adapters/x.ts`: `msg.includes('5')` 誤検知 → `/\b5\d{2}\b/` 正規表現に修正済み版をデプロイ
   - `types/database.ts`, `types/langgraph-state.ts`: 型定義更新

4. **TikTok access_token 3日前に期限切れ** → TikTok APIで自動更新（`2026-03-11 10:30 UTC`まで）

**デプロイ後作業**: `npm run build` → `docker restart v5-dashboard` → healthy確認

**その他確認項目（全て正常）:**
- nginx ✅ / Let's Encrypt 76日有効 ✅ / ディスク 10% ✅ / メモリ正常 ✅
- DEMO_ACCESS_TOKEN ✅ / Instagram token (2026-05-08) ✅ / DB全クレデンシャル ✅
- `collect-platform-metrics.ts`（VM専用）: rsync --delete不使用で保護済み ✅
- content_playbooks テーブル（migration 012）: 適用済み ✅

**未解決: YouTube ACC_0001 token期限切れ**（`2026-03-10 08:53 UTC`）
- Testing modeのため7日ごとにブラウザ操作が必要（自動化不可）
- Production API審査通過後は自動refresh_tokenで永続化

**CONTEXT.md監査（Sessions 33-34で完了）:**
- `git log`全コミットとCONTEXT.mdを照合、7件の消失セッション復元（merge conflict起因）
- 欠落コミット5件追記、MCP/REST API数値を正確な値に修正（115ツール + 48 REST API）
- spec docs（02-architecture.md, 10-implementation-guide.md）の数値も同期修正
- GitHub main/develop 完全同期済み（eec7b36）

### Session 33: Spec Doc 最終グリーンスイープ (2026-03-10)

**目的**: Session 32 修正後の仕様書ドキュメント整合性を Grep ツールで全量確認。

**確認結果（全て PASS）:**
- `maxAge=3600` 残存: なし ✅
- 旧テスト数 `1,124` 残存: なし ✅（全3箇所で `1,127` を確認）
- `youtube.upload` の使用状況: 正常（`youtube.readonly + youtube.upload` の組み合わせで記述）✅
- admin-only ルートで `401` 返却: なし ✅（全て `403` に統一済み）

**変更なし**（コード・ドキュメントとも修正不要と確認）

---

### Session 32: OAuth・デモAPI ベストプラクティス修正 + TypeScript型整備 (2026-03-10)

**コード修正:**
- Instagram CSRF nonce cookie TTL: `maxAge=3600s` → `maxAge=300s` に修正
  - `dashboard/app/api/auth/instagram/initiate/route.ts` — YouTube/TikTokと統一（5分で全OAuthフロー対応可能）
- デモAPI HTTP ステータスコード: admin権限不足時の 401 → 403 に修正（5ファイル）
  - `api/demo/tiktok/videos/route.ts`, `api/demo/tiktok/upload/route.ts`
  - `api/demo/instagram/account/route.ts`, `api/demo/instagram/insights/route.ts`, `api/demo/instagram/publish/route.ts`
  - 401 (Unauthorized) は「認証情報なし」、403 (Forbidden) は「権限不足」が正しい意味
- **TypeScript型修正: `InstagramOAuthCredentials.oauth.ig_user_id` 追加**
  - `types/database.ts`: `InstagramOAuthCredentials` の `oauth` オブジェクトに `ig_user_id: string` フィールド追加
    - DBの実際の保存構造（`parseCredentials()` が書き込む内容）と型定義が不一致だった
  - `src/workers/posting/adapters/instagram.ts`:
    - `InstagramOAuth` インターフェースに `ig_user_id: string` 追加
    - `parseCredentials()` に `ig_user_id: String(oauth['ig_user_id'] ?? raw['ig_user_id'] ?? '')` 追加

**仕様書更新:**
- `02-architecture.md`:
  - Instagram OAuth cookie TTL を `maxAge=300s` に修正（§12.3 Instagram OAuthフロー）
  - YouTube OAuth フロー説明追記（TikTok・Instagramは既存、Youtubeのみ欠落していた）
  - TikTok/Instagram OAuthフロー: result page redirect先を明記（`/auth/tiktok/result`, `/auth/instagram/result`）
  - InstagramOAuthCredentials 表: `oauth.ig_user_id` 行を追加
- `03-database-schema.md`:
  - `accounts.auth_credentials` Instagram 行に `oauth.ig_user_id` を追記（サマリー表 + SQL コメント例）
- `06-development-roadmap.md`:
  - テスト数 `1,124` → `1,127` に修正（3箇所: 行46, 446, 449）
- `10-implementation-guide.md`:
  - `api/auth/tiktok/initiate/` ディレクトリエントリ追加（コードには存在していたが漏れていた）
- `11-pre-implementation-checklist.md`:
  - §2.3 API Review ステータス: YouTube/TikTok/Instagram の ☐ → ☑ に更新（現状反映）

**Quality:** TypeScript 0 errors, ESLint 0 errors / 15 warnings (no-explicit-any のみ、既存)

---

### Session 31: YouTube API Services スクリーンキャスト提出完了 (2026-03-10)

**背景**: Session 30で実装した `/demo/youtube` を使ってYouTube API Servicesスクリーンキャスト動画を録画・提出。

**実施内容:**
- GCP Console OAuth 2.0クライアントに `https://ai-dash.0xqube.xyz/api/auth/youtube/callback` Redirect URI追加
- ACC_0001 refresh_token再取得 (`scripts/get-youtube-token.mjs`) — Testing mode 7日失効のため
- バグ修正: `channels.list?mine=true` は `youtube.upload` スコープ非対応 → `youtube.readonly` スコープ追加
  - `dashboard/app/api/auth/youtube/initiate/route.ts`: スコープに `youtube.readonly` 追加
  - `scripts/get-youtube-token.mjs`: スコープに `youtube.readonly` 追加
- セキュリティ修正: OAuth callback 全3プラットフォームの全エラーパスでnonce cookie削除漏れを修正
  - YouTube `callback/route.ts`: `missing_params`・`invalid_state` の早期エラーパスにcookie削除追加、`channelRes.ok` チェック追加
  - TikTok `callback/route.ts`: `missing_params`・`invalid_state`・`missing_credentials`・`token_exchange_failed`(×2)・`incomplete_token_response`・`db_error` 全パス修正
  - Instagram `callback/route.ts`: 上記に加えて `long_lived_token_failed`(×2)・`invalid_token`・`no_instagram_business_account`・`pages_fetch_failed` 全パス修正
- i18n修正: `pageTitles` に `/demo/youtube` と `/auth/youtube/result` キー追加（en.json / ja.json）
- 再度OAuthトークン取得（3スコープ: `youtube.readonly` + `youtube.upload` + `yt-analytics.readonly`）→ ACC_0001 DB更新
- デモ動作確認: Step1(チャンネル情報取得) → Step2(動画アップロード private) → Step3(アナリティクス) 全て成功
- スクリーンキャスト録画(16.4MB) → YouTube API Services Teamへメール返信で提出完了

**仕様書更新:**
- `docs/v5-specification/02-architecture.md`: YouTubeデモOAuthスコープ (`youtube.readonly`追加) + channel routeスコープ説明修正
- `docs/v5-specification/10-implementation-guide.md`: ディレクトリ構造にYouTube関連パス追加（`app/demo/youtube/`・`app/auth/youtube/result/`・`api/auth/youtube/`・`api/demo/youtube/`）

---

### Session 30: /demo/youtube — YouTube API Services審査用デモページ実装 (2026-03-10)

**背景**: YouTube API Services Teamから「動画アップロード・アナリティクス・OAuth 2.0接続のスクリーンキャスト動画を7営業日以内に提出してください」というメールを受領 (3/4)。期限3/13 (金) に向けてデモページを実装。

**新規作成ファイル (9ファイル):**
- `dashboard/app/demo/youtube/page.tsx` — サーバーコンポーネント。admin認証チェック + DBからYouTubeアクティブアカウント取得
- `dashboard/app/demo/youtube/YouTubeDemoClient.tsx` — 3ステップUI (Connect → Upload → Analytics)。i18n対応
- `dashboard/app/api/auth/youtube/initiate/route.ts` — Google OAuth URL生成 + CSRF nonce (httpOnly cookie, 300秒)
- `dashboard/app/api/auth/youtube/callback/route.ts` — OAuth code→token交換 → channels.list → accounts upsert。全エラーパスでnonce cookie削除
- `dashboard/app/auth/youtube/result/page.tsx` — OAuth結果ページ (PUBLIC_PATH)
- `dashboard/app/auth/youtube/result/YouTubeResultContent.tsx` — 成功/失敗表示
- `dashboard/app/api/demo/youtube/channel/route.ts` — チャンネル情報取得 (snippet + statistics)。admin専用 (403)
- `dashboard/app/api/demo/youtube/upload/route.ts` — 動画アップロード。resumable upload (initiate→PUT)。privacyStatus: private。admin専用 (403)
- `dashboard/app/api/demo/youtube/analytics/route.ts` — チャンネルアナリティクス直近28日。metrics: views, estimatedMinutesWatched, likes, comments, shares。admin専用 (403)

**更新ファイル (4ファイル):**
- `dashboard/app/demo/page.tsx` — DEMOS配列にYouTubeエントリ追加
- `dashboard/middleware.ts` — `/auth/youtube/result` をPUBLIC_PATHSに追加
- `dashboard/lib/i18n/en.json` — `youtubeDemo` / `youtubeAuth` キー追加
- `dashboard/lib/i18n/ja.json` — `youtubeDemo` / `youtubeAuth` キー追加（日本語）

**レビュー・修正 (コードレビューエージェント2体で検査):**
- `initiate`: CSRF nonce有効期限 3600秒 → 300秒 (TikTokと統一)
- `channel/upload/analytics`: YouTube API fetchをtry/catchで囲む。401 → 403 (roleミスマッチ)
- `callback`: 全エラーパス (missing_credentials, token_exchange_failed, db_error) でnonce cookie削除
- `en.json/ja.json`: 未使用dead key `analyticsTitle` を削除

**仕様書更新:**
- `docs/v5-specification/02-architecture.md`: §6.17 YouTubeデモ追加、パブリックパスに`/auth/youtube/result`追加

**Quality:** TypeScript 0 errors (v5 root + dashboard), workers/agentsテスト 254/254 pass

---


### Session 29: /demo/instagram API fixes + Login callbackUrl fix (2026-03-10)

**背景**: Meta App Reviewスクリーンキャスト動画撮影前に発見された実装バグを修正。

**修正1: Login callbackUrl (commit `7b2018b`)**
- `dashboard/app/login/page.tsx`: デモログイン・Googleログインどちらも `callbackUrl` をURLパラメータから読み取るよう修正（従来はハードコード`"/"`）
- 影響: middleware が未認証ユーザーを `/login?callbackUrl=/auth/instagram/start` にリダイレクトした際、demoボタンが表示されない問題を解消

**修正2: middleware matcher (commit `f8efecb`)**
- `dashboard/middleware.ts`: matcherの正規表現に画像・静的ファイル拡張子を除外追加（`.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.ico`, `.webp`, `.txt`, `.xml`）
- 影響: `public/test-post.jpg` がInstagram Graph APIからアクセス可能に（認証リダイレクトされなくなった）

**修正3: Insights API — Graph API v21.0対応 (commits `3ac95f5`, `b50b07f`, `4247728`, `f047b83`)**
- `graph.instagram.com` → `graph.facebook.com`（全APIエンドポイント）
- `impressions` → `accounts_engaged`（v21.0でimpressionsはユーザーレベル削除）
- `metric_type=total_value` 追加（`accounts_engaged`, `profile_views`はこのパラメータ必須）
- `period=days_28` → `period=day`（`accounts_engaged`はday periodのみ対応）
- Page insights API呼び出し削除（`/{page_id}/insights`はPage Access Token必要、User Access Tokenでは`#190`エラー）
- `InsightItem`インターフェース: `total_value?: { value: number }` フィールド追加
- `extractInsightValue()`: `total_value`形式と`values[]`形式の両方に対応

**修正4: i18n (同コミット)**
- `en.json` / `ja.json`: `impressions` → `accountsEngaged` ("Accounts Engaged" / "エンゲージアカウント")
- `pageImpressions` → `pageFans` ("Page Fans" / "ページファン数")

**修正5: Docker ヘルスチェック (commit `ba65a07`)**
- `docker-compose.production.yml`: ヘルスチェックを `curl` → `node` ワンライナーに変更
- `node:20-slim` イメージに `curl` が含まれないため "unhealthy" と誤報告されていた問題を解消

**修正6: .gitignore 新規作成 (commit `c4fcd92`)**
- `v5/.gitignore`: スクリーンショット PNG/JPG、`.playwright-mcp/`、テストスクリプト、ログを除外
- `v5/dashboard/.gitignore`: `.next/`、`next-env.d.ts`、`tsconfig.tsbuildinfo` を除外
- `tsconfig.tsbuildinfo` のgit追跡を解除（ビルドごとに自動生成される）

**結果**: 3ステップ全てエラーなし。5スコープ全て動画で確認済み。Meta App Review提出完了 (2026-03-10)。

**Commits:** `7b2018b`, `3ac95f5`, `b50b07f`, `4247728`, `f047b83`, `ba65a07`, `c4fcd92`

---

### Session 27: Dashboard Root Page Fix — VM Deployment Issue (2026-03-09)

**問題**: `https://ai-dash.0xqube.xyz` の `/` にアクセスするとKPIダッシュボードではなくプライバシーポリシーの内容が表示される

**原因**: VM上の `dashboard/app/page.tsx` が誤ってプライバシーポリシーページの内容に上書きされていた。gitリポジトリのコード（devbox側）は正しいKPIダッシュボードのまま。

**修正手順:**
1. `ssh pochi@34.85.62.184 "head -5 /home/pochi/ai-influencer/v5/dashboard/app/page.tsx"` で確認 → Privacyページの内容であることを確認
2. `rsync` でdevboxのローカル `app/page.tsx`（KPIダッシュボード）をVMに転送
3. VM上で `npm run build`
4. `docker restart v5-dashboard`

**確認**: ルートURL `/` にKPIダッシュボードが正常表示されることをユーザーが確認。

**Note:** gitリポジトリへのコード変更なし（VMのみの運用上の問題）。

### Session 26b: Demo Access for Meta App Review (2026-03-09)

**背景**: Instagram Meta App Reviewでレビュアーがダッシュボードを確認する必要があるが、Google OAuthホワイトリスト認証で外部者がアクセスできない問題への対応。

**実装: URLパラメータ方式 Demo Access**
- `/login?demo=<token>` でアクセスした場合のみログインページに「Demo Access (Reviewer)」ボタンを表示
- NextAuth.js CredentialsProvider (`id: "demo"`) を追加
- `DEMO_ACCESS_TOKEN` (system_settings) に格納されたトークンと一致した場合のみ認証成功
- Demo userは admin ロールで認証（Instagram OAuthフローページ `/auth/instagram/start` も確認可能）
- トークン: `8d2abfbc-acdd-4e22-92e6-2f065f9bd021`（DB + VM DB両方に登録済み）
- Demo URL: `https://ai-dash.0xqube.xyz/login?demo=8d2abfbc-acdd-4e22-92e6-2f065f9bd021`

**変更ファイル:**
- `dashboard/lib/auth.ts`: CredentialsProvider追加、DEMO_USER_EMAIL定数、signIn/jwt/session callbacks更新
- `dashboard/app/login/page.tsx`: `?demo` パラメータ検出時にDemo Accessボタン表示
- `dashboard/lib/i18n/en.json` + `ja.json`: `login.demoAccess` キー追加
- `docs/v5-specification/02-architecture.md`: Demo Access仕組みを認証セクションに追記
- `docs/v5-specification/10-implementation-guide.md`: auth.tsコメント更新

**テスト:** dsh-040 12/12 pass（token validation 6件 + role assignment 4件 + URL parameter 2件）
**Production deployment:** rsync → build → docker restart → curl 200確認 ✅

### Session 26: Instagram Meta App Review Prep + Deauthorize Webhook (2026-03-09)

**Instagram Meta App Review申請準備:**

**OAuth フロー完成確認:**
- ACC_0003 (pochi.dev, ig_user_id=17841480526543713, page_id=932599456610105) DB登録済み
- Long-lived token 有効期限: 2026-05-08

**callback/route.ts 修正 (前セッションからの続き):**
- `/me/accounts` → `debug_token` granular_scopes 方式に変更（Business Manager管理ページは`/me/accounts`で空配列返却される問題を解消）
- `RESULT_BASE` を絶対URLに変更（Docker内 `request.nextUrl` が localhost を返す問題を解消）
- CSRF nonce cookie TTL: 300s → 3600s
- `auth_type=rerequest` 追加（Facebook OAuth dialog で再認証強制）
- `InstagramStartForm`: characterId の required / disabled 制約を削除

**新規: POST /api/auth/instagram/deauthorize**
- Meta Facebook Login for Business がユーザーのアプリ連携解除時にコールするWebhook
- HMAC-SHA256 signed_request 署名検証（App Secret使用、base64url/パディング対応）
- 7ユニットテスト追加 (dsh-039): valid/invalid署名、改ざん検知、malformed、base64url文字など全パス
- `dashboard/app/api/auth/instagram/deauthorize/route.ts` 新規作成

**Meta Developer Portal設定完了:**
- App Settings > Basic: Privacy Policy URL, ToS URL, App Icon, App Domain (ai-dash.0xqube.xyz), Category設定済み
- Facebook Login for Business > Settings:
  - Valid OAuth Redirect URIs: `https://ai-dash.0xqube.xyz/api/auth/instagram/callback`
  - Deauthorize Callback URL: `https://ai-dash.0xqube.xyz/api/auth/instagram/deauthorize`
  - Data Deletion Request URL: `https://ai-dash.0xqube.xyz/privacy`

**App Review スコープ状況 (2026-03-09 時点):**
- `pages_show_list`: ✅ Request advanced access 申請済み (Edit App Review request表示)
- `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_read_engagement`: Graph API Explorerでテストコール実行済み → ボタン有効化待ち（最大24時間）
- `public_profile`: advanced access申請が必要（黄色い警告バナーあり）

**Permissions and Features UI仕様（重要知識）:**
- 上のセクション（標準パーミッション）: Instagram/Pages系スコープは存在しない
- 下のセクション（Tech Provider向け）: Instagram/Pages系スコープはここのみ → 常に下で検索

**次のアクション:**
1. 残り4スコープのボタン有効化後 → 全スコープ「Request advanced access」申請
2. `public_profile` advanced access申請
3. App Review > Requests > Continue request → 提出フォーム完成 → 提出

**Quality check:** TypeScript 0 errors (dashboard), dsh-039 7/7 pass
**Production deployment:** rsync → build → docker restart ✅

### Session 25: Instagram OAuth Dashboard Flow + Comprehensive Code Review (2026-03-06)

**Instagram全コードレビュー + 11件修正 (Agent Team: instagram-review):**

**Backend (src/):**
- H-1: `instagram.ts` — isRetryable `msg.includes('5')` → `/\b5\d{2}\b/.test(msg)`
- H-2: `instagram-insights.ts` — `refreshInstagramToken()` を `InstagramRefreshResult { access_token, expires_in }` 返却に変更。`collect-platform-metrics.ts` に `updateInstagramCredentials()` 追加、`expires_at` もDBに保存
- H-3: `token-refresher.ts` — `getExpiredTokens()` に Instagram `long_lived_token` 用クエリ追加（7日バッファで期限切れ検出）
- H-4: `instagram.ts` — media publish後に `GET /{media-id}?fields=shortcode` でshortcode取得、`post_url` を正しく構築
- M-3: `instagram-insights.ts` — Reels insights metricsに `shares` 追加; `CollectInstagramMetricsOutput` 型に `shares: number` 追加; syntheticInstagramにも追加
- L-1: `instagram.ts` — polling timeout後に FINISHED でなければ Error throw
- L-3: `instagram.ts` — `access_token` を URLパラメータから `Authorization: Bearer` ヘッダーに移行

**Dashboard (dashboard/):**
- M-1: `dashboard/app/api/auth/instagram/initiate/route.ts` 新規作成 — CSRF nonce生成（httpOnly cookie `instagram_oauth_nonce`, maxAge=300s）
- M-1: `InstagramStartForm.tsx` 修正 — クライアント側URL構築廃止 → `POST /api/auth/instagram/initiate` 呼び出し
- M-1: `callback/route.ts` — nonce cookie検証追加（CSRF保護）、成功/失敗時cookie削除
- M-2: en.json/ja.json に `/auth/instagram/start`・`/auth/instagram/result` pageTitles追加
- M-4: `callback/route.ts` — `authCredentials.oauth` から `app_id`/`app_secret` 除去（system_settings経由のみに統一）

**Privacy/Terms/About ページ全4プラットフォーム対応 (commit `0baf7d3`):**
- `dashboard/app/privacy/page.tsx`: Instagram (Meta/Instagram API Services) と X (Twitter API Services) のデータ収集・利用セクション追加
- `dashboard/app/terms/page.tsx`: 全11セクションに全4プラットフォーム対応内容で全面リライト（認可済み利用、API制限、OAuth認証、IP、免責、準拠法: 日本法）
- `dashboard/app/about/page.tsx`: 全面リライト（プラットフォーム詳細、技術スタック、運営者認証情報）
- 全ページ responsive 対応（`p-4 sm:p-10`）, Effective Date: March 6 2026

**Quality check:** TypeScript 0 errors (v5 root + dashboard), 244/244 suites pass
**Production deployment:** deploy → build (backend + dashboard) → docker restart

### Session 24: Demo Pages Reorganization + Sidebar Demos Link (2026-03-06)

**デモページ整理:**
- `/auth/tiktok/demo` → `/demo/tiktok` に移動（OAuthフローと分離）
- `/demo` indexページ新規作成（PF一覧、将来の追加に対応）
- `TikTokResultContent.tsx` の「Back to Demo」リンクを `/demo/tiktok` に更新
- i18n pageTitles: `/demo`, `/demo/tiktok` 追加 (EN + JA)

**サイドバーにDemosリンク追加:**
- `Sidebar.tsx`: `NavItem` に `role?` フィールド追加
- `useSession()` でuserRoleを取得し、`role: "admin"` 項目をフィルタリング
- `/demo` をsystemセクションに追加（adminのみ表示、PlayCircleアイコン）
- i18n: `sidebar.nav.demos` 追加 (EN: "Demos", JA: "デモ")

**Production deployment:** deploy → build → docker restart → verified

### Session 23: TikTok Comprehensive Code Review & Best-Practice Fixes (2026-03-06)

**全TikTokコードの総点検 + 14件の問題修正:**

**Backend fixes (src/):**
- `src/workers/posting/adapters/tiktok.ts` — H-1: `isRetryable` の `msg.includes('5')` を `/\b5\d{2}\b/.test(msg)` に修正（誤検知防止）; M-1: `post_url` が `open_id` ではなく `platform_username` を使うよう修正（open_idはURLに不適切）
- `src/workers/measurement/adapters/tiktok-analytics.ts` — H-2: `refreshTikTokToken` の戻り値を `string` から `TikTokRefreshResult { access_token, refresh_token, expires_at }` に変更（token rotation対応）; H-3: Video Query API の `fields` に `duration` 追加（`collect_count`/`average_time_watched` はAPI v2非対応のためコメント記載）
- `src/workers/posting/token-refresher.ts` — M-4: `ExpiredTokenRow` の型定義を実際のDB JSONB構造 `{ oauth: { access_token, refresh_token, expires_at }, open_id }` に修正
- `src/mcp-server/tools/measurement/collect-platform-metrics.ts` — H-3関連: durationフィールド追記に伴うスキーマ整合

**Dashboard fixes (dashboard/):**
- `dashboard/app/api/auth/tiktok/initiate/route.ts` — **New file** (M-2: CSRF保護): サーバーサイドでnonce生成 → httpOnlyクッキーに保存 (maxAge=300s) → `authUrl`をJSON返却。admin専用
- `dashboard/app/auth/tiktok/start/TikTokStartForm.tsx` — M-2: クライアントサイドURL構築を廃止 → `POST /api/auth/tiktok/initiate` を呼び出してauthUrlを受け取りリダイレクト
- `dashboard/app/api/auth/tiktok/callback/route.ts` — M-2: stateからnonce抽出 → `tiktok_oauth_nonce` cookieと照合 → mismatch時403リダイレクト+cookie削除; 成功時もcookie削除
- `dashboard/app/auth/tiktok/demo/TikTokDemoClient.tsx` — L-1: `DEMO_VIDEOS` の日付を2025→2026に修正 (timestamps: 1772668800, 1772496000, 1772323200); L-2: h1をi18n key `tiktokDemo.pageTitle` に変更; Step 3にamberバナー+サマリーバッジ4件+動画テーブル追加
- `dashboard/app/auth/tiktok/start/page.tsx` — L-3: ハードコードされた `<h1>Connect TikTok Account</h1>` をTikTokStartForm内の `{t("tiktokAuth.startTitle")}` に移動
- `dashboard/lib/i18n/en.json` + `ja.json` — M-3: `pageTitles` に3ルート追加 (`/auth/tiktok/start`, `/auth/tiktok/demo`, `/auth/tiktok/result`); `tiktokDemo.pageTitle` 等追加

**TikTok App Review:**
- 動画撮影 (`tiktok-verification.mov`): Step1 Connect → Step2 Upload → Step3 View videos (demo dataで表示)
- App Review提出完了 (2026-03-05)。審査中 (通過後にsandbox制限解除)

**Spec update:**
- `02-architecture.md` (commit `31e0e76`, 2026-03-06): §12.3 TikTok CSRF nonceの詳細説明追加、token rotation注記、§17 Platform Demosセクション追加

**Quality check:** TypeScript 0 errors (v5 root + dashboard), ESLint warnings 変化なし, テスト 244/244 suites pass

### Session 22: TikTok Demo Page for App Review (2026-03-05)

**TikTok App Review用デモページ — Direct Post API動作デモ:**

**New files (4):**
- `dashboard/app/auth/tiktok/demo/page.tsx` — Server Component, admin専用 (getServerSession roleチェック), アクティブTikTokアカウントをDB取得
- `dashboard/app/auth/tiktok/demo/TikTokDemoClient.tsx` — "use client": 3-step UI (Connect TikTok → Post video via Direct Post API → View posted videos)
- `dashboard/app/api/demo/tiktok/upload/route.ts` — POST: TikTok Direct Post API init + chunk video upload, admin認証必須
- `dashboard/app/api/demo/tiktok/videos/route.ts` — GET: TikTok video list API, admin認証必須

**Modified files (5):**
- `dashboard/app/auth/tiktok/result/TikTokResultContent.tsx` — OAuth成功後に「Back to Demo」リンク追加
- `dashboard/components/layout/LayoutShell.tsx` — `/auth/instagram/result` パスをレイアウト除外に追加
- `dashboard/middleware.ts` — `/auth/instagram/result` をPUBLIC_PATHSに追加
- `dashboard/lib/i18n/en.json` / `ja.json` — `tiktokDemo.*` i18nキー追加 (EN + JA)

**Bug fix:**
- `callback/route.ts`: `username` → `platform_username` カラム名修正 (UPDATE文 + INSERT文の両方)

**Spec update:**
- `02-architecture.md`: パブリックパスに `/auth/tiktok/result`, `/auth/instagram/result` を追加
- `10-implementation-guide.md` (commit `0a18961`, 2026-03-05): ディレクトリ構造を更新 — TikTok/Instagram OAuthページ (`auth/tiktok/`, `auth/instagram/`)、demoルート (`demo/tiktok/`, `demo/instagram/`)、パブリックページ (`/about`, `/privacy`, `/terms`) を追加

### Session 20: TikTok API Setup + Terms of Service Page (2026-03-04)

**TikTok Developer App作成 + クレデンシャル登録:**
- TikTok for Developers で `AI-Influencer` アプリ作成（個人、Category: Social Networking）
- Products: Login Kit + Content Posting API 追加
- Scopes: `user.info.basic` (Login Kit自動), `video.publish` (Direct Post), `video.upload` (Content Posting API), `video.list` 追加
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` を `system_settings` に登録（YouTubeと同じ設計）

**コード修正 — TikTok credentials設計をYouTubeと統一:**
- `src/workers/posting/adapters/tiktok.ts`: `client_key`/`client_secret` を per-account `auth_credentials` から `system_settings` (TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET) 読み込みに変更
- `src/workers/measurement/adapters/tiktok-analytics.ts`: `refreshTikTokToken()` も同様に `system_settings` から読み込み
- 各アカウントの `auth_credentials` には `access_token`, `refresh_token`, `open_id`, `expires_at` のみ保存

**Terms of Serviceページ追加 + Privacy Policy更新:**
- `dashboard/app/terms/page.tsx`: 新規作成（9セクション、TikTok/YouTube両方対応）
- `dashboard/app/privacy/page.tsx`: TikTokセクション追加（§8 TikTok API Services、データ収集にTikTokトークン・open_id・メトリクスを明記）
- `dashboard/middleware.ts`: `/terms` をPUBLIC_PATHSに追加
- 外部アクセス確認: `https://ai-dash.0xqube.xyz/terms` / `/privacy` ともにHTTP 200 ✅

**仕様書更新:**
- `02-architecture.md`: パブリックパスに `/terms` 追加、TikTok auth_credentials設計更新
- `03-database-schema.md`: TikTok auth_credentials から client_key/secret を除外、system_settings参照を明記

**追加: サイドバー Terms リンク + LayoutShell 修正 (commit `88cf92c`, 2026-03-04)**
- `LayoutShell.tsx`: `/terms` をレイアウト除外パスに追加（`/about`, `/privacy` と同様）
- `Sidebar.tsx`: フッターに Terms リンクを追加（About · Privacy · Terms の3リンク）

**Quality check:** typecheck ✅ / tests 211/211 ✅

### Session 20: Add viewer user t.s.0131.1998@gmail.com (2026-03-04)

**Added new viewer-role dashboard user:**
- `t.s.0131.1998@gmail.com` — viewer role
- Updated `sql/010_auth_settings.sql` — AUTH_ALLOWED_EMAILS + AUTH_USER_ROLES
- Updated `docs/v5-specification/03-database-schema.md`
- Cloud SQL updated directly via SSH
- Dashboard container restarted (`docker restart v5-dashboard`)
- **⚠️ GCP OAuth consent screen (Testing mode): t.s.0131.1998@gmail.com must be added as test user manually in GCP Console**
- **Fix (Session 21, commits `cb8b54a` + `614ba84`, 2026-03-04 13:07-13:09):** 初回登録時に大文字 `T.S.` で登録したため認証失敗。Google OAuthは常に小文字でメールを返すため小文字に修正。`sql/010_auth_settings.sql` + `docs/v5-specification/03-database-schema.md` を更新。

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

**追加: Playbooks Drive/Docs セットアップスクリプト (commit `1badab4`, 2026-03-04)**
- `scripts/setup-playbook-drive.mjs` / `scripts/setup-playbook-docs.mjs` 追加
- `docs/playbooks/TEMPLATE.md` 更新

**Commits:**
- `63d0b41 feat(dashboard): add content_playbooks to Database Viewer whitelist` (this session, prior)
- (this fix) doc consistency commit
- `1badab4 feat(playbooks): add Drive/Docs setup scripts and update TEMPLATE.md`

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

### Sessions 17-18 補足: 投稿・計測・制作パイプライン バグ修正 (2026-03-03)

> **注**: マージコンフリクト解消 (`5a001d8`) により消失していたセッション記録を復元。

**背景**: E2Eテスト実施中に発見されたクリティカルバグを同日中に全修正。

**修正1: 投稿パイプライン アーキテクチャ + アダプターバグ (commit `e6a4a80`)**
- `update-content-status`: `scheduleForPublishing()` 追加 → publications(status='scheduled') + task_queue('publish') を作成
- `get-publish-task`: JOIN を account_id ベースに修正; `account_id` を `GetPublishTaskOutput` 型に追加
- `publish-to-platform`: 4つのスタブ実装 → YouTubeAdapter, TikTokAdapter, InstagramAdapter, XAdapter に置換
- `publishing-scheduler`: 全 `callMcpTool` 呼び出しに account_id を伝播
- `report-publish-result`: publications UPDATE 時の rowCount チェック追加

**修正2: 制作パイプライン download/concat/race conditions (commit `9ca3d62`)**
- `orchestrator.ts`: fal.ai 動画をローカルファイルにダウンロード → TTS ミックス → Drive アップロードの正しいフローに修正
- `ffmpeg.ts`: `downloadVideoToFile`, `addAudioToVideo`, `addSilentAudio` ヘルパー追加
- `production-pipeline.ts`: `job_id` → `request_id` 修正; マルチセクション動画の concat + Drive アップロード修正
- `get-production-task` + `get-publish-task`: `FOR UPDATE SKIP LOCKED` トランザクションで race condition 防止

**修正3: auth_credentials null ガード (commit `7d16114`)**
- YouTube/TikTok/Instagram/X アダプター: `auth_credentials` が null の場合に `parseCredentials()` を呼ばないよう null チェック追加

**修正4: intelligence/strategy null safety + data integrity (commit `99364d5`)**
- `extract-learning`: `INSERT RETURNING rows[0]` の null チェック追加
- `get-recent-intel`: `collected_at` が NULL の場合の `toISOString()` ガード
- `get-competitor-analysis`: followers/views の bigint 安全キャスト
- `allocate-resources`: UPDATE cycles 後の rowCount チェック
- `send-planner-directive`: `getPendingDirectives` 重複実装を削除（canonical は `get-pending-directives.ts`）
- `strategy-nodes`: `min_confidence` 0.6→0.7 に修正（spec デフォルトに合わせる）

**修正5: 制作 production-readiness バグ (commit `197b8bd`)**
- `token-refresher`: JSONB パス `oauth->refresh_token/expires_at` 修正（フラットな `oauth_refresh_token/oauth_token_expires_at` では DB にマッチしない問題）
- `orchestrator`: `processAllSections` を try/finally で囲み、エラー時に tempDir をクリーンアップ
- `instagram`: Drive ファイルの permissions API レスポンスチェック追加（失敗時に throw）
- YouTube/TikTok/X アダプター: `AbortSignal` を `downloadFromDrive` の fetch 呼び出しに伝播

**修正6: 計測パイプライン クリティカルバグ (commit `e930686`)**
- **CRITICAL-2: detectTargets 無限ループ防止** — LEFT JOIN → INNER JOIN。prediction_snapshots 行がない場合の無限48h再検出ループを解消
- **CRITICAL-1: engagement_rate 計算修正** — `Math.min(1, (likes+comments+shares+saves)/views)` に修正
- **HIGH-4**: publication status='measured' への更新を 30日経過後のみに制限
- **HIGH-6**: AbortSignal を全4プラットフォームアダプターに伝播
- **HIGH-7**: `lookupCredentials` の DB エラーをサイレント無視から console.warn に変更
- E2Eテスト結果: ACC_0001 (@0xvioletxyz) views=1298, likes=13, engagement_rate=0.0108 ✅

**修正7: 投稿パイプライン クリティカルバグ + About/Privacy ページ追加 (commit `4a41b1b`)**
- `publishing-scheduler`: `account_id` フィルタを JOIN に追加（1:Nモデルで他アカウントの publications を誤取得する問題）
- `publish-recorder`: UPDATE→INSERT fallback パターンに変更（scheduleForPublishing との整合）
- `update-content-status`: `fetchPublishMetadata()` 追加 — task_queue payload に title/description/tags/video_drive_id を含める
- `publish_to_*` MCP スキーマ: 全パラメータ（content_id のみ → 全フィールド）を追加
- **Dashboard: `/about` と `/privacy` ページを新規追加（Google OAuth Production 申請に必要）**
  - About/Privacy リンクを Sidebar フッターに追加
  - `/about` と `/privacy` を `PUBLIC_PATHS` に追加（認証不要）

**仕様書更新 (commit `779fc65`)**
- `04-agent-design.md`: publish_to_* ツールに account_id 追加、各フローの修正内容を反映

**品質チェック**: 244/244 suites, 1127/1127 tests passing

---

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
