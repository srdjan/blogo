# <img src="public/images/blogo-logo.png" alt="Blogo Logo" width="60"> Blogo: A Showcase for hsx

**Blogo** is a production-ready blog that demonstrates what you can build with
[hsx](https://github.com/srdjan/hsx), a server-side JSX runtime for Deno. It
proves you don't need React, Next.js, or any client-side framework to build
fast, modern web applications.

v2 adds static site generation and AT Protocol integration, giving you
decentralized content ownership through the Standard.site lexicon.

> **See it live:** [blogo.timok.com](https://blogo.timok.com/)

## What is hsx?

**hsx** is a server-side JSX runtime that gives you React's developer experience
without shipping JavaScript to the browser. Write JSX components, get HTML
strings. Zero client-side rendering. Zero hydration. Zero bundle.

```tsx
// This is hsx, not React
const PostCard = ({ title, excerpt }: Props) => (
  <article class="post-card">
    <h2>{title}</h2>
    <p>{excerpt}</p>
  </article>
);

// Renders to pure HTML string on the server
const html = renderVNode(<PostCard title="Hello" excerpt="World" />);
// Output: <article class="post-card"><h2>Hello</h2><p>World</p></article>
```

The browser receives HTML. Not JavaScript instructions to build HTML. Just HTML.

## Why hsx Matters

Modern web development has become absurdly complex. React alone ships ~40KB
minified, and that's before your app code. Then you need a meta-framework for
SSR, a bundler, a build step, hydration logic, and state management. For what?
To render HTML.

hsx takes a different path:

1. **Zero client-side JavaScript for rendering** - The browser receives HTML,
   ready to display
2. **Familiar JSX syntax** - Write components exactly like React, minus
   useState/useEffect complexity
3. **Server-side composition** - Components compose where your data lives
4. **Type safety** - Full TypeScript support with proper JSX types
5. **HTMX synergy** - Semantic aliases make HTMX feel native to JSX

## hsx + HTMX: The Architecture

Blogo demonstrates how hsx and HTMX work together. hsx renders the initial HTML,
HTMX handles dynamic updates without page reloads:

```tsx
// hsx provides semantic aliases for HTMX attributes
<a
  href="/posts"
  get="/posts" // Maps to hx-get
  target="#content" // Maps to hx-target
  swap="innerHTML" // Maps to hx-swap
  pushUrl="true" // Maps to hx-push-url
>
  Load Posts
</a>;
```

The result feels like a SPA but works without JavaScript. Progressive
enhancement, not progressive complexity.

## hsx Rendering Pipeline

Components return VNodes (virtual DOM nodes). The `renderVNode()` function
recursively converts them to HTML strings:

```tsx
// Component tree
const Page = () => (
  <Layout title="Home">
    <PostList posts={posts} />
  </Layout>
);

// Convert to HTML
const htmlString = renderVNode(<Page />);

// For pre-rendered HTML (like markdown), bypass escaping
import { html } from "./render-vnode.ts";
{
  html(post.content);
} // Renders as-is
```

## What Blogo Demonstrates

This blog showcases hsx capabilities in a real application:

- **Server-side JSX components** - Layout, PostView, PostList, TagCloud,
  SearchResults
- **HTMX integration** - SPA-like navigation without client-side routing
- **Markdown rendering** - Using `html()` for safe raw HTML injection
- **Dynamic content** - Search, filtering, pagination via HTMX partial updates
- **Progressive enhancement** - Works fully without JavaScript, enhanced with
  HTMX

### Blog Features

- Markdown posts with YAML frontmatter
- Tag-based categorization and filtering
- Full-text search with modal and results page
- Light/dark theme toggle
- Syntax highlighting with Highlight.js
- Mermaid diagram support
- RSS feeds
- SEO optimization with structured data
- Static site generation (`deno task build`)
- AT Protocol publishing via Standard.site lexicon

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) v2.x or higher

### Quick Start

```bash
# Clone and setup
git clone https://github.com/srdjan/blogo.git
cd blogo
deno task setup

# Start development server
deno task dev
```

Open `http://localhost:8000`

### Commands

```bash
deno task dev          # Development server with hot reload
deno task start        # Production server
deno task build        # Generate static site to _site/
deno task test         # Run tests
deno task check        # Type check
deno task fmt          # Format code
deno task lint         # Lint code
```

### AT Protocol Commands

These require AT Protocol credentials (see [docs/pds-guide.md](docs/pds-guide.md)):

```bash
deno task at:publish   # Publish all posts to your PDS
deno task at:pull      # Pull documents from PDS to local markdown
deno task at:verify    # Verify well-known endpoint and link tags
```

## Static Site Generation

`deno task build` renders every route (pages, fragments, feeds, sitemaps) into
a `_site/` directory that can be deployed to any static host. HTMX navigation
continues to work via pre-rendered fragment files.

```bash
deno task build
# Build complete: 98 pages, 42 fragments
```

When AT Protocol environment variables are set at build time, the static output
includes the `.well-known/site.standard.publication` endpoint and per-post
`<link rel="site.standard.document">` tags.

## AT Protocol Integration

Blogo can publish your posts as `site.standard.document` records on any AT
Protocol Personal Data Server. This gives you decentralized ownership of your
content - your posts live on the AT Protocol network alongside the rendered
blog.

The integration is opt-in. Set three environment variables to enable it:

```bash
ATPROTO_DID=did:plc:your-did
ATPROTO_HANDLE=yourhandle.bsky.social
ATPROTO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

With credentials configured, the server exposes a verification endpoint at
`/.well-known/site.standard.publication` and each post page includes a
`<link rel="site.standard.document">` tag linking to the corresponding PDS
record.

See [docs/pds-guide.md](docs/pds-guide.md) for the full setup guide, including
credential setup, publishing, pulling, and verification.

## Project Structure

```
src/
  app/
    main.ts            # Server entry point
    build.ts           # Static site generator
    at-publish.ts      # CLI: publish posts to PDS
    at-pull.ts         # CLI: pull documents from PDS
    at-verify.ts       # CLI: verify AT Protocol setup
  http/                # Routes, server, middleware
    render-vnode.ts    # hsx VNode to HTML renderer
  components/          # JSX components (Layout, PostView, etc.)
  domain/              # Business logic (content, atproto, static-builder)
  atproto/             # Standard.site lexicon types and mapping
  config/              # Configuration (atproto env vars)
  ports/               # Dependency interfaces (filesystem, cache, atproto, writer)
  lib/                 # Core utilities (Result types, etc.)
content/posts/         # Markdown blog posts
public/                # Static assets
docs/                  # Guides (PDS setup)
```

## Creating Content

Add markdown files to `content/posts/`:

```markdown
---
title: Your Post Title
date: 2025-01-15
tags: [Technology, Tutorial]
excerpt: Brief description
---

# Your Content

Write markdown here. Supports code blocks, Mermaid diagrams, images.
```

## Deployment

Blogo deploys to [Deno Deploy](https://deno.com/deploy) with zero configuration:

1. Push to GitHub
2. Connect repository at [dash.deno.com](https://dash.deno.com)
3. Set entry point: `src/app/main.ts`
4. Deploy

Every push to `main` triggers automatic deployment.

Alternatively, generate a static site with `deno task build` and deploy the
`_site/` directory to any static host (Netlify, Cloudflare Pages, S3, etc.).

## Technology Stack

| Layer         | Technology                                                  |
| ------------- | ----------------------------------------------------------- |
| Runtime       | Deno v2.x                                                   |
| Rendering     | [hsx](https://github.com/srdjan/hsx) (server-side JSX)      |
| Interactivity | HTMX v2.x                                                   |
| Styling       | Modern CSS (nesting, container queries, logical properties) |
| Content       | Markdown with marked                                        |
| Syntax        | Highlight.js                                                |
| Diagrams      | @rendermaid/core                                            |
| Protocol      | AT Protocol (Standard.site lexicon)                         |
| Hosting       | Deno Deploy / any static host                               |

## Learn More About hsx

- [hsx on GitHub](https://github.com/srdjan/hsx)
- [hsx on JSR](https://jsr.io/@srdjan/hsx)
- [HTMX Documentation](https://htmx.org/)

---

Built with hsx by Claude, GPT, and Srdjan.

**Fork it, deploy it, make it yours.**

---

## License

MIT
