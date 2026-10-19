# Refactor and Rederive Plan (2026-10-18)

Status: proposal. No code change is made by this document. Each phase needs
approval before it starts. Sources: a refactor audit and a rederive review of
`src/` and `tests/`, run by four read-only scouts at commit `88f2fec`. The main
session confirmed the items marked "confirmed (main)".

## 1. Executive summary

The codebase follows the house pattern (Result types, ports, branded types) in
most of the domain. The weak areas are the HTTP layer, the static builder, and
the tests that must judge a rewrite.

- Two correctness bugs and one security bug block a clean baseline (Phase 0).
- About a fifth of `src/` is dead or test-only code (Phase 1).
- `routes.tsx`, `Layout.tsx`, and most of `middleware.ts` have no behavioral
  tests. A rewrite of these modules is unsafe until Phase 2 adds them.
- The largest rederive targets are `validateFrontmatter` (maxCC 54),
  `createRouteHandlers` (577 LOC), and `createContentService` (112 branches).

Headline metrics. "Before" values are measured. "After" values are scout
estimates and need measurement after each phase.

| Metric | Before (measured) | After (estimate) |
| --- | --- | --- |
| `src/` LOC (no comments or blanks, excl. `jsx.d.ts`) | 6441 | needs measurement |
| `src/` AST branches | 878 | needs measurement |
| Branch coverage (modules imported by tests) | 79.9% | rise expected |
| Line coverage (modules imported by tests) | 70.3% | rise expected |
| Tests | 238 pass, 1 fail, 6 ignored | all pass, 0 ignored |
| `deno lint` problems | 13 | 0 |

## 2. Baseline measurements

Branches count `if`, `?:`, `case`, loops, `catch`, `&&`, `||`, `??`, `?.`, and
early returns inside `if`. The script is
`/private/tmp/claude-501/-Users-srdjans-Code-blogo/baf92efa-41f2-4a92-848b-340811b5a78b/scratchpad/measure.ts`
(TypeScript compiler API). Copy it into `scripts/` in Phase 1 (task R3) so that
later phases can re-run it. Coverage comes from `deno test --coverage`. "none"
means no test imports the module.

| Module | LOC | Branches | maxCC | Fan-in | Branch cov | Line cov |
| --- | --- | --- | --- | --- | --- | --- |
| domain/content.ts | 450 | 112 | 15 | 5 | 70.9 | 66.8 |
| http/middleware.ts | 415 | 103 | 25 | 2 | 80.8 | 47.6 |
| domain/validation.ts | 262 | 75 | 54 | 1 | 78.9 | 69.6 |
| mermaid-renderer.ts | 367 | 72 | 16 | 1 | 79.8 | 67.0 |
| http/routes.tsx | 577 | 46 | 10 | 3 | none | none |
| domain/static-builder.ts | 300 | 43 | 21 | 1 | 73.8 | 72.7 |
| http/render-vnode.ts | 140 | 42 | 25 | 3 | 83.1 | 81.2 |
| markdown-renderer.tsx | 167 | 36 | 21 | 2 | 71.4 | 37.7 |
| components/Layout.tsx | 455 | 34 | 34 | 1 | none | none |
| domain/atproto.ts | 203 | 25 | 12 | 2 | 62.9 | 89.3 |
| lib/result.ts | 126 | 24 | 4 | 17 | 100 | 56.4 |
| domain/health.ts | 214 | 17 | 7 | 4 | 76.7 | 71.4 |
| domain/config.ts | 89 | 16 | 6 | 1 | none | none |
| config/topics.ts | 125 | 16 | 7 | 5 | 100 | 68.1 |
| atproto/mapping.ts | 96 | 16 | 8 | 2 | 89.7 | 98.8 |
| app/main.ts | 167 | 14 | 7 | 0 | none | none |

The other 34 modules have 14 branches or fewer each. Test runtime is about 3 s
in total. The only test over 1 s is the middleware slow-request test (1100 ms
sleep).

## 3. Findings ranked by leverage

### Phase 0 items: bugs found during the review (not behavior-preserving)

**B1 Reflected XSS in `/search-modal` (confirmed (main)).**
`src/http/routes.tsx:357` puts the raw `q` parameter into a `text/html`
response. `routes.tsx:366-375` also puts `post.title` and `post.slug` into HTML
without escaping. Effect: a crafted link runs script on the blog origin. Fix:
render the fragment with hsx JSX, which escapes text, or call `escapeHtml` from
`src/utils.ts`. Test: a request with `q=<img src=x onerror=1>` must return the
escaped text.

**B2 Static builder renames files in the real `_site/` (confirmed (main)).**
`fingerprintAssets` (`src/domain/static-builder.ts:293-364`) calls `walk`,
`Deno.readFile`, `Deno.rename`, and `Deno.writeTextFile` directly. The tests
inject a mock writer that writes nothing to disk, so the step reads whatever
is on disk.
- Not idempotent: it appends a new hash even when the name already has one.
  The local `_site/css` file name now repeats the hash 14 times.
- This causes the failing test "report counts match generated files"
  (`tests/domain/static_builder_test.ts:228`). On a clean checkout `walk`
  throws NotFound instead, with the same effect.
- Fix: move file walking, reading, renaming, and writing behind the
  `FileWriter` port. Make the name planner pure, and skip names that already
  carry a hash. Add a test that builds twice and gets the same names.
- Production impact: `deno task build` cleans the output first (probable;
  confirm by reading `build()` step 1), so production probably sees one hash.

**B3 `draft: true` is validated but never applied (confirmed (main)).**
`validation.ts` accepts `draft`, but `parseFrontmatter` in `content.ts` drops
it, and no other file in `src/` reads it. Effect: a draft post would show in
lists, the feed, the sitemap, and the static build. No current post uses
`draft:`, so the bug is latent. Decision D3 asks whether drafts should be
hidden.

**B4 Error pages may be cached permanently in production (probable).**
`cachedRender` (`routes.tsx:100-130`) caches every 200 response with TTL
`Infinity` in production. Error branches render the error page through
`renderPage`, which returns 200 (scout report; confirm with a route test). One
failed `loadPosts` would then serve "Failed to load posts" until the next
restart. Fix: error pages return 500, so the existing `status === 200` guard
skips them.

**B5 `atproto.publishPost` parses frontmatter a second time (probable).**
`src/domain/atproto.ts:~85-125` uses a dynamic `import("@std/yaml")` and
`String(meta.x ?? "")`. It skips `validateFrontmatter`, ignores a `slug:`
override, and turns an unquoted YAML date into a `Date.toString()` string.
Fix: reuse `parseFrontmatter` from `content.ts`. Test: publish a post with an
unquoted date and assert `publishedAt`.

**B6-B11 Found during Phase 2 validation (behavior, not yet fixed).** Phase 2
tests pin each one with a "Current behavior" comment. Each needs a user
decision before a fix.
- B6 `markdown-renderer.tsx` `processImageAttributes`: the space-separated
  form `{width=300 height=200}` gives `width="300 height"`. Posts use only
  single attributes today.
- B7 `middleware.ts:13-23` `staticFiles`: `.json` at the root (for example
  `/test.json`) is not served; only files under known prefixes are.
- B8 `middleware.ts:112-115` `compress`: `minSize` is checked only against
  `Content-Length`, so small bodies without that header are compressed.
- B9 `routes.tsx` `ogImagePost`: an unknown slug or a content error gives the
  default SVG with 200, not 404 or 500.
- B10 `content.ts`: on an analytics error, `loadPostsMetadataWithViews`
  gives `viewCount: 0` but `loadPostsWithViews` leaves it undefined.
- B11 `validation.ts`: an impossible date such as `2025-02-30` passes.

### Mechanical findings (judge by branch count, with equal or higher coverage)

| Id | Location | Change | Expected delta | Risk |
| --- | --- | --- | --- | --- |
| M1 | `middleware.ts:67,84,271` + `createAccessLog`, `performanceMonitoring` | Delete 5 middlewares that the server never wires (`timeout`, `cors`, `etag` have no importer; the other 2 are test-only) and their tests | large share of the 103 branches; needs measurement | low |
| M2 | `src/metadata.ts`, `components/NotFound.tsx`, `components/TagIndex.tsx` | Delete 3 files with zero importers | -7 branches (counted from table) | low |
| M3 | `lib/result.ts:48,71,105,115`, `lib/types.ts:17`, `lib/error.ts:20`, `ports/logger.ts:64`, `mermaid-renderer.ts:301` | Delete exports with zero callers | small; raises function coverage | low |
| M4 | `validation.ts` `validateFrontmatter` | Rule list: `optString`, `optStringArray`, `normalizeDate`; keep error strings byte-identical | about 75 to 45 branches, maxCC 54 to about 10 (estimate) | low-medium |
| M5 | `content.ts:241-300` | One `loadFromDisk(parse)` and one `cached(cache, key, loader)` helper for posts and metadata | about -10 (estimate) | low |
| M6 | `content.ts:350-405` | One `toStub` mapper; drop the redundant `!analyticsService` branch (`getAllViewCountsCached` already returns `{}`) | about -4 (estimate) | low |
| M7 | `routes.tsx:55-65,107-109,235,395-463` | Collapse the no-op ternaries and copy; add `svgResponse` and `xmlResponse` helpers | about -4; same bytes and headers | low |
| M8 | `routes.tsx` 8 handlers | `page(ctx, meta, children)` and `errorPage(ctx, msg)` helpers; one `SITE_AUTHOR` constant (5 copies today) | about -60 LOC; branches unchanged | medium |
| M9 | `app/main.ts:84-95,139-166` | One `warm()` for pre-warm and watcher re-warm | nesting 6 to 3 levels | low |
| M10 | `atproto/mapping.ts:~95-105` | `extractBody` returns `content?.value ?? ""` | -3 (counted) | low |
| M11 | `static-builder.ts:70` | Delete unused `isHtmlRoute` | -1 | low |
| M12 | `atproto.ts:148` | Drop `skipped` (never changed, always reports 0) after a check of report consumers | -0; removes a false field | low |

### Type-driven findings (judge by removed illegal states, not branch count)

| Id | Location | Change | Removed failure class |
| --- | --- | --- | --- |
| T1 | `src/types/jsx.d.ts` (969 lines), `deno.json` `compilerOptions.types` | Delete. hsx 2.0.0 exports its own `JSX` namespace with SVG elements. A scout ran the type check without the file in a scratch copy and got 0 errors. | Two JSX type sources that can disagree; `JSX.Element = unknown` |
| T2 | `validation.ts:70-90` | `validateFrontmatter(data, now: Date)`; caller passes `clock.now()` | Time-dependent validation and tests |
| T3 | `domain/config.ts`, `routes.tsx:56`, `Layout.tsx:27,30,34`, `build.ts`, `at-*.ts` | `parseConfig(env)` returns `Result<Config>`; pass `SiteConfig` down. `PUBLIC_URL` has two different defaults today (`https://blogo.timok.deno.net` in 5 files, `http://localhost:port` in config). | Silent default drift; `NaN` `postsPerPage`; env reads per render |
| T4 | `Layout.tsx:11` `createLayout(): Response` | `renderLayout(props, site): string` plus one `htmlResponse` helper shared with `renderFragment`; JSON-LD moves to a pure function | Rendering tied to HTTP; duplicate header logic |
| T5 | `routes.tsx` handlers | Handlers return a `View` ADT (`Page`, `ErrorPage`, `Fragment`, `Xml`, `Svg`, `Text`, `Json`); one `toResponse` interpreter; cache only `Page` | Cached error pages (B4); header drift |
| T6 | `static-builder.ts` `RouteEntry.html: boolean` | `kind: "page" | "asset"`; `outputPath` stops guessing from the extension | Entry kind and output path that disagree |
| T7 | `content.ts:77` `getPostBySlug: AppResult<Post | null>` | `err({kind: "NotFound"})` instead of `null` | A nullable success that each caller must re-check |
| T8 | `analytics.ts` | KV behind a port; bound the `while (!success)` retry loop | Unbounded retry; untestable domain I/O |

## 4. Test-correctness findings (prerequisites)

| Id | Location | Problem | Fix |
| --- | --- | --- | --- |
| Q1 | `routes.tsx`, `Layout.tsx`, `src/app/*`, `analytics.ts`, `config.ts`, `ports/*` | No test imports them | Characterization tests for `createRouteHandlers` with a real `Request` and in-memory services: home page vs HTMX fragment, post, unknown slug (404), tag, search, search-modal, rss, sitemap, robots, health 503 |
| Q2 | `static_builder_test.ts:228-302` | `indexFiles` unused; `pages > 0` is a tautology; fragment count compares the mock with itself; failure paths untested | Assert exact counts; add writer-failure and `loadPosts`-error cases |
| Q3 | `middleware_test.ts:63-88` | "handles errors" asserts inside `catch` with no `fail()`, so it passes when nothing throws; the correlation-ID test never checks the log | `assertRejects`; a recording health-service double |
| Q4 | `middleware_test.ts:161` | Sleeps 1100 ms and does not assert the slow log | Lower the threshold or inject a clock; assert the log entry |
| Q5 | `middleware_test.ts:180-245` | Writes to the real `public/test.css` | Use `Deno.makeTempDir` |
| Q6 | `content_service_test.ts` | 8 tests; missing sort order, cache hit and miss, non-`.md` files, `readDir` error, search case, unknown tag, `*WithViews`; "handles missing files" tests an empty directory | Add the cases; rename the test |
| Q7 | `validation_test.ts` | No boundary tests (title 200/201, tag count 10/11, `2025-02-30`, non-string types) | Table-driven tests that assert the error text |
| Q8 | `markdown_renderer_test.ts:178,193,215,336,353`, `middleware_test.ts:247` | 6 ignored tests | Audio and image-attribute tests: delete them if the feature is gone (D5). Fence tests: assert current output. Content-type test: fix it with a temp dir |
| Q9 | `markdown_renderer_test.ts` | No sanitization tests (`<script>`, `javascript:` links, `onerror`) | Add them before any renderer change |
| Q10 | tests/ | `createMockFileSystem` and `createMockLogger` are copied across 4 files; the cache boilerplate is copied about 8 times in `content_service_test.ts` | `tests/helpers/` with one in-memory file system and one recording logger |

Rederive blockers in order: Q1 (routes, Layout), Q3-Q5 (middleware), Q2
(static builder), Q6 (content), Q7 (validation), Q9 (markdown).

## 5. Architecture findings

I/O inside the domain or rendering layers, each with its proposed port:

- `static-builder.ts:285-344`: file walk, read, rename, write. Move them to the
  `FileWriter` port (B2).
- `analytics.ts`: `Deno.openKv` direct. Add a KV port (T8).
- `domain/config.ts`, `routes.tsx:56`, `Layout.tsx:27-34`: `Deno.env`. Use
  `parseConfig(env)` once in `main.ts` (T3).
- `validation.ts`: `new Date()`. Inject `now` (T2).
- `health.ts`: `performance.now()` and a `performance.memory` cast. Add them to
  the `Clock` port.
- `content.ts`: hidden module state (`lastKnownViewCounts`,
  `viewCountsRefreshInFlight`) and a private `viewCountsCache`. Move them to a
  `ViewCounts` port whose adapter owns the stale-while-revalidate logic.
- `markdown-renderer.tsx:44`: `console.warn` and a global `marked` mutation at
  import time. Low priority.

## 6. Docs to update

- `CLAUDE.md` testing example: `files[path] ?? throw new Error(...)` is not
  valid TypeScript. The real mock returns a Result. The layer list omits
  `src/atproto/`, `src/config/`, and the top-level renderers. The commands list
  omits `build`, `at:*`, and `frontmatter:check`. "YAML parsing uses static
  import" is false for `atproto.ts:104` until B5.
- `README.md` project structure (lines 204-221): stale.
- `docs/SEO.md:61`: it documents `src/utils/seo-helpers.ts` as live, but no
  production code calls it. It also uses emoji headings and gives scores with no
  measurement behind them.
- `docs/ADMIN_DESIGN.md` and `docs/rss-feed-aggregation.md`: they describe
  features and tasks that do not exist (`admin:setup`, `content/feeds.json`).
  Mark them as unimplemented proposals (D6).
- After T1: remove the `jsx.d.ts` reference from any doc.

## 7. Additional re-basing tasks

- R1 Import map: add `@std/fs` and use bare specifiers in
  `static-builder.ts:9`, `ports/writer.ts:4-5`, and `scripts/`. Pin
  `@std/assert` in the 4 tests that import it unpinned. Remove the unused
  `@std/http` entry. Check whether `@srdjan/hsx` is needed before removal.
- R2 Lint: fix the other 10 problems (unused `ok`/`err`, 4 `require-await`,
  `prefer-const`, unused `publicUrl` in `atproto/mapping.ts:22`). Read
  `publicUrl` first: it can be a dropped feature rather than dead code.
  Extend `lint.include` to `tests/` and `scripts/` after a measured run.
- R3 Commit `scripts/measure.ts` and a `deno task metrics`.
- R4 `deno task check` checks only `main.ts`. Change it to `src/app/*.ts` and
  `tests/`.
- R5 `deno task coverage` uses `--allow-none`, which is probably not a valid
  flag. Fix it to `--allow-read --allow-write --allow-env`.
- R6 `deno task setup` downloads unpinned htmx from unpkg. The committed file
  is htmx 1.9.10. Pin the URL. A move to htmx 2 or 4 is a separate project.
- R7 `.githooks/pre-push` runs unpinned `jsr:@srdjan/bluesky-bot` with
  `--allow-run --allow-write`. Pin it to the import-map version.

## 8. Phased plan

Each phase is one or more commits. Verification for every phase:
`deno task check && deno task lint && deno task test`, then
`deno task metrics` once R3 exists. Record the metrics after each phase in
this file.

- **Phase 0, bugs (behavior changes, need D1-D3).** B1, B2 (with Q2), B4 (with
  a route test from Q1), B3 if D3 is "hide". Expected: 0 failing tests;
  `_site/` names stable after two builds.
  Result (2026-10-18, commits `675f793` to `f5d215b`): done. 255 passed,
  0 failed, 6 ignored. `src/` 6520 LOC and 903 branches (+79 LOC, +25
  branches from the port methods, the outcome type, and the htmx rule).
  Branch coverage 81.4%; line coverage 64.8%. The line figure is lower
  because `routes.tsx` and `Layout.tsx` now enter the report (routes.tsx
  32.8% lines). Lint: 11 problems. htmx checker: 0 issues. Checked over
  HTTP against a production server: fragment rule, history-restore full
  page, `Vary`, cache hit, escaped search query, 404. Not checked: browser
  behavior of back/forward, scroll restore, and listener re-binding.
- **Phase 1, dead code and tooling.** T1, M1, M2, M3, M11, R1, R2, R3, R4, R5.
  Expected: 0 lint problems; LOC and branches drop (measure); function coverage
  of `result.ts` and `middleware.ts` rises.
  Result (2026-10-18, commits `312f3d4` to `167b760`): done. 251 passed,
  0 failed, 6 ignored (the 4 deleted tests covered deleted middleware).
  `deno task metrics`: 6101 LOC and 836 branches (from 6520 and 903).
  `deno lint` on `src/`: 0 problems. `deno lint tests/ scripts/`: 86
  problems (76 `require-await`, 9 `no-unused-vars`, 1 `no-explicit-any`),
  left for Phase 2. HTTP smoke checks unchanged. `deno task build`: 187
  pages, 133 fragments, 0 errors; each asset has one hash and the HTML
  references the new names.
- **Phase 2, test net.** Q1, Q3-Q10. Expected: `routes.tsx` and `Layout.tsx`
  appear in the coverage report; 0 ignored tests; no test over 1 s.
  Result (2026-10-18, commits `4df4be4` to `c4ecd14`): done except one
  step. 342 passed, 0 failed, 0 ignored; slowest test 163 ms. Lint 0 on
  `src/`, `tests/`, `scripts/`. Coverage: all files 84.1% branches, 90.0%
  lines; `routes.tsx` 96.8% lines, `Layout.tsx` 98.9%, `middleware.ts`
  74.5%, `content.ts` 83.6%, `validation.ts` 82.4%,
  `markdown-renderer.tsx` 86.8%. No change under `src/` or `public/`.
  Mutation check: removing the search escape and the draft filter each made
  a test fail. Open: the auto-mode permission check denied deleting
  `tests/test-api.js` and `tests/curl-test.sh`; the user decides.
- **Phase 3, mechanical rederive.** M4 with T2, M5, M6, M7, M9, M10, M12.
  Expected: `validation.ts` maxCC at or below 15; `content.ts` branches drop
  (measure).
  Result (2026-10-18, commits `b52b882` to `8619d68`, Part A and Phase 3b):
  done. 348 passed, 0 failed, 0 ignored; lint 0. `deno task metrics`: 6070
  LOC, 808 branches (from 6101 and 836). `validateFrontmatter` maxCC 11
  (was 54); the file row shows 16 from the untouched
  `validateMarkdownContent`. Part A edited no existing test. Fixed: B6,
  B8, B9, B10, B11 (frontmatter now parsed with the YAML core schema, so
  impossible dates reach validation). B7 closed as intended. M12
  cancelled. New finding B12: the static builder writes `response.text()`
  without a status check, so a content error in a build would write error
  text into a `.svg` file. Build: 187 pages, 0 errors; HTTP smoke checks
  unchanged; gzip of the home page works.
- **Phase 4, HTTP rederive.** T3, T4, T5 (absorbs M8 and B4), T7. Contract for
  `createRouteHandlers`: the same 16 routes, the same status codes and
  headers as the Phase 2 characterization tests record, and HTMX requests get
  a fragment with `Vary: HX-Request`.
- **Phase 5, ports.** B5, T6, T8, and the remaining items of section 5.
- **Phase 6, docs.** Section 6 and the `CLAUDE.md` fixes.

## 9. What not to touch

- `http/router.ts`, `rss.ts`, `og-image.ts`, `utils/seo-helpers.ts`,
  `utils/reading-time.ts` internals: 100% coverage and small.
- `ports/cache.ts` `CacheError` as one string literal: a change touches every
  caller for no behavior gain.
- `utils.ts` `escapeHtml` and the `render-vnode.ts` copy: they emit `&#039;`
  and `&#39;`. A merge changes output bytes.
- The view-count stale-while-revalidate behavior: it is a real feature. Move
  it (section 5), do not delete it.
- htmx 1.9.10 to a newer major: out of scope.

## Decisions (answered 2026-10-18)

The user chose option (a) for D1 to D6 and approved Phase 0. For D2 the user
also chose to upgrade htmx from 1.9.10 to 4.0.0, because htmx 1.9 does not
swap 5xx responses and htmx 4 does. The Phase 0 spec is
`docs/plans/2026-10-18-phase-0-spec.md`. It replaces the B2 idea "skip names
that already carry a hash": `build()` cleans the output directory first, so
the repeated hashes come only from the tests' disk leak.

- D1 B1 search escaping: (a) fix now in Phase 0 (recommended), (b) defer.
- D2 B4 error caching: (a) error pages return 500 (recommended), (b) keep
  200 and skip the cache for errors, (c) leave as is.
- D3 B3 drafts: (a) hide `draft: true` posts from all lists, feeds, the
  sitemap, and the build (recommended), (b) remove `draft` from validation.
- D4 Tests-only code (`seo-helpers.ts`, `reading-time.ts`, mermaid helpers):
  (a) keep (recommended), (b) delete with their tests and `docs/SEO.md`.
- D5 Ignored audio and image-attribute tests: (a) delete them if the
  renderer has no such feature (recommended), (b) build the feature.
- D6 `ADMIN_DESIGN.md` and `rss-feed-aggregation.md`: (a) mark as proposals
  (recommended), (b) delete.
