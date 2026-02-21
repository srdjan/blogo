# RSS Feed Aggregation for Blogo

## Context

Blogo is a Deno blog engine using server-side JSX (hsx), HTMX navigation, manual DI via factory functions, and Result types for error handling. The user wants to subscribe to external RSS feeds and display aggregated content on a dedicated "/reads" page, cleanly separated from original blog posts. External content must not leak into search, the blog's own RSS output, the sitemap, or analytics.

## Design Decisions

- Route: `/reads` (reading list framing, distinct from `/rss` which serves the blog's own feed)
- XML parsing: zero-dependency string parser (~80-100 lines) handling RSS 2.0 and Atom
- Static build: fetches feeds at build time so the static site has real content
- Feed management: `content/feeds.json` config file only, no admin UI

---

## New Files

```
src/ports/http-client.ts           HttpClient port + Deno fetch implementation
src/domain/feeds.ts                Domain types: FeedSubscription, FeedItem, FeedState, FeedError
src/domain/feed-parser.ts          Pure function: parseFeedXml() for RSS 2.0 + Atom
src/domain/feed-service.ts         FeedService interface + createFeedService factory
src/components/FeedList.tsx         /reads page component
content/feeds.json                 Feed subscription config (starts with a few example feeds)
tests/domain/feed_parser_test.ts   Parser unit tests
tests/domain/feed_service_test.ts  Service tests with mock HttpClient + mock FileSystem
```

## Modified Files

```
src/lib/types.ts                   Add FeedId branded type
src/domain/config.ts               Add FeedConfig to BlogConfig
src/http/routes.tsx                 Add reads + feedRefresh handlers, FeedService param
src/components/Layout.tsx           Add "Reads" nav item between RSS and About
src/domain/static-builder.ts       Add /reads to routeEntries
src/app/main.ts                    Wire FeedService, periodic refresh, feeds.json watcher
src/app/build.ts                   Wire FeedService with real HttpClient for build-time fetch
public/css/main.css                Minimal .feed-source and .feed-meta styles
```

---

## Step 1: Domain Types

**`src/lib/types.ts`** - add `FeedId` branded type:

```typescript
export type FeedId = Brand<string, "FeedId">;
export const createFeedId = (value: string): AppResult<FeedId> => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return err(createError("ValidationError", "Feed ID cannot be empty"));
  return ok(trimmed as FeedId);
};
```

**`src/domain/feeds.ts`** - domain entities:

```typescript
type FeedSubscription = {
  readonly id: FeedId;
  readonly name: string;
  readonly url: string;
  readonly siteUrl?: string;
  readonly category?: string;
};

type FeedItem = {
  readonly feedId: FeedId;
  readonly feedName: string;
  readonly title: string;
  readonly link: string;
  readonly pubDate: Date;
  readonly description?: string;
  readonly author?: string;
};

type FeedState = {
  readonly subscriptions: readonly FeedSubscription[];
  readonly items: readonly FeedItem[];
  readonly lastRefreshed: Date | null;
  readonly errors: readonly FeedError[];
};

type FeedError = {
  readonly feedId: FeedId;
  readonly feedName: string;
  readonly message: string;
  readonly timestamp: Date;
};

type FeedsConfig = {
  readonly refreshIntervalMinutes: number;
  readonly feeds: readonly FeedSubscription[];
};
```

## Step 2: HttpClient Port

**`src/ports/http-client.ts`** - injection seam for network access:

```typescript
interface HttpClient {
  readonly fetchText: (url: string, options?: { readonly timeoutMs?: number }) => Promise<AppResult<string>>;
}
```

Production implementation wraps `fetch()` with 15s timeout, User-Agent header, and AppResult error wrapping (NetworkError kind). Tests provide a mock returning canned XML strings.

## Step 3: Feed Parser

**`src/domain/feed-parser.ts`** - pure function, zero dependencies:

```typescript
const parseFeedXml = (xml: string, feedId: FeedId, feedName: string): AppResult<readonly FeedItem[]>
```

Handles two formats:
- RSS 2.0: extracts `<item>` elements with `<title>`, `<link>`, `<pubDate>`, `<description>`, `<author>`
- Atom: extracts `<entry>` elements with `<title>`, `<link href="...">`, `<published>`/`<updated>`, `<summary>`/`<content>`, `<author><name>`

Auto-detects format by checking for `<feed` (Atom) vs `<rss` or `<channel>` (RSS). Returns ParseError for unrecognizable XML. Uses regex/string extraction on the predictable tag structure - no DOM parser needed.

## Step 4: Feed Service

**`src/domain/feed-service.ts`** - follows createContentService pattern exactly:

```typescript
interface FeedService {
  readonly getFeeds: () => Promise<AppResult<FeedState>>;
  readonly refreshFeeds: () => Promise<AppResult<FeedState>>;
}

type FeedServiceDependencies = {
  readonly fileSystem: FileSystem;
  readonly httpClient: HttpClient;
  readonly logger: Logger;
  readonly cache: Cache<FeedState>;
  readonly feedsConfigPath: string;
};
```

Key behaviors:
- `getFeeds()`: returns cached FeedState if available, otherwise calls `refreshFeeds()`
- `refreshFeeds()`: loads config from `feeds.json` via FileSystem port, fetches all feeds concurrently with `Promise.allSettled`, records per-feed errors without blocking others, merges + deduplicates items by link URL, sorts by pubDate descending, caps at 100 items, caches result with Infinity TTL
- Graceful degradation: if `feeds.json` doesn't exist, returns empty FeedState

## Step 5: Config

**`src/domain/config.ts`** - add to BlogConfig:

```typescript
type FeedConfig = {
  readonly feedsConfigPath: string;
  readonly refreshIntervalMinutes: number;
};
```

Read from env vars `FEEDS_CONFIG` (default: `"content/feeds.json"`) and `FEED_REFRESH_MINUTES` (default: `30`).

**`content/feeds.json`** - starter config with 2-3 example feeds.

## Step 6: FeedList Component

**`src/components/FeedList.tsx`** - renders the /reads page:

- Header: "Reads" with subtitle and last-refreshed timestamp
- Error notice if any feeds failed (non-blocking, informational)
- List of feed items reusing `.post-list` and `.post-card` CSS classes for visual consistency
- Each item: title as external link (`target="_blank"`, `rel="noopener noreferrer"`), source name, date, description excerpt
- External links do NOT use HTMX attributes (they leave the site)

## Step 7: Routes

**`src/http/routes.tsx`**:

- Add `FeedService` as a new parameter to `createRouteHandlers()` (after `analyticsService`, before `atConfig`)
- Add `reads` handler: calls `feedService.getFeeds()`, renders `<FeedList>` with `robots: "noindex, nofollow"`
- Add `feedRefresh` handler: POST endpoint returning JSON status (for manual curl/script triggering)
- Both added to `RouteHandlers` type
- The `reads` handler uses `cachedRender` like other HTML pages

## Step 8: Navigation

**`src/components/Layout.tsx`** - add "Reads" nav item between RSS and About, following the exact same HTMX pattern:

```tsx
<li>
  <a href="/reads" {...(path === "/reads" && { "aria-current": "page" })}
     get="/reads" target="#content-area" swap="innerHTML" pushUrl="true">
    Reads
  </a>
</li>
```

## Step 9: Composition Root (main.ts)

Wire in this order:
1. Create `httpClient = createHttpClient()`
2. Create `feedCache = createInMemoryCache<FeedState>()`
3. Create `feedService = createFeedService({ fileSystem, httpClient, logger, cache: feedCache, feedsConfigPath: config.blog.feeds.feedsConfigPath })`
4. Pass `feedService` to `createRouteHandlers()`
5. Register routes: `.get("/reads", routes.reads)` and `.post("/api/feeds/refresh", routes.feedRefresh)` (router already has `.post()` method)
6. After server starts: fire-and-forget `feedService.refreshFeeds()`
7. Set up `setInterval` for periodic refresh (configurable interval, default 30 min)
8. Watch `feeds.json` with `Deno.watchFs` (production only) - clear feed cache and refresh on change
9. Add `clearInterval(feedRefreshInterval)` to shutdown handler

## Step 10: Static Build (build.ts)

- Create real `HttpClient` (needs `--allow-net`, already in deno.json)
- Create `FeedService` with real http client
- Call `feedService.refreshFeeds()` before building to populate cache
- Pass `feedService` to `createRouteHandlers()`

**`src/domain/static-builder.ts`** - add to routeEntries:

```typescript
{ path: "/reads", handler: routes.reads, html: true },
```

## Step 11: CSS

Add minimal styles to `public/css/main.css`:
- `.feed-source` - muted text for attribution (feed name)
- `.feed-meta` - metadata line styling
- External link indicator (subtle icon or styling for links that leave the site)

---

## What is NOT touched

- Search: `contentService.searchPosts()` is unmodified; feed items are not searchable
- Blog RSS output: `src/rss.ts` is unmodified; only blog posts appear in `/feed.xml`
- Sitemap: `src/sitemap.ts` is unmodified; only blog posts appear in `/sitemap.xml`
- Analytics: no view counting for feed items (they link externally)

---

## Implementation Order

1. Types (`types.ts` + `feeds.ts`)
2. HttpClient port (`http-client.ts`)
3. Feed parser + tests (`feed-parser.ts` + `feed_parser_test.ts`)
4. Feed service + tests (`feed-service.ts` + `feed_service_test.ts`)
5. Config update (`config.ts` + `feeds.json`)
6. Component (`FeedList.tsx`)
7. Routes update (`routes.tsx`)
8. Navigation update (`Layout.tsx`)
9. Main wiring (`main.ts`)
10. Static build wiring (`build.ts` + `static-builder.ts`)
11. CSS (`main.css`)

## Verification

1. `deno task test` - all existing tests pass, new parser + service tests pass
2. `deno task dev` - start dev server, navigate to `/reads`, verify feed items display
3. Verify HTMX navigation works (clicking "Reads" in nav swaps content without full reload)
4. Edit `content/feeds.json`, verify file watcher triggers refresh
5. `curl -X POST http://localhost:8000/api/feeds/refresh` - verify manual refresh returns JSON status
6. `deno task build` - verify `/reads/index.html` and `/reads/fragment.html` are generated with real content
7. Verify `/feed.xml`, `/sitemap.xml`, and `/search` do NOT include feed items
8. `deno task check` - type checking passes
9. `deno task lint` - no lint errors
