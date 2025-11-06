# Blogo Admin Panel Design Document

**Version:** 1.0 **Date:** 2025-10-16 **Status:** Design Phase

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Design](#architecture-design)
3. [Storage Layer (Deno KV)](#storage-layer-deno-kv)
4. [Authentication System](#authentication-system)
5. [Editor Integration](#editor-integration)
6. [Routing & Components](#routing--components)
7. [Implementation Plan](#implementation-plan)
8. [Code Examples](#code-examples)
9. [Dependencies](#dependencies)
10. [Risks & Trade-offs](#risks--trade-offs)

---

## Executive Summary

This document outlines the design for adding content editing capabilities to the
Blogo application using the Tiptap rich text editor and a minimal authentication
system. The design maintains Blogo's existing Light Functional Programming
architecture while adding administrative functionality through Deno KV storage.

**Key Design Principles:**

- Preserve existing public-facing blog functionality and architecture
- Maintain Light FP patterns (no classes, Result types, ports for dependencies)
- Keep admin interface minimal and functional
- Ensure backward compatibility with existing Markdown posts
- Use Deno-native technologies (KV, std library, Web APIs)

---

## Architecture Design

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Public Routes│  │ Admin Routes │  │  Auth Routes │  │
│  │ (existing)   │  │   (new)      │  │    (new)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────┐
│                   Middleware Chain                       │
│  - Error Boundary                                        │
│  - Performance Monitoring                                │
│  - Request ID                                            │
│  - Access Log                                            │
│  - Static Files                                          │
│  - Auth Check (NEW - only for /admin/* routes)          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Domain Services                        │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  ContentService  │    │  AdminService    │           │
│  │  (read-only)     │    │  (read-write)    │           │
│  │  - File-based    │    │  - KV-based      │           │
│  │  - Public posts  │    │  - Admin CRUD    │           │
│  └────────┬─────────┘    └────────┬─────────┘           │
│           │                       │                      │
│  ┌────────▼───────────────────────▼─────────┐           │
│  │         AuthService (NEW)                 │           │
│  │  - Session management                     │           │
│  │  - Password verification                  │           │
│  └───────────────────────────────────────────┘           │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Storage Ports                          │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │   FileSystem     │    │    Deno KV       │           │
│  │   (existing)     │    │     (NEW)        │           │
│  └──────────────────┘    └──────────────────┘           │
└──────────────────────────────────────────────────────────┘
```

### Separation of Concerns

**Public Blog (Unchanged):**

- Continues to serve posts from filesystem (`content/posts/*.md`)
- Read-only ContentService with caching
- No authentication required
- Existing routes and components work as-is

**Admin Panel (New):**

- Authenticated section at `/admin/*`
- CRUD operations stored in Deno KV
- Tiptap editor for content creation/editing
- Server-rendered mono-jsx components

**Hybrid Approach:**

- Admin can edit posts in KV; these override file-based posts
- Posts without KV entries fall back to filesystem
- Migration tool to move posts from files to KV

---

## Storage Layer (Deno KV)

### Schema Design

Deno KV uses hierarchical keys. Our schema follows these patterns:

```typescript
// Key Patterns
["posts", slug] // Post content and metadata
  ["posts_by_date", date, slug] // Date-based index
  ["posts_by_tag", tag, slug] // Tag-based index
  ["post_slugs"] // Set of all post slugs
  ["sessions", sessionId] // User sessions
  ["users", username] // User credentials
  ["admin", "metadata", key]; // Admin metadata (topics, etc.)
```

### Type Definitions

```typescript
// New types in src/lib/types.ts

export type PostStatus = "draft" | "published" | "archived";

export type KvPost = PostMeta & {
  readonly content: string; // Markdown content
  readonly tiptapJson?: unknown; // Optional Tiptap JSON format
  readonly status: PostStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
};

export type User = {
  readonly username: string;
  readonly passwordHash: string;
  readonly role: "admin" | "editor";
  readonly createdAt: string;
};

export type Session = {
  readonly sessionId: string;
  readonly username: string;
  readonly expiresAt: number; // Unix timestamp
  readonly createdAt: number;
};
```

### KV Operations

```typescript
// New port: src/ports/kv.ts

export interface KvStore {
  // Post operations
  readonly getPost: (slug: Slug) => Promise<AppResult<KvPost | null>>;
  readonly savePost: (post: KvPost) => Promise<AppResult<void>>;
  readonly deletePost: (slug: Slug) => Promise<AppResult<void>>;
  readonly listPosts: (
    options?: { status?: PostStatus; limit?: number },
  ) => Promise<AppResult<readonly KvPost[]>>;

  // Session operations
  readonly getSession: (
    sessionId: string,
  ) => Promise<AppResult<Session | null>>;
  readonly saveSession: (session: Session) => Promise<AppResult<void>>;
  readonly deleteSession: (sessionId: string) => Promise<AppResult<void>>;

  // User operations
  readonly getUser: (username: string) => Promise<AppResult<User | null>>;
  readonly saveUser: (user: User) => Promise<AppResult<void>>;
}
```

### Indexing Strategy

**Primary Index:** `["posts", slug]` - Fast single-post lookups

**Secondary Indexes:**

- `["posts_by_date", date, slug]` - Date-ordered listing
- `["posts_by_tag", tag, slug]` - Tag filtering
- `["posts_by_status", status, slug]` - Draft vs published

**Atomic Operations:** When saving a post, use atomic operations to update all
indexes:

```typescript
const atomic = kv.atomic()
  .set(["posts", slug], post)
  .set(["posts_by_date", post.date, slug], post)
  .set(["posts_by_status", post.status, slug], post);

for (const tag of post.tags ?? []) {
  atomic.set(["posts_by_tag", tag, slug], post);
}

await atomic.commit();
```

### Migration Strategy

**Phase 1: Dual Read (backward compatible)**

- AdminContentService reads from KV first, falls back to filesystem
- Public ContentService remains file-based
- No breaking changes

**Phase 2: Gradual Migration**

- CLI tool to import markdown files into KV: `deno task migrate:posts`
- Posts in KV override file-based posts
- Can import individual posts or all at once

**Phase 3: KV Primary (future)**

- Both public and admin read from KV
- Filesystem posts become backup/archive
- Optional: export KV posts to markdown files

**Migration Tool Example:**

```typescript
// scripts/migrate-posts.ts
export const migratePosts = async (
  contentService: ContentService,
  kvStore: KvStore,
  options: { dryRun?: boolean } = {},
): Promise<AppResult<{ imported: number; failed: string[] }>> => {
  const postsResult = await contentService.loadPosts();
  if (!postsResult.ok) return postsResult;

  const results = { imported: 0, failed: [] as string[] };

  for (const post of postsResult.value) {
    if (options.dryRun) {
      console.log(`Would import: ${post.slug}`);
      continue;
    }

    const kvPost: KvPost = {
      ...post,
      status: "published",
      createdAt: post.date,
      updatedAt: post.modified ?? post.date,
      createdBy: "migration",
    };

    const saveResult = await kvStore.savePost(kvPost);
    if (saveResult.ok) {
      results.imported++;
    } else {
      results.failed.push(post.slug);
    }
  }

  return ok(results);
};
```

---

## Authentication System

### Authentication Approach

**Chosen Method:** Session-based authentication with HTTP-only cookies

**Rationale:**

- Simple to implement and reason about
- Secure by default (HTTP-only, Secure, SameSite flags)
- No need for JWT complexity (single-server deployment)
- Integrates well with Deno KV for session storage
- Suitable for server-rendered admin UI

**Alternative Considered:** Basic Auth

- Simpler but less user-friendly (browser password dialogs)
- No logout functionality
- Harder to extend (e.g., multiple users)

### Authentication Flow

```
┌─────────┐                    ┌─────────┐                  ┌──────────┐
│ Browser │                    │  Server │                  │  Deno KV │
└────┬────┘                    └────┬────┘                  └────┬─────┘
     │                              │                            │
     │  GET /admin                  │                            │
     ├─────────────────────────────►│                            │
     │                              │  No session cookie         │
     │  302 Redirect to /login      │                            │
     │◄─────────────────────────────┤                            │
     │                              │                            │
     │  GET /login                  │                            │
     ├─────────────────────────────►│                            │
     │  HTML form                   │                            │
     │◄─────────────────────────────┤                            │
     │                              │                            │
     │  POST /login                 │                            │
     │  {username, password}        │                            │
     ├─────────────────────────────►│                            │
     │                              │  Verify credentials        │
     │                              ├───────────────────────────►│
     │                              │  Look up user              │
     │                              │◄───────────────────────────┤
     │                              │                            │
     │                              │  Generate session ID       │
     │                              │  Store session             │
     │                              ├───────────────────────────►│
     │                              │                            │
     │  Set-Cookie: session=...     │                            │
     │  302 Redirect to /admin      │                            │
     │◄─────────────────────────────┤                            │
     │                              │                            │
     │  GET /admin                  │                            │
     │  Cookie: session=...         │                            │
     ├─────────────────────────────►│                            │
     │                              │  Validate session          │
     │                              ├───────────────────────────►│
     │                              │◄───────────────────────────┤
     │                              │                            │
     │  Admin dashboard HTML        │                            │
     │◄─────────────────────────────┤                            │
     │                              │                            │
     │  POST /logout                │                            │
     ├─────────────────────────────►│                            │
     │                              │  Delete session            │
     │                              ├───────────────────────────►│
     │                              │                            │
     │  Clear cookie                │                            │
     │  302 Redirect to /           │                            │
     │◄─────────────────────────────┤                            │
```

### Security Considerations

**Password Hashing:**

- Use bcrypt (via `jsr:@felix/bcrypt@0.4.1`) for local development
- Use argon2id (via `jsr:@rabbit-company/argon2id`) for Deno Deploy
  (WASM-compatible)
- Salt rounds: 12 for bcrypt
- Never store plaintext passwords

**Session Management:**

- Session ID: Crypto-random UUID (crypto.randomUUID())
- Session expiry: 24 hours default, configurable
- HTTP-only cookies (JavaScript cannot access)
- Secure flag (HTTPS only in production)
- SameSite=Strict (CSRF protection)
- Rolling expiry: extend session on activity

**Cookie Configuration:**

```typescript
const SESSION_COOKIE_NAME = "blogo_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const createSessionCookie = (sessionId: string): string => {
  const isDev = Deno.env.get("DENO_ENV") !== "production";

  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Max-Age=${SESSION_DURATION_MS / 1000}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    ...(!isDev ? [`Secure`] : []),
  ].join("; ");
};
```

**Rate Limiting (Future Enhancement):**

- Track failed login attempts per IP in KV
- Implement exponential backoff after 3 failures
- Clear counter after successful login

### AuthService Interface

```typescript
// src/domain/auth.ts

export interface AuthService {
  readonly login: (
    username: string,
    password: string,
  ) => Promise<AppResult<Session>>;

  readonly logout: (sessionId: string) => Promise<AppResult<void>>;

  readonly validateSession: (
    sessionId: string,
  ) => Promise<AppResult<Session | null>>;

  readonly createUser: (
    username: string,
    password: string,
    role: "admin" | "editor",
  ) => Promise<AppResult<User>>;
}
```

### Authentication Middleware

```typescript
// src/http/middleware.ts (addition)

export const requireAuth =
  (kvStore: KvStore): Middleware => (next) => async (req) => {
    const url = new URL(req.url);

    // Allow login/logout routes without auth
    if (url.pathname === "/login" || url.pathname === "/logout") {
      return await next(req);
    }

    // Extract session cookie
    const cookies = req.headers.get("cookie") ?? "";
    const sessionMatch = cookies.match(/blogo_session=([^;]+)/);
    const sessionId = sessionMatch?.[1];

    if (!sessionId) {
      return new Response(null, {
        status: 302,
        headers: { "Location": "/login" },
      });
    }

    // Validate session
    const sessionResult = await kvStore.getSession(sessionId);

    if (!sessionResult.ok || !sessionResult.value) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/login",
          "Set-Cookie": `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/`,
        },
      });
    }

    const session = sessionResult.value;

    // Check expiry
    if (session.expiresAt < Date.now()) {
      await kvStore.deleteSession(sessionId);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/login",
          "Set-Cookie": `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/`,
        },
      });
    }

    // Add session to request context (using a WeakMap or custom header)
    // For now, we'll pass it through by cloning the request
    const authenticatedReq = new Request(req, {
      headers: new Headers({
        ...Object.fromEntries(req.headers),
        "X-Session-Username": session.username,
      }),
    });

    return await next(authenticatedReq);
  };
```

### Initial User Setup

Since we need at least one admin user, provide a setup command:

```bash
# Run once to create initial admin user
deno task admin:setup
```

```typescript
// scripts/setup-admin.ts
import { createAuthService } from "../src/domain/auth.ts";
import { createKvStore } from "../src/ports/kv.ts";

const kv = await Deno.openKv();
const kvStore = createKvStore(kv);
const authService = createAuthService({ kvStore });

const username = prompt("Admin username:") ?? "admin";
const password = prompt("Admin password:") ?? "";

if (password.length < 8) {
  console.error("Password must be at least 8 characters");
  Deno.exit(1);
}

const result = await authService.createUser(username, password, "admin");

if (result.ok) {
  console.log(`✓ Admin user '${username}' created successfully`);
} else {
  console.error(`✗ Failed to create user: ${result.error.message}`);
  Deno.exit(1);
}

await kv.close();
```

---

## Editor Integration

### Tiptap Setup

**Approach:** ESM CDN imports via esm.sh

**Rationale:**

- No build step required (aligns with Deno philosophy)
- Fast development iteration
- Minimal bundle size (tree-shaking via ESM)
- Easy to upgrade (just change version in URL)

**CDN URLs:**

```typescript
// In admin HTML template
const TIPTAP_IMPORTS = {
  core: "https://esm.sh/@tiptap/core@2.8.0",
  starterKit: "https://esm.sh/@tiptap/starter-kit@2.8.0",
  markdown: "https://esm.sh/prosemirror-markdown@1.13.2",
};
```

### Required Extensions

From StarterKit (included):

- **Bold**, **Italic**, **Strike** - Text styling
- **Heading** - H1-H6 headings
- **Paragraph** - Body text
- **BulletList**, **OrderedList**, **ListItem** - Lists
- **Code**, **CodeBlock** - Inline and block code
- **Blockquote** - Quoted text
- **HorizontalRule** - Horizontal dividers
- **HardBreak** - Line breaks

Additional extensions needed:

- **Link** - Hyperlinks (included in StarterKit v3+)
- **prosemirror-markdown** - Bidirectional markdown conversion

### Markdown Conversion

**Strategy:** Use prosemirror-markdown for bidirectional conversion

**Parsing (Markdown → Tiptap):**

```typescript
import { defaultMarkdownParser } from "prosemirror-markdown";
import { Schema } from "prosemirror-model";

const parseMarkdown = (markdown: string) => {
  const schema = new Schema({
    nodes: /* Tiptap node specs */,
    marks: /* Tiptap mark specs */,
  });

  return defaultMarkdownParser.parse(markdown);
};
```

**Serializing (Tiptap → Markdown):**

```typescript
import { defaultMarkdownSerializer } from "prosemirror-markdown";

const serializeMarkdown = (doc) => {
  return defaultMarkdownSerializer.serialize(doc);
};
```

**In Practice:**

```typescript
// Client-side editor initialization
import { Editor } from "https://esm.sh/@tiptap/core@2.8.0";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.8.0";

const editor = new Editor({
  element: document.querySelector("#editor"),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: { languageClassPrefix: "language-" },
    }),
  ],
  content: initialMarkdown, // Parsed from markdown
  editorProps: {
    attributes: {
      class: "prose prose-sm sm:prose lg:prose-lg focus:outline-none",
    },
  },
});

// Get markdown from editor
const getMarkdown = () => {
  const json = editor.getJSON();
  return serializeToMarkdown(json);
};

// Set markdown in editor
const setMarkdown = (markdown) => {
  const json = parseFromMarkdown(markdown);
  editor.commands.setContent(json);
};
```

### Frontmatter Editing

Since Tiptap handles content, frontmatter is edited separately:

```html
<form id="post-form">
  <!-- Frontmatter Fields -->
  <div class="frontmatter-section">
    <label>
      Title
      <input type="text" name="title" required maxlength="200" />
    </label>

    <label>
      Slug
      <input type="text" name="slug" required pattern="[a-z0-9-]+" />
    </label>

    <label>
      Date
      <input type="date" name="date" required />
    </label>

    <label>
      Tags (comma-separated)
      <input type="text" name="tags" placeholder="TypeScript, Deno, Web" />
    </label>

    <label>
      Excerpt
      <textarea name="excerpt" rows="3" maxlength="500"></textarea>
    </label>

    <label>
      Status
      <select name="status">
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
    </label>
  </div>

  <!-- Content Editor -->
  <div class="editor-section">
    <label>Content</label>
    <div id="editor"></div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button type="submit" name="action" value="save">Save Draft</button>
    <button type="submit" name="action" value="publish">Publish</button>
    <button type="button" id="preview-btn">Preview</button>
    <a href="/admin/posts">Cancel</a>
  </div>
</form>
```

### Editor Component (Server-Side)

```typescript
// src/components/admin/PostEditor.tsx

export const PostEditor = (props: {
  readonly post?: KvPost;
  readonly mode: "create" | "edit";
}) => {
  const { post, mode } = props;

  return (
    <div class="post-editor">
      <h1>{mode === "create" ? "Create New Post" : `Edit: ${post?.title}`}</h1>

      <form id="post-form" method="POST" action="/admin/posts/save">
        {post && <input type="hidden" name="originalSlug" value={post.slug} />}

        <div class="frontmatter-section">
          {/* Frontmatter fields as shown above */}
        </div>

        <div class="editor-section">
          <label for="editor">Content</label>
          <div id="editor" data-initial-content={post?.content ?? ""}></div>
          <textarea
            id="markdown-content"
            name="content"
            style="display: none;"
          >
          </textarea>
        </div>

        <div class="actions">
          <button type="submit" name="action" value="save">Save Draft</button>
          <button type="submit" name="action" value="publish">Publish</button>
          <button type="button" id="preview-btn">Preview</button>
          <a href="/admin/posts">Cancel</a>
        </div>
      </form>

      <script type="module" src="/js/admin/editor.js"></script>
    </div>
  );
};
```

### Client-Side Editor Script

```typescript
// public/js/admin/editor.js
import { Editor } from "https://esm.sh/@tiptap/core@2.8.0";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.8.0";

const editorElement = document.querySelector("#editor");
const markdownTextarea = document.querySelector("#markdown-content");
const form = document.querySelector("#post-form");
const previewBtn = document.querySelector("#preview-btn");

const initialContent = editorElement.dataset.initialContent || "";

const editor = new Editor({
  element: editorElement,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
  ],
  content: initialContent,
  onUpdate: ({ editor }) => {
    // Sync markdown to hidden textarea
    markdownTextarea.value = editor.storage.markdown.getMarkdown();
  },
});

// Before form submit, ensure markdown is synced
form.addEventListener("submit", (e) => {
  markdownTextarea.value = editor.storage.markdown.getMarkdown();
});

// Preview handler
previewBtn.addEventListener("click", () => {
  const markdown = editor.storage.markdown.getMarkdown();
  const formData = new FormData(form);
  formData.set("content", markdown);

  // Open preview in new tab
  const previewForm = document.createElement("form");
  previewForm.method = "POST";
  previewForm.action = "/admin/preview";
  previewForm.target = "_blank";

  for (const [key, value] of formData.entries()) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    previewForm.appendChild(input);
  }

  document.body.appendChild(previewForm);
  previewForm.submit();
  document.body.removeChild(previewForm);
});
```

### Preview Functionality

```typescript
// Admin route: POST /admin/preview
export const handlePreview = async (req: Request): Promise<Response> => {
  const formData = await req.formData();
  const tempPost: Post = {
    title: formData.get("title") as string,
    date: formData.get("date") as string,
    slug: createSlug("preview"),
    content: markdownToHtml(formData.get("content") as string).value,
    tags: (formData.get("tags") as string)
      ?.split(",")
      .map((t) => createTagName(t.trim())),
    excerpt: formData.get("excerpt") as string,
  };

  // Render using existing PostView component
  return new Response(
    createLayout({
      title: `Preview: ${tempPost.title}`,
      children: <PostView post={tempPost} />,
    }),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
};
```

---

## Routing & Components

### New Routes

```typescript
// src/http/admin-routes.tsx (new file)

export const adminRoutes = [
  // Authentication
  { method: "GET", path: "/login", handler: renderLoginPage },
  { method: "POST", path: "/login", handler: handleLogin },
  { method: "POST", path: "/logout", handler: handleLogout },

  // Admin Dashboard
  { method: "GET", path: "/admin", handler: renderAdminDashboard },

  // Post Management
  { method: "GET", path: "/admin/posts", handler: listPosts },
  { method: "GET", path: "/admin/posts/new", handler: renderNewPost },
  { method: "GET", path: "/admin/posts/:slug", handler: renderEditPost },
  { method: "POST", path: "/admin/posts/save", handler: handleSavePost },
  {
    method: "POST",
    path: "/admin/posts/:slug/delete",
    handler: handleDeletePost,
  },

  // Preview
  { method: "POST", path: "/admin/preview", handler: handlePreview },
  // Media Management (Future)
  // { method: "GET",  path: "/admin/media",  handler: listMedia },
  // { method: "POST", path: "/admin/media/upload", handler: handleUpload },
];
```

### Route Integration

Update `src/app/main.ts` to mount admin routes:

```typescript
import { createRouter } from "../http/router.ts";
import { publicRoutes } from "../http/routes.tsx";
import { adminRoutes } from "../http/admin-routes.tsx";
import { requireAuth } from "../http/middleware.ts";

// ... existing setup ...

const router = createRouter([
  ...publicRoutes,
  ...adminRoutes,
]);

// Apply auth middleware only to /admin/* routes
const protectedRouter = (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/admin")) {
    return requireAuth(kvStore)(router)(req);
  }
  return router(req);
};

Deno.serve({
  port: Number(Deno.env.get("PORT") ?? "8000"),
  handler: compose(protectedRouter, [
    errorBoundary,
    performanceMonitoring,
    requestId(),
    accessLog,
    staticFiles(publicDir),
  ]),
});
```

### New Components

**1. Login Form**

```typescript
// src/components/admin/LoginForm.tsx

export const LoginForm = (props: {
  readonly error?: string;
}) => (
  <div class="login-container">
    <form method="POST" action="/login" class="login-form">
      <h1>Blogo Admin</h1>

      {props.error && <div class="error-message">{props.error}</div>}

      <label>
        Username
        <input
          type="text"
          name="username"
          required
          autofocus
          autocomplete="username"
        />
      </label>

      <label>
        Password
        <input
          type="password"
          name="password"
          required
          autocomplete="current-password"
        />
      </label>

      <button type="submit">Log In</button>
    </form>
  </div>
);
```

**2. Admin Dashboard**

```typescript
// src/components/admin/AdminDashboard.tsx

export const AdminDashboard = (props: {
  readonly stats: {
    readonly totalPosts: number;
    readonly draftPosts: number;
    readonly publishedPosts: number;
  };
  readonly recentPosts: readonly KvPost[];
}) => (
  <div class="admin-dashboard">
    <header class="admin-header">
      <h1>Admin Dashboard</h1>
      <nav>
        <a href="/admin/posts">Posts</a>
        <a href="/admin/posts/new">New Post</a>
        <form method="POST" action="/logout" style="display: inline;">
          <button type="submit">Logout</button>
        </form>
      </nav>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Posts</h3>
        <p class="stat-number">{props.stats.totalPosts}</p>
      </div>
      <div class="stat-card">
        <h3>Published</h3>
        <p class="stat-number">{props.stats.publishedPosts}</p>
      </div>
      <div class="stat-card">
        <h3>Drafts</h3>
        <p class="stat-number">{props.stats.draftPosts}</p>
      </div>
    </div>

    <section class="recent-posts">
      <h2>Recent Posts</h2>
      <ul>
        {props.recentPosts.map((post) => (
          <li>
            <a href={`/admin/posts/${post.slug}`}>
              {post.title}
              <span class="post-status">{post.status}</span>
            </a>
            <time>{post.updatedAt}</time>
          </li>
        ))}
      </ul>
    </section>
  </div>
);
```

**3. Post List (Admin)**

```typescript
// src/components/admin/PostList.tsx

export const PostList = (props: {
  readonly posts: readonly KvPost[];
  readonly filter?: PostStatus;
}) => (
  <div class="admin-post-list">
    <header>
      <h1>Posts</h1>
      <a href="/admin/posts/new" class="btn-primary">New Post</a>
    </header>

    <div class="filters">
      <a href="/admin/posts" class={!props.filter ? "active" : ""}>
        All
      </a>
      <a
        href="/admin/posts?status=published"
        class={props.filter === "published" ? "active" : ""}
      >
        Published
      </a>
      <a
        href="/admin/posts?status=draft"
        class={props.filter === "draft" ? "active" : ""}
      >
        Drafts
      </a>
    </div>

    <table class="post-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Date</th>
          <th>Modified</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {props.posts.map((post) => (
          <tr>
            <td>
              <a href={`/admin/posts/${post.slug}`}>{post.title}</a>
            </td>
            <td>
              <span class={`badge badge-${post.status}`}>{post.status}</span>
            </td>
            <td>{post.date}</td>
            <td>{post.updatedAt}</td>
            <td class="actions">
              <a href={`/admin/posts/${post.slug}`}>Edit</a>
              <a href={`/posts/${post.slug}`} target="_blank">View</a>
              <form
                method="POST"
                action={`/admin/posts/${post.slug}/delete`}
                onsubmit="return confirm('Delete this post?')"
                style="display: inline;"
              >
                <button type="submit" class="btn-danger">Delete</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

**4. Admin Layout**

```typescript
// src/components/admin/AdminLayout.tsx

export const AdminLayout = (props: {
  readonly title: string;
  readonly children: unknown;
  readonly username?: string;
}) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{props.title} - Blogo Admin</title>
      <link rel="stylesheet" href="/css/main.css" />
      <link rel="stylesheet" href="/css/admin.css" />
    </head>
    <body class="admin-body">
      {props.username && (
        <nav class="admin-nav">
          <a href="/admin">Dashboard</a>
          <a href="/admin/posts">Posts</a>
          <a href="/">View Site</a>
          <span class="admin-user">Logged in as: {props.username}</span>
        </nav>
      )}

      <main class="admin-main">
        {props.children}
      </main>
    </body>
  </html>
);
```

### Component Organization

```
src/components/
├── admin/                    # NEW: Admin-only components
│   ├── AdminDashboard.tsx
│   ├── AdminLayout.tsx
│   ├── LoginForm.tsx
│   ├── PostEditor.tsx
│   └── PostList.tsx
├── Layout.tsx                # Existing: Public layout
├── PostList.tsx              # Existing: Public post list
├── PostView.tsx              # Existing: Single post view
├── SearchModal.tsx           # Existing
└── TagList.tsx               # Existing
```

---

## Implementation Plan

### Phase 1: Authentication System (Week 1)

**Priority:** HIGH (Foundation for everything else) **Risk:** MEDIUM
(Security-critical)

**Tasks:**

1. **Setup KV infrastructure** (4 hours)
   - Create `src/ports/kv.ts` with KvStore interface
   - Implement `createKvStore()` adapter
   - Add basic error handling with Result types
   - Write unit tests with mock KV

2. **Implement password hashing** (2 hours)
   - Add bcrypt dependency for local dev
   - Add argon2id dependency for Deploy
   - Create `hashPassword()` and `verifyPassword()` functions
   - Test both implementations

3. **Build AuthService** (6 hours)
   - Create `src/domain/auth.ts`
   - Implement `login()` with password verification
   - Implement `logout()` to invalidate session
   - Implement `validateSession()` with expiry check
   - Implement `createUser()` with validation
   - Write comprehensive unit tests

4. **Create authentication middleware** (4 hours)
   - Add `requireAuth()` middleware to `src/http/middleware.ts`
   - Handle cookie parsing and session validation
   - Implement redirects for unauthenticated requests
   - Add session renewal on activity
   - Test middleware with mock requests

5. **Build login UI** (4 hours)
   - Create `LoginForm` component
   - Create login route handlers
   - Add form validation (client + server)
   - Style login page minimally
   - Test login/logout flow

6. **Create admin setup script** (2 hours)
   - Build `scripts/setup-admin.ts`
   - Add validation for username/password
   - Add `admin:setup` task to deno.json
   - Document setup process in README

**Dependencies:** None **Deliverables:**

- Working login/logout flow
- Session management in KV
- Admin user creation tool
- Authentication middleware ready for use

**Testing Strategy:**

- Unit tests for AuthService (mock KV)
- Integration tests for login flow
- Manual testing of cookie security flags

---

### Phase 2: Deno KV Storage Layer (Week 2)

**Priority:** HIGH (Required for content management) **Risk:** MEDIUM (Data
migration complexity)

**Tasks:**

1. **Extend KV schema** (3 hours)
   - Add post-related types to `src/lib/types.ts`
   - Define `KvPost`, `PostStatus` types
   - Update KvStore interface with post operations
   - Document key patterns

2. **Implement post CRUD operations** (8 hours)
   - `getPost(slug)` with error handling
   - `savePost(post)` with atomic index updates
   - `deletePost(slug)` with atomic index cleanup
   - `listPosts()` with filtering and pagination
   - Handle concurrent updates gracefully
   - Write unit tests

3. **Build AdminContentService** (6 hours)
   - Create `src/domain/admin-content.ts`
   - Implement service using KvStore port
   - Add validation for post data
   - Return Result types for all operations
   - Write integration tests

4. **Implement hybrid read strategy** (4 hours)
   - Update public ContentService to check KV first
   - Fall back to filesystem if KV returns null
   - Maintain cache behavior
   - Ensure backward compatibility
   - Test with mixed data sources

5. **Create migration tool** (6 hours)
   - Build `scripts/migrate-posts.ts`
   - Support dry-run mode
   - Handle frontmatter preservation
   - Report success/failure per post
   - Add rollback capability
   - Add `migrate:posts` task to deno.json

6. **Build KV admin utilities** (3 hours)
   - Script to list all posts in KV
   - Script to export post from KV to markdown
   - Script to clear KV data (for testing)
   - Add tasks to deno.json

**Dependencies:** Phase 1 (Auth system for user tracking) **Deliverables:**

- Complete KV storage layer
- AdminContentService with CRUD
- Migration tool
- Backward-compatible read strategy

**Testing Strategy:**

- Unit tests for all KV operations
- Integration tests with real KV instance
- Migration tests with sample posts
- Performance tests for large datasets

---

### Phase 3: Admin Routes & UI (Week 3)

**Priority:** MEDIUM (UI for existing backend) **Risk:** LOW (Server-rendered
components)

**Tasks:**

1. **Create admin route file** (2 hours)
   - Create `src/http/admin-routes.tsx`
   - Define route patterns
   - Add placeholder handlers
   - Register routes in main.ts

2. **Build admin layout** (3 hours)
   - Create `AdminLayout` component
   - Add admin navigation
   - Create basic admin CSS (`public/css/admin.css`)
   - Ensure responsive design

3. **Implement dashboard** (4 hours)
   - Create `AdminDashboard` component
   - Calculate post statistics
   - List recent posts
   - Add quick actions
   - Wire up route handler

4. **Build post list view** (5 hours)
   - Create `PostList` component (admin version)
   - Implement filtering by status
   - Add sorting by date
   - Style table responsively
   - Wire up route handler

5. **Add delete functionality** (3 hours)
   - Implement delete handler
   - Add confirmation dialog (client-side)
   - Handle errors gracefully
   - Show success message
   - Test deletion flow

6. **Integrate auth UI** (2 hours)
   - Show logged-in username
   - Add logout button to nav
   - Display session expiry warning
   - Test full auth flow

**Dependencies:** Phase 1 (Auth), Phase 2 (KV storage) **Deliverables:**

- Admin dashboard with stats
- Post list with filtering
- Delete functionality
- Full navigation between admin pages

**Testing Strategy:**

- Visual testing of all admin pages
- Test authentication flow
- Test all CRUD operations via UI
- Accessibility check (keyboard navigation)

---

### Phase 4: Tiptap Editor Integration (Week 4)

**Priority:** HIGH (Core feature) **Risk:** MEDIUM (Markdown conversion
complexity)

**Tasks:**

1. **Set up Tiptap dependencies** (2 hours)
   - Add CDN imports for Tiptap core and StarterKit
   - Add prosemirror-markdown for conversion
   - Create test HTML page to validate setup
   - Document CDN versions

2. **Build editor component (server)** (4 hours)
   - Create `PostEditor` component
   - Add frontmatter fields
   - Add editor container div
   - Add hidden markdown textarea
   - Wire up form submission

3. **Create client-side editor script** (8 hours)
   - Initialize Tiptap editor
   - Configure StarterKit extensions
   - Implement markdown parsing (load)
   - Implement markdown serialization (save)
   - Sync editor to hidden textarea
   - Handle editor lifecycle
   - Test markdown round-tripping

4. **Implement create post flow** (4 hours)
   - Route: GET /admin/posts/new
   - Render empty editor
   - Handle POST /admin/posts/save
   - Validate all fields
   - Save to KV with status
   - Redirect to post list
   - Show success message

5. **Implement edit post flow** (4 hours)
   - Route: GET /admin/posts/:slug
   - Load post from KV
   - Populate editor with content
   - Handle slug changes
   - Update post in KV
   - Handle concurrent edits

6. **Add preview functionality** (4 hours)
   - Implement preview route (POST /admin/preview)
   - Serialize markdown from editor
   - Render using public PostView component
   - Open in new tab/window
   - Style preview indicator

7. **Handle code blocks with syntax highlighting** (3 hours)
   - Configure CodeBlock extension
   - Add language selector UI
   - Ensure highlight.js compatibility
   - Test various languages
   - Document supported languages

8. **Add image insertion** (4 hours)
   - Add Image extension to Tiptap
   - Build image URL input dialog
   - Support markdown image syntax
   - Validate image URLs
   - Test image rendering

9. **Style editor interface** (4 hours)
   - Create editor-specific CSS
   - Style toolbar (if needed)
   - Style editor content area
   - Add loading states
   - Test on mobile devices

**Dependencies:** Phase 2 (KV storage), Phase 3 (Admin UI) **Deliverables:**

- Working Tiptap editor
- Create/edit post functionality
- Preview feature
- Markdown bidirectional conversion
- Styled editor interface

**Testing Strategy:**

- Test markdown round-trip fidelity
- Test all StarterKit extensions
- Test frontmatter validation
- Test save/publish workflows
- Test preview accuracy
- Browser compatibility testing

---

### Summary Timeline

| Phase                   | Duration | Dependencies | Risk   |
| ----------------------- | -------- | ------------ | ------ |
| Phase 1: Authentication | Week 1   | None         | Medium |
| Phase 2: KV Storage     | Week 2   | Phase 1      | Medium |
| Phase 3: Admin UI       | Week 3   | Phase 1, 2   | Low    |
| Phase 4: Tiptap Editor  | Week 4   | Phase 2, 3   | Medium |

**Total Estimated Time:** 4 weeks (full-time) or 8-10 weeks (part-time)

**Critical Path:** Phase 1 → Phase 2 → Phase 4

**Parallelization Opportunities:**

- Phase 3 can start once Phase 2 is partially complete
- UI styling can happen throughout all phases

---

## Code Examples

### 1. KV Schema Type Definitions

```typescript
// src/lib/types.ts (additions)

export type PostStatus = "draft" | "published" | "archived";

export type KvPost = PostMeta & {
  readonly content: string;
  readonly tiptapJson?: unknown;
  readonly status: PostStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
};

export type User = {
  readonly username: string;
  readonly passwordHash: string;
  readonly role: "admin" | "editor";
  readonly createdAt: string;
};

export type Session = {
  readonly sessionId: string;
  readonly username: string;
  readonly expiresAt: number;
  readonly createdAt: number;
};
```

### 2. Authentication Middleware Function Signature

```typescript
// src/http/middleware.ts (addition)

export const requireAuth = (kvStore: KvStore): Middleware =>
  (next: Handler) => async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // Skip auth for login/logout
    if (url.pathname === "/login" || url.pathname === "/logout") {
      return await next(req);
    }

    // Extract session cookie
    const cookies = req.headers.get("cookie") ?? "";
    const sessionMatch = cookies.match(/blogo_session=([^;]+)/);
    const sessionId = sessionMatch?.[1];

    if (!sessionId) {
      return redirectToLogin();
    }

    // Validate session
    const sessionResult = await kvStore.getSession(sessionId);

    if (!sessionResult.ok || !sessionResult.value) {
      return redirectToLogin(clearSessionCookie: true);
    }

    const session = sessionResult.value;

    // Check expiry
    if (session.expiresAt < Date.now()) {
      await kvStore.deleteSession(sessionId);
      return redirectToLogin(clearSessionCookie: true);
    }

    // Add username to request headers
    const authenticatedReq = new Request(req, {
      headers: new Headers({
        ...Object.fromEntries(req.headers),
        "X-Session-Username": session.username,
      }),
    });

    return await next(authenticatedReq);
  };

const redirectToLogin = (options?: { clearSessionCookie?: boolean }): Response => {
  const headers: HeadersInit = { "Location": "/login" };

  if (options?.clearSessionCookie) {
    headers["Set-Cookie"] = "blogo_session=; Max-Age=0; Path=/; HttpOnly";
  }

  return new Response(null, { status: 302, headers });
};
```

### 3. Tiptap Initialization Code

```typescript
// public/js/admin/editor.js

import { Editor } from "https://esm.sh/@tiptap/core@2.8.0";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.8.0";
import Link from "https://esm.sh/@tiptap/extension-link@2.8.0";

// Get elements
const editorElement = document.querySelector("#editor");
const markdownTextarea = document.querySelector("#markdown-content");
const form = document.querySelector("#post-form");

// Get initial content from data attribute
const initialMarkdown = editorElement.dataset.initialContent || "";

// Initialize editor
const editor = new Editor({
  element: editorElement,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      codeBlock: {
        languageClassPrefix: "language-",
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
      },
    }),
  ],
  content: initialMarkdown,
  editorProps: {
    attributes: {
      class:
        "prose prose-sm sm:prose lg:prose-lg focus:outline-none min-h-[400px] p-4 border rounded",
    },
  },
  onUpdate: ({ editor }) => {
    // Sync markdown to hidden textarea on every update
    const markdown = serializeToMarkdown(editor.getJSON());
    markdownTextarea.value = markdown;
  },
});

// Ensure markdown is synced before form submission
form.addEventListener("submit", (e) => {
  const markdown = serializeToMarkdown(editor.getJSON());
  markdownTextarea.value = markdown;
});

// Expose editor globally for debugging
window.editor = editor;
```

### 4. Converting Tiptap Content to/from Markdown

```typescript
// public/js/admin/markdown-converter.js

import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "https://esm.sh/prosemirror-markdown@1.13.2";
import { DOMParser as ProseMirrorDOMParser } from "https://esm.sh/prosemirror-model@1.19.0";

/**
 * Parse markdown string into ProseMirror document
 */
export const parseFromMarkdown = (markdown: string) => {
  try {
    return defaultMarkdownParser.parse(markdown);
  } catch (error) {
    console.error("Failed to parse markdown:", error);
    return null;
  }
};

/**
 * Serialize ProseMirror JSON document to markdown string
 */
export const serializeToMarkdown = (doc) => {
  try {
    return defaultMarkdownSerializer.serialize(doc);
  } catch (error) {
    console.error("Failed to serialize to markdown:", error);
    return "";
  }
};

/**
 * Alternative: Convert markdown to HTML, then parse with DOMParser
 * This approach uses the browser's HTML parser which can be more lenient
 */
export const parseMarkdownViaHTML = (markdown: string, schema) => {
  // Convert markdown to HTML using marked or similar
  const html = marked.parse(markdown);

  // Parse HTML to DOM
  const div = document.createElement("div");
  div.innerHTML = html;

  // Parse DOM to ProseMirror document
  return ProseMirrorDOMParser.fromSchema(schema).parse(div);
};
```

**Usage in Editor:**

```typescript
// Load markdown into editor
const loadMarkdown = (markdown) => {
  const doc = parseFromMarkdown(markdown);
  if (doc) {
    editor.commands.setContent(doc.toJSON());
  }
};

// Get markdown from editor
const getMarkdown = () => {
  return serializeToMarkdown(editor.getJSON());
};
```

---

## Dependencies

### New Dependencies to Add

```json
// deno.json (additions to imports)
{
  "imports": {
    // ... existing imports ...

    // Password hashing (choose one based on deployment target)
    "@felix/bcrypt": "jsr:@felix/bcrypt@0.4.1",
    "@rabbit-company/argon2id": "jsr:@rabbit-company/argon2id@^1.0.0"
    // Note: Tiptap will be loaded via CDN, not as Deno dependencies
  }
}
```

### CDN Dependencies (Client-Side)

These are loaded via ESM imports in the browser:

- `@tiptap/core@2.8.0` - Core editor engine
- `@tiptap/starter-kit@2.8.0` - Common extensions bundle
- `@tiptap/extension-link@2.8.0` - Link support (if not in StarterKit)
- `prosemirror-markdown@1.13.2` - Markdown conversion
- `prosemirror-model@1.19.0` - Document model (peer dependency)

**CDN Service:** esm.sh (recommended for Deno compatibility)

**Example Import:**

```javascript
import { Editor } from "https://esm.sh/@tiptap/core@2.8.0";
```

### No Build Step Required

All dependencies are either:

1. Deno imports (loaded at runtime)
2. ESM CDN imports (loaded by browser)

No webpack, rollup, or esbuild needed!

---

## Risks & Trade-offs

### Identified Risks

#### 1. Markdown Conversion Fidelity (MEDIUM RISK)

**Problem:** Markdown → Tiptap → Markdown conversion may not be perfectly
lossless. Certain markdown features (e.g., HTML comments, custom HTML, specific
formatting) might be lost or altered.

**Mitigation:**

- Test conversion with existing blog posts early
- Document unsupported markdown features
- Consider storing both markdown and Tiptap JSON in KV
- Provide a "source mode" toggle to edit raw markdown
- Add validation warnings when conversion changes content

**Trade-off:** Accept minor formatting differences vs. building custom markdown
parser

---

#### 2. Concurrent Edit Conflicts (MEDIUM RISK)

**Problem:** If two admins edit the same post simultaneously, one will overwrite
the other's changes.

**Mitigation:**

- Use Deno KV's `versionstamp` for optimistic concurrency control
- Detect conflicts on save and warn user
- Show "last edited by X at Y" timestamp
- Consider implementing lock mechanism (advisory)
- Phase 1: Just prevent overwrites (show error)
- Phase 2: Implement 3-way merge or manual resolution

**Trade-off:** Simple error vs. complex merge logic

---

#### 3. Session Security & Expiry (MEDIUM RISK)

**Problem:** Sessions stored in KV could be compromised if session ID is
exposed; expired sessions might not clean up properly.

**Mitigation:**

- Use crypto-random session IDs (UUID v4)
- Set short TTL on session entries (24 hours)
- Implement automatic cleanup task (Deno.cron)
- Add CSRF protection for state-changing operations
- Rate limit login attempts
- Log all admin actions for audit trail

**Trade-off:** Convenience vs. security strictness

---

#### 4. Migration Data Integrity (LOW RISK)

**Problem:** Migrating 25 existing posts to KV could introduce errors (corrupted
content, lost metadata).

**Mitigation:**

- Implement dry-run mode first
- Validate all data before saving to KV
- Keep filesystem posts as source of truth initially
- Add export-from-KV tool for rollback
- Migrate posts incrementally (not all at once)
- Verify rendered output matches original

**Trade-off:** Manual verification effort vs. automated migration

---

#### 5. CDN Dependency Reliability (LOW RISK)

**Problem:** Using esm.sh CDN for Tiptap means reliance on external service;
could fail or change.

**Mitigation:**

- Pin specific versions in imports
- Consider self-hosting Tiptap bundles if CDN is unreliable
- Add fallback mechanism (detect load failure, show error)
- Cache Tiptap assets in browser aggressively
- Document how to migrate to npm + bundler if needed

**Trade-off:** Simplicity vs. self-hosting control

---

#### 6. Editor Styling & Customization (LOW RISK)

**Problem:** Tiptap's default styles might conflict with blog's brutalist
design; customization could be time-consuming.

**Mitigation:**

- Start with minimal Tiptap styling
- Use CSS scoping to avoid conflicts
- Accept editor looking different from public blog
- Phase 1: Functional editor, basic styles
- Phase 2: Polish and match blog aesthetic

**Trade-off:** Time investment vs. consistency

---

### Design Trade-offs

#### Trade-off 1: KV vs. Filesystem

**Decision:** Use Deno KV for admin, keep filesystem as fallback

**Pros:**

- Atomic operations for concurrency safety
- Fast queries without file I/O
- Built-in TTL for sessions
- Works seamlessly on Deno Deploy
- Structured data easier to query/filter

**Cons:**

- Adds complexity (dual storage system)
- KV data not visible in git (can't track changes)
- Requires migration effort
- Need to implement backup strategy

**Why Chosen:** KV is the Deno-native solution for dynamic data; filesystem is
great for static content but poor for CRUD operations.

---

#### Trade-off 2: Session Cookies vs. JWT

**Decision:** Use session cookies with HTTP-only flag

**Pros:**

- Simpler implementation (no token signing/verification)
- Server controls session validity (can revoke instantly)
- More secure (HTTP-only, no XSS risk)
- Better for single-server deployment

**Cons:**

- Requires server-side session storage (KV)
- Doesn't scale to multi-server without shared KV
- Each request requires KV lookup

**Why Chosen:** Simplicity and security for single-admin use case; Deno KV makes
session storage trivial.

---

#### Trade-off 3: Tiptap via CDN vs. npm + Bundler

**Decision:** Use Tiptap via ESM CDN imports

**Pros:**

- No build step (aligns with Deno philosophy)
- Fast development iteration
- Automatic tree-shaking via ESM
- Easy to upgrade (change version in URL)
- Smaller repo size (no node_modules)

**Cons:**

- Relies on external service (esm.sh)
- Slightly slower first load (no local bundle)
- Must be online to develop
- Version pinning required

**Why Chosen:** Deno's strength is avoiding build tooling; CDN approach is most
aligned with project philosophy.

---

#### Trade-off 4: Mono-jsx Admin UI vs. SPA Framework

**Decision:** Server-rendered mono-jsx for admin UI

**Pros:**

- Consistent with existing architecture
- No additional framework/library needed
- Smaller client-side bundle
- Easier to reason about (request → response)
- Better accessibility (works without JS)

**Cons:**

- Full page reloads on navigation
- Harder to implement rich interactions
- Can't easily add real-time features
- Less "app-like" feel

**Why Chosen:** Keep architecture consistent; admin UI doesn't need SPA
complexity; can enhance with HTMX later if needed.

---

#### Trade-off 5: Single Admin User vs. Multi-User

**Decision:** Start with single admin, design for multi-user

**Pros:**

- Simpler initial implementation
- No role/permission system needed yet
- Faster to ship MVP

**Cons:**

- Will need refactoring if multiple admins needed
- No audit trail of who edited what

**Why Chosen:** Ship faster with single user; schema already supports multiple
users, so future expansion is easy.

---

### Open Questions Requiring Decisions

#### Q1: Storage Strategy

**Question:** Should we store both markdown and Tiptap JSON in KV, or just
markdown?

**Option A:** Store only markdown

- Pros: Single source of truth, smaller storage
- Cons: Re-parse markdown to JSON on every edit

**Option B:** Store both markdown and Tiptap JSON

- Pros: Faster editor loading, no re-parsing
- Cons: Potential inconsistency, larger storage

**Recommendation:** Start with Option A (markdown only); add JSON caching if
editor load is slow.

---

#### Q2: Migration Strategy

**Question:** Should we migrate all posts to KV immediately, or do it gradually?

**Option A:** Migrate all 25 posts at once

- Pros: Clean cut-over, simpler logic
- Cons: Higher risk if migration fails

**Option B:** Migrate posts on-demand (when first edited)

- Pros: Lower risk, incremental approach
- Cons: Hybrid state persists longer

**Recommendation:** Option B (on-demand migration) for safety; provide bulk
migration tool for convenience.

---

#### Q3: Draft vs. Published

**Question:** Should draft posts be visible on the public blog?

**Option A:** Drafts are admin-only

- Pros: Clean separation, no accidental publication
- Cons: Can't preview on live site

**Option B:** Drafts visible at secret URL

- Pros: Easy to share for feedback
- Cons: Security by obscurity, might leak

**Recommendation:** Option A (admin-only drafts); add preview functionality that
renders public view within admin.

---

#### Q4: Image Upload

**Question:** Should we implement image upload, or rely on external hosting?

**Option A:** Implement image upload to filesystem or KV

- Pros: Self-contained, no external dependencies
- Cons: Storage management, file size limits

**Option B:** Use external image hosting (Cloudinary, Imgur, etc.)

- Pros: Offload storage/optimization
- Cons: External dependency, possible costs

**Recommendation:** Phase 1: External hosting (paste URLs); Phase 2: Implement
upload if needed.

---

#### Q5: Markdown Extensions

**Question:** Should we support extended markdown (e.g., footnotes, definition
lists, custom components)?

**Option A:** Stick to CommonMark (what prosemirror-markdown supports)

- Pros: Simpler, more compatible
- Cons: Limits content expressiveness

**Option B:** Add custom markdown extensions

- Pros: More powerful content
- Cons: Custom parser/serializer, breaks compatibility

**Recommendation:** Option A (CommonMark only) for MVP; evaluate extensions
based on actual needs.

---

## Next Steps

Once you approve this design:

1. **Phase 1 Implementation:**
   - Start with authentication system (highest priority)
   - Create KV infrastructure
   - Build login UI

2. **Validation:**
   - Test authentication flow thoroughly
   - Validate session security
   - Verify password hashing

3. **Phase 2 Planning:**
   - Review KV schema design
   - Plan migration testing strategy
   - Prepare sample data

4. **Ongoing:**
   - Document decisions and learnings
   - Update this design doc as needed
   - Track progress with TodoWrite tool

---

## Appendix

### Useful Commands

```bash
# Setup admin user (run once)
deno task admin:setup

# Start development server
deno task dev

# Migrate posts from filesystem to KV
deno task migrate:posts

# Export post from KV to markdown
deno task export:post --slug="my-post"

# Clear KV data (testing only)
deno task kv:clear

# Run tests
deno task test

# Type check
deno task check
```

### File Structure Overview

```
blogo/
├── content/
│   └── posts/              # Existing markdown posts (read-only)
├── public/
│   ├── css/
│   │   ├── main.css        # Existing: Public styles
│   │   └── admin.css       # NEW: Admin styles
│   └── js/
│       └── admin/          # NEW: Admin client scripts
│           ├── editor.js
│           └── markdown-converter.js
├── scripts/
│   ├── setup-admin.ts      # NEW: Create admin user
│   ├── migrate-posts.ts    # NEW: Migrate to KV
│   └── export-post.ts      # NEW: Export from KV
├── src/
│   ├── app/
│   │   └── main.ts         # Entry point (updated)
│   ├── components/
│   │   ├── admin/          # NEW: Admin components
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   ├── PostEditor.tsx
│   │   │   └── PostList.tsx
│   │   └── ...             # Existing public components
│   ├── domain/
│   │   ├── auth.ts         # NEW: Authentication logic
│   │   ├── admin-content.ts # NEW: Admin content service
│   │   └── content.ts      # Existing: Public content service
│   ├── http/
│   │   ├── admin-routes.tsx # NEW: Admin routes
│   │   ├── middleware.ts   # Updated: Add requireAuth
│   │   └── routes.tsx      # Existing: Public routes
│   ├── lib/
│   │   └── types.ts        # Updated: Add KvPost, User, Session
│   └── ports/
│       └── kv.ts           # NEW: KV store interface
├── ADMIN_DESIGN.md         # This document
└── deno.json               # Updated: Add dependencies and tasks
```

---

**End of Design Document**
