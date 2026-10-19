# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
deno task dev                # Development server with hot reload (port 8000)
deno task start              # Server without hot reload
deno task build              # Build the static site into _site/
deno task test               # Run all tests
deno task test:watch         # Run tests on file change
deno task smoke              # Fast smoke tests (run by the pre-commit hook)
deno task check              # Type check src/, tests/, and scripts/
deno task lint               # Lint src/, tests/, and scripts/
deno task fmt                # Format code
deno task metrics            # Per-module LOC, branch count, and fan-in for src/
deno task coverage           # Run tests with coverage and print the report
deno task frontmatter:check  # Validate the frontmatter of every post
deno task at:publish         # Publish posts to AT Protocol
deno task at:pull            # Pull documents from AT Protocol into content/posts/
deno task at:verify          # Check the AT Protocol configuration
deno task setup              # Create public/ and content/posts/ and download htmx
deno task hooks:install      # Enable pre-commit and pre-push hooks
```

The pre-commit hook in `.githooks/pre-commit` runs `frontmatter:check` and `smoke`.

Run a single test file:
```bash
deno test --allow-read --allow-write --allow-env tests/result_test.ts
```

## Architecture

This is a Deno blog. It uses hsx (server-side JSX without React) and htmx 4 for client interactivity.

### Layer Structure

```
src/app/                   Entry points: main.ts (server), build.ts, at-publish.ts, at-pull.ts, at-verify.ts
src/http/                  HTTP layer: routes.tsx, router.ts, middleware.ts, server.ts, types.ts, view.ts, render-vnode.ts
src/components/            JSX components (Layout.tsx, PostView.tsx, etc.)
src/domain/                Business logic: content.ts, health.ts, analytics.ts, atproto.ts,
                           config.ts, static-builder.ts, validation.ts
src/ports/                 Dependency interfaces: file-system.ts, writer.ts, cache.ts, logger.ts,
                           clock.ts, kv.ts, atproto.ts
src/atproto/               AT Protocol record types and mapping (mapping.ts, types.ts)
src/config/                Static settings: atproto.ts (AT Protocol environment), topics.ts
src/lib/                   Core utilities: result.ts, types.ts, error.ts
src/utils/                 Tested helpers that no page uses yet: reading-time.ts, seo-helpers.ts
src/utils.ts               Shared string helpers
src/markdown-renderer.tsx  Markdown to HTML with marked and highlight.js
src/mermaid-renderer.ts    Mermaid diagrams to SVG
src/rss.ts                 RSS feed generation
src/sitemap.ts             Sitemap and robots.txt generation
src/og-image.ts            Open Graph SVG images
```

### Key Patterns

**Result Types for Errors**: Use `Result<T, E>` from `src/lib/result.ts` instead of exceptions. Pattern match with `match()`, chain with `chain()` and `map()`.

```typescript
const result = await contentService.loadPosts();
return match(result, {
  ok: (posts) => renderPage(posts),
  error: (err) => renderError(err),
});
```

**Branded Types**: Domain types like `Slug`, `TagName`, `UrlPath` are branded strings for type safety. Create them with factory functions: `createSlug()`, `createTagName()`.

**Ports Pattern for DI**: Services define interfaces. Factory functions receive the implementations.

```typescript
export const createContentService = (deps: ContentDependencies): ContentService => {
  const { fileSystem, logger, cache } = deps;
  // ...
};
```

**JSX with hsx**: Components use JSX that renders to HTML strings on the server. Use `html()` from `render-vnode.ts` to render raw HTML content (like markdown).

**View type**: A route handler returns a `View` (defined in `src/http/view.ts`). A `View` is a tagged union with the kinds `page`, `fragment`, `text`, `xml`, `svg`, and `json`. The function `toResponse(view, ctx, deps)` turns a `View` into a `Response` and handles each kind in an exhaustive `switch`.

**htmx 4**: The server sends a fragment only when `HX-Request` is `true` and `HX-Request-Type` is not `full`. Otherwise the server sends the whole page. The check is `isHtmxRequest` in `src/http/view.ts`. The static builder writes `fragment.html` next to each page for the same reason.

**Configuration**: `parseConfig(env)` in `src/domain/config.ts` is a pure function. `createConfig()` calls it once with `Deno.env.toObject()`. The AT Protocol settings are the exception: `src/config/atproto.ts` reads them from the environment.

**Drafts**: A post with `draft: true` is hidden everywhere. The listing, tag, search, feed, and sitemap data never include it. `getPostBySlug()` returns `NotFound` for a draft. AT Protocol publishing skips it.

**Frontmatter**: `parseFrontmatter()` in `src/domain/content.ts` parses YAML with the `core` schema, so dates stay strings. Then `validateFrontmatter()` in `src/domain/validation.ts` checks the fields. The AT Protocol service uses the same parser.

### Testing

Tests use simple in-memory doubles, not mocking frameworks. The shared doubles are in `tests/helpers/`:

- `createMemoryFileSystem(files, options)` in `file_system.ts`
- `createRecordingLogger()` in `logger.ts`
- `createMemoryContentService(posts, overrides)` in `content_service.ts`
- `createMemoryHealthService(options)` in `health_service.ts`

A test builds a double from a plain object and passes it to a service factory:

```typescript
const fileSystem = createMemoryFileSystem({
  "content/posts/hello.md": "---\ntitle: Hello\ndate: 2025-01-15\n---\n\nBody",
});
const service = createContentService({
  fileSystem,
  logger: createRecordingLogger(),
  cache: createInMemoryCache(),
  metadataCache: createInMemoryCache(),
  postCache: createInMemoryCache(),
  postsDir: "content/posts",
  enableValidation: false,
});
```

The static builder test keeps its own local `FileWriter` double in `tests/domain/static_builder_test.ts`.

## Content

Blog posts are markdown files in `content/posts/` with YAML frontmatter:

```yaml
---
title: Post Title
date: 2025-01-15
tags: [Tag1, Tag2]
excerpt: Brief description
modified: 2025-01-16  # Optional
draft: true           # Optional: hides the post
---
```

Use the `gotai:blog-writer` skill to write posts in the blog's voice.

## Performance

The content service uses a multi-tier caching strategy:

- `cache`: All posts (for listing pages)
- `metadataCache`: Post metadata only (for home page)
- `postCache`: Individual posts by slug (for single post views)

**Key optimizations**:
- `getPostBySlug()` reads one file directly instead of loading all posts
- The view count increment does not block the response
- Mermaid diagrams are cached by content hash in `mermaid-renderer.ts`
- YAML parsing uses a static import (not dynamic)
