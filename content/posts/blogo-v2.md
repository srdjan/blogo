---
title: "Blogo v2: Static Builds, AT Protocol, and Zero Client-Side Frameworks"
date: 2026-02-15
tags: [hsx, Deno, HTMX, AT Protocol, Web Development]
excerpt: Blogo v2 adds static site generation and AT Protocol publishing to a blog built entirely with server-side JSX. No React, no Next.js, no hydration - just HTML that works.
---

I shipped the entire blog you're reading right now without a single client-side JavaScript framework. No React. No Vue. No Svelte. The browser receives HTML. Pure, rendered, ready-to-display HTML.

v2 adds two features I've been wanting for a while: static site generation and AT Protocol integration. But the real story is still the foundation - hsx, a server-side JSX runtime that gives you React's developer experience while shipping zero JavaScript to the browser for rendering. Let me walk you through how it all fits together.

## What is hsx?

hsx is a server-side JSX runtime for Deno. You write components with familiar JSX syntax, and they render to HTML strings on the server. That's it. No virtual DOM diffing, no hydration step, no bundle to optimize.

```tsx
const PostCard = ({ title, excerpt }: Props) => (
  <article class="post-card">
    <h2>{title}</h2>
    <p>{excerpt}</p>
  </article>
);

const html = renderVNode(<PostCard title="Hello" excerpt="World" />);
// Output: <article class="post-card"><h2>Hello</h2><p>World</p></article>
```

Components return VNodes (virtual DOM nodes). The `renderVNode()` function recursively walks the tree and produces HTML strings. For pre-rendered content like markdown, the `html()` helper bypasses escaping:

```tsx
import { html } from "./render-vnode.ts";

const PostContent = ({ content }: { content: string }) => (
  <div class="prose">
    {html(content)}
  </div>
);
```

The browser never sees JavaScript instructions to build DOM. It receives the finished HTML document. Every page load is fast because there's nothing to parse, compile, or execute on the client.

## Why This Matters

Modern web development has become absurdly complex. React alone ships around 40KB minified, and that's before your application code. Then you need a meta-framework for SSR, a bundler, a build step, hydration logic, and state management. For what? To render HTML.

hsx takes a different path:

- **Zero client-side JavaScript for rendering** - the browser gets HTML, ready to display
- **Familiar JSX syntax** - write components exactly like React, minus useState/useEffect
- **Server-side composition** - components compose where your data actually lives
- **Full TypeScript support** - proper JSX types, branded domain types, Result error handling
- **HTMX synergy** - semantic aliases make HTMX feel native to JSX

To me is interesting that you can build a full production blog - markdown rendering, search, tag filtering, RSS feeds, SEO optimization, syntax highlighting, Mermaid diagrams - without shipping a framework to the browser.

## hsx + HTMX: The Architecture

Here's the cool part. hsx handles initial rendering. HTMX handles dynamic updates. Together they create SPA-like navigation without client-side routing:

```tsx
<a
  href="/posts"
  get="/posts"          // Maps to hx-get
  target="#content"     // Maps to hx-target
  swap="innerHTML"      // Maps to hx-swap
  pushUrl="true"        // Maps to hx-push-url
>
  Load Posts
</a>
```

hsx provides semantic aliases for HTMX attributes, so the JSX reads naturally. Click that link and HTMX fetches the HTML fragment from `/posts`, swaps it into `#content`, and updates the browser URL. No full page reload. No client-side router. The server renders the fragment, HTMX drops it in.

The result feels like a SPA but works without JavaScript. Progressive enhancement, not progressive complexity. If JavaScript fails to load, the regular `href` still works. Every page has a real URL. Search engines see real HTML.

## v2: Static Site Generation

`deno task build` renders every route into a `_site/` directory. Pages, HTMX fragments, RSS feeds, sitemaps, Open Graph images - everything.

The static builder synthesizes request contexts for each route and calls the same route handlers the server uses:

```typescript
const builder = createStaticBuilder({
  contentService,
  routes,
  fileWriter,
  logger,
  publicDir: "public",
});

const result = await builder.build({
  outputDir: "_site",
  baseUrl: "https://blogo.timok.com",
});
// Build complete: 98 pages, 42 fragments
```

Here's the trick that makes HTMX work with static files. For every HTML route, the builder generates both a full page (`index.html`) and an HTMX fragment (`fragment.html`). Then it rewrites `hx-get` URLs to point at the fragment files:

```
_site/
  index.html              # Full page: /
  fragment.html           # HTMX fragment: /
  posts/
    my-post/
      index.html          # Full page: /posts/my-post
      fragment.html       # HTMX fragment
  tags/
    TypeScript/
      index.html
      fragment.html
  feed.xml
  sitemap.xml
  robots.txt
```

Navigate directly to a URL? You get the full page. Click a link with HTMX? It fetches the fragment. Same content, two delivery modes. Deploy to any static host - Netlify, Cloudflare Pages, S3, wherever.

## v2: AT Protocol Integration

This is the feature that excited me most. Blogo can now publish your posts as `site.standard.document` records on any AT Protocol Personal Data Server. Your content lives on the decentralized network, not just your web server.

The integration uses the Standard.site lexicon - a set of schemas for publishing web content to the AT Protocol. Two record types matter:

- `site.standard.publication` - represents your blog as a whole (name, URL, description)
- `site.standard.document` - represents individual posts (title, content, tags, dates)

Publishing is one command:

```bash
deno task at:publish
# Published: 43, Skipped: 0, Errors: 0
```

Each post gets stored with its raw markdown content, metadata, and a path back to the rendered version on your website. AT Protocol clients that understand Standard.site can render the content however they choose.

### How It Works Under the Hood

The AT Protocol client is a thin wrapper around `fetch()`. No SDK dependency. The XRPC protocol is straightforward HTTP: authenticate with `com.atproto.server.createSession` to get a JWT, then use it for subsequent calls:

```typescript
export const createAtProtoClient = async (
  config: AtProtoConfig,
): Promise<AppResult<AtProtoClient>> => {
  const sessionResult = await tryCatch(
    async () => {
      const res = await fetch(
        `${config.service}/xrpc/com.atproto.server.createSession`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: config.handle,
            password: config.appPassword,
          }),
        },
      );
      return (await res.json()) as Session;
    },
    (e) => createError("NetworkError", "Failed to authenticate with PDS", e),
  );
  // ... wrap XRPC calls with the session JWT
};
```

Posts map bidirectionally between local markdown files and AT Protocol records. The `postToDocument` function converts a post to a `StandardDocument`, and `documentToMarkdown` converts back:

```typescript
const doc = postToDocument({
  post,
  rawMarkdown: markdown,
  publicationUri,
  publicUrl,
});
```

Content is stored as raw markdown, not HTML. Maximum portability.

### Verification

Two mechanisms link your website to your PDS identity. First, a well-known endpoint:

```
GET /.well-known/site.standard.publication
→ at://did:plc:abcdef123456/site.standard.publication/self
```

Second, each post page includes a link tag in the HTML head:

```html
<link rel="site.standard.document"
      href="at://did:plc:abcdef123456/site.standard.document/my-post">
```

Standard.site clients can verify that the website and the PDS account belong to the same person. `deno task at:verify` checks both mechanisms.

### Pulling Content Back

The reverse direction works too. `deno task at:pull` downloads all documents from your PDS and writes them as markdown files with YAML frontmatter:

```bash
deno task at:pull
# Pulled: 43, Skipped: 0, Errors: 0
```

Useful for syncing across machines, recovering lost files, or importing content published from a different client. Everything is opt-in - if you never set the environment variables, the blog works exactly as before.

## The Architecture

The project follows a ports-and-adapters pattern with dependency injection through factory functions:

```
src/
  app/          # Entry points (server, build, AT Protocol CLIs)
  http/         # Routes, server, middleware
  components/   # JSX components (Layout, PostView, TagCloud...)
  domain/       # Business logic (content, atproto, static-builder)
  atproto/      # Standard.site lexicon types and mapping
  config/       # Configuration
  ports/        # Dependency interfaces (filesystem, cache, atproto, writer)
  lib/          # Core utilities (Result types, branded types, errors)
```

Services define their dependencies as interfaces. Implementations get injected:

```typescript
export const createContentService = (deps: ContentDependencies): ContentService => {
  const { fileSystem, logger, cache, metadataCache, postCache, postsDir } = deps;
  // ...
};
```

Error handling uses `Result<T, E>` types throughout - no exceptions for expected failures. Pattern match on the result, chain operations, map over values. Domain errors are data, not control flow.

Tests use simple in-memory implementations. No mocking frameworks, no complex setup. A mock file system is a plain object mapping paths to strings.

## Real Talk: Tradeoffs

Where this shines: content-heavy sites where pages are mostly static HTML with occasional dynamic bits. Blogs, documentation, marketing sites, portfolios. The rendering model is simple, the output is fast, and the architecture stays clean.

Where it falls short: highly interactive applications with complex client-side state. If you need real-time collaboration, drag-and-drop, or rich form validation, you need client-side JavaScript. hsx won't help there.

HTMX covers a surprising amount of middle ground - search, filtering, pagination, modal dialogs - but it depends of server roundtrips for every interaction. On slow connections, the UX degrades. For most content sites this is fine. For a trading dashboard, probably not.

The AT Protocol integration is young. The Standard.site lexicon is still evolving. Client support is limited. But the idea is sound - your content on a decentralized network, under your control, portable between platforms.

## What's Next

The blog is live at [blogo.timok.com](https://blogo.timok.com). The source is on [GitHub](https://github.com/srdjan/blogo). Fork it, deploy it, make it yours.

I've been running this setup for months now and the development experience is genuinely pleasant. No build tool configuration, no dependency hell, no framework churn. Write a JSX component, refresh the browser, see HTML. There is something refreshing about that simplicity.

If you're building a content site and wondering whether you really need React, the answer might be no. hsx, HTMX, and a good server runtime can take you surprisingly far.
