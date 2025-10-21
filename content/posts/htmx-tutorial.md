---
title: HTMX Patterns for Modern Web Development
date: 2025-04-02
tags: [Web, Development, Typescript, HTMX]
excerpt: Practical patterns emerging from hypermedia-driven development demonstrate how HTMX simplifies web application architecture through HTML-over-the-wire approaches replacing complex JavaScript frameworks.
---

Web development complexity accumulates through framework ecosystems requiring hundreds of dependencies, elaborate build pipelines, and state management solutions exceeding the complexity of problems they address. Simple applications become elaborate engineering projects.

HTMX offers an alternative architectural approach. At 14k minified, the library demonstrates HTML's inherent capabilities while enabling modern application interactivity. The compelling aspect isn't technical specifications—it's how HTMX challenges fundamental assumptions about web architecture by transmitting HTML rather than JSON. Applications retain JSON API capabilities when beneficial, utilizing HTTP Content Negotiation as originally designed.

This architectural shift eliminates client-server serialization complexity while fundamentally simplifying how organizations approach web application development.

## Core Principles of Hypermedia-Driven Architecture

HTMX demonstrates HTML's capability to handle AJAX requests, CSS transitions, WebSockets, and Server-Sent Events through declarative attributes. Rather than managing client-side state or implementing virtual DOM reconciliation, applications trigger HTTP requests and swap HTML responses directly into the DOM.

This approach provides an alternative to JSON API architectures and client-side rendering complexity that have dominated web development.

## Implementation Patterns

Organizations building applications with HTMX discover patterns that consistently deliver results. The following examples utilize TypeScript and Deno to demonstrate these patterns in practice.

### Progressive Form Enhancement

HTMX enables forms functioning correctly without JavaScript while enhancing them with AJAX capabilities when available. This approach ensures form functionality regardless of JavaScript execution, addressing reliability concerns in diverse deployment environments.

Implementation begins with type definitions and validation logic:

```typescript
// routes/contact.tsx
import { render } from "mono-jsx";
import { match } from "ts-pattern";

type ContactForm = {
  name: string;
  email: string;
  message: string;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };
```

The validation function uses a functional approach with Result types instead of throwing exceptions:

```typescript
const validateContact = (formData: FormData): ValidationResult<ContactForm> => {
  const data = {
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    message: formData.get("message")?.toString() ?? "",
  };

  const errors: Record<string, string> = {};
  
  if (!data.name.trim()) errors.name = "Name is required";
  if (!data.email.includes("@")) errors.email = "Valid email is required";
  if (data.message.length < 10) errors.message = "Message must be at least 10 characters";

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data };
};
```

The form component demonstrates the key insight: it's a normal HTML form first, with HTMX attributes added for enhancement:

```typescript
const ContactForm = ({ errors = {} }: { errors?: Record<string, string> }) => (
  <form 
    method="post" 
    action="/contact"        // Works without JavaScript
    hx-post="/contact"       // HTMX enhancement
    hx-target="#form-container"
    hx-swap="outerHTML"
  >
    <div id="form-container">
      <div>
        <label htmlFor="name">Name</label>
        <input 
          type="text" 
          name="name" 
          id="name"
          required
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>
      
      <div>
        <label htmlFor="email">Email</label>
        <input 
          type="email" 
          name="email" 
          id="email"
          required
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      
      <div>
        <label htmlFor="message">Message</label>
        <textarea 
          name="message" 
          id="message"
          required
          aria-invalid={errors.message ? "true" : "false"}
        />
        {errors.message && <span className="error">{errors.message}</span>}
      </div>
      
      <button type="submit">
        Send Message
        <span className="htmx-indicator">Sending...</span>
      </button>
    </div>
  </form>
);
```

The handler uses pattern matching to serve both regular HTTP requests and HTMX requests with the same logic:

```typescript
export const handler = async (req: Request): Promise<Response> => {
  return match(req.method)
    .with("GET", async () => {
      const html = await render(<ContactForm />);
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    })
    .with("POST", async () => {
      const formData = await req.formData();
      const validation = validateContact(formData);
      
      if (!validation.success) {
        // Return form with errors - works for both regular and HTMX requests
        const html = await render(<ContactForm errors={validation.errors} />);
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      
      // Process successful submission
      console.log("New contact:", validation.data);
      
      const successHtml = await render(
        <div id="form-container" className="success">
          <h3>Thank you!</h3>
          <p>Your message has been sent successfully.</p>
        </div>
      );
      
      return new Response(successHtml, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    })
    .otherwise(() => new Response("Method Not Allowed", { status: 405 }));
};
```

This pattern demonstrates that the same server logic handles both traditional form submissions and HTMX requests. The enhancement is truly progressive.

### 2. Live Search Implementation

Building real-time search traditionally requires complex debouncing logic and state management. HTMX enables implementing this pattern declaratively with just a few attributes.

The key insight is using a delay trigger to wait for users to stop typing:

First, I define the search types and mock search function:

```typescript
// routes/search.tsx
import { render } from "mono-jsx";

type SearchResult = {
  id: string;
  title: string;
  description: string;
  url: string;
};

const mockSearch = async (query: string): Promise<SearchResult[]> => {
  // Simulate realistic API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (!query.trim()) return [];
  
  return [
    {
      id: "1",
      title: `Result for "${query}"`,
      description: "This is a sample search result description",
      url: `/article/${query.toLowerCase()}`
    },
    {
      id: "2", 
      title: `Another "${query}" result`,
      description: "Another sample description with more details",
      url: `/guide/${query.toLowerCase()}`
    }
  ].filter(result => 
    result.title.toLowerCase().includes(query.toLowerCase())
  );
};
```

The results component is straightforward - it just renders a list:

```typescript
const SearchResults = ({ results }: { results: SearchResult[] }) => (
  <div id="search-results">
    {results.length === 0 ? (
      <p>No results found</p>
    ) : (
      <ul>
        {results.map(result => (
          <li key={result.id}>
            <h4>
              <a href={result.url}>{result.title}</a>
            </h4>
            <p>{result.description}</p>
          </li>
        ))}
      </ul>
    )}
  </div>
);
```

The magic happens in the search input. Notice the `hx-trigger` attribute:

```typescript
const SearchInterface = () => (
  <section>
    <h2>Search</h2>
    <form>
      <input
        type="search"
        name="q"
        placeholder="Search articles..."
        hx-get="/search"
        hx-trigger="keyup changed delay:300ms"  // The key to debouncing
        hx-target="#search-results"
        hx-indicator="#search-spinner"
        autocomplete="off"
      />
      <span id="search-spinner" className="htmx-indicator">Searching...</span>
    </form>
    <SearchResults results={[]} />
  </section>
);
```

This single attribute replaces what traditionally requires custom JavaScript debouncing logic.

The handler demonstrates a common pattern - serving different content based on whether it's an HTMX request:

```typescript
export const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  
  // Return full page for direct access
  if (!req.headers.get("HX-Request")) {
    const html = await render(<SearchInterface />);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  
  // Return partial results for HTMX requests
  const results = await mockSearch(query);
  const html = await render(<SearchResults results={results} />);
  
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
};
```

This approach ensures the search page works with or without JavaScript, while providing enhanced functionality when HTMX is available.

### 3. Infinite Scroll Pattern

Infinite scroll traditionally involves viewport calculations, scroll event listeners, and performance throttling. HTMX simplifies this significantly by recognizing that infinite scroll is essentially "click to load" that triggers when an element becomes visible.

The `revealed` trigger handles all viewport detection logic automatically.

```typescript
// routes/posts.tsx
import { render } from "mono-jsx";

type Post = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
};

const generatePosts = (page: number, limit: number): Post[] => {
  return Array.from({ length: limit }, (_, i) => {
    const id = (page - 1) * limit + i + 1;
    return {
      id: id.toString(),
      title: `Post Title ${id}`,
      excerpt: `This is the excerpt for post ${id}. It contains interesting content about various topics.`,
      author: `Author ${id % 5 + 1}`,
      publishedAt: new Date(Date.now() - id * 86400000).toLocaleDateString()
    };
  });
};

const PostCard = ({ post }: { post: Post }) => (
  <article className="post-card">
    <h3>{post.title}</h3>
    <p>{post.excerpt}</p>
    <footer>
      <span>By {post.author}</span>
      <time>{post.publishedAt}</time>
    </footer>
  </article>
);

const LoadMoreTrigger = ({ page, hasMore }: { page: number; hasMore: boolean }) => {
  if (!hasMore) {
    return <p>No more posts to load.</p>;
  }

  return (
    <div 
      hx-get={`/posts?page=${page + 1}`}
      hx-trigger="revealed"
      hx-target="this"
      hx-swap="outerHTML"
      className="load-trigger"
    >
      <p>Loading more posts...</p>
    </div>
  );
};

export const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 10;
  
  const posts = generatePosts(page, limit);
  const hasMore = page < 10; // Simulate finite data
  
  // For HTMX requests, return only the new posts and trigger
  if (req.headers.get("HX-Request")) {
    const html = await render(
      <>
        {posts.map(post => <PostCard key={post.id} post={post} />)}
        <LoadMoreTrigger page={page} hasMore={hasMore} />
      </>
    );
    
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  
  // For direct access, return full page
  const html = await render(
    <main>
      <div id="posts-container">
        {posts.map(post => <PostCard key={post.id} post={post} />)}
        <LoadMoreTrigger page={page} hasMore={hasMore} />
      </div>
    </main>
  );
  
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
};
```

### 4. Inline Editing Pattern

Building admin panels traditionally involves managing edit modes, form states, and complex UI transitions. HTMX offers a simpler approach - swapping between display and edit modes using HTML fragments:

```typescript
// components/editable-field.tsx
import { render } from "mono-jsx";
import { match } from "ts-pattern";

type EditableFieldProps = {
  id: string;
  value: string;
  fieldName: string;
  editing?: boolean;
};

const EditableField = ({ id, value, fieldName, editing = false }: EditableFieldProps) => {
  if (editing) {
    return (
      <form 
        hx-put={`/api/update/${id}/${fieldName}`}
        hx-target={`#field-${id}-${fieldName}`}
        hx-swap="outerHTML"
      >
        <input 
          type="text" 
          name="value" 
          value={value}
          autoFocus
          required
        />
        <button type="submit">Save</button>
        <button 
          type="button"
          hx-get={`/api/field/${id}/${fieldName}`}
          hx-target={`#field-${id}-${fieldName}`}
          hx-swap="outerHTML"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div id={`field-${id}-${fieldName}`}>
      <span>{value}</span>
      <button 
        hx-get={`/api/field/${id}/${fieldName}/edit`}
        hx-target={`#field-${id}-${fieldName}`}
        hx-swap="outerHTML"
        className="edit-btn"
        aria-label={`Edit ${fieldName}`}
      >
        ✏️
      </button>
    </div>
  );
};

// API handler for field updates
export const fieldHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const [, , , id, fieldName, action] = pathParts;
  
  return match({ method: req.method, action })
    .with({ method: "GET", action: "edit" }, async () => {
      const currentValue = await getCurrentValue(id, fieldName);
      const html = await render(
        <EditableField 
          id={id} 
          value={currentValue} 
          fieldName={fieldName} 
          editing={true} 
        />
      );
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    })
    .with({ method: "GET", action: undefined }, async () => {
      const currentValue = await getCurrentValue(id, fieldName);
      const html = await render(
        <EditableField 
          id={id} 
          value={currentValue} 
          fieldName={fieldName} 
        />
      );
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    })
    .with({ method: "PUT", action: undefined }, async () => {
      const formData = await req.formData();
      const newValue = formData.get("value")?.toString() ?? "";
      
      // Update the value in your data store
      await updateValue(id, fieldName, newValue);
      
      const html = await render(
        <EditableField 
          id={id} 
          value={newValue} 
          fieldName={fieldName} 
        />
      );
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    })
    .otherwise(() => new Response("Not Found", { status: 404 }));
};

// Mock data functions
const getCurrentValue = async (id: string, fieldName: string): Promise<string> => {
  return `Current ${fieldName} value for ${id}`;
};

const updateValue = async (id: string, fieldName: string, value: string): Promise<void> => {
  console.log(`Updated ${fieldName} for ${id} to: ${value}`);
};
```

### 5. File Upload with Progress

File uploads present common challenges - progress bars, error handling, drag-and-drop functionality. HTMX provides a more elegant approach to these requirements:

```typescript
// routes/upload.tsx
import { render } from "mono-jsx";

const FileUploadForm = ({ uploadId }: { uploadId?: string }) => (
  <form 
    hx-post="/upload"
    hx-target="#upload-result"
    hx-swap="innerHTML"
    hx-encoding="multipart/form-data"
    hx-indicator="#upload-progress"
  >
    <div>
      <label htmlFor="file">Select file:</label>
      <input 
        type="file" 
        name="file" 
        id="file"
        accept="image/*,.pdf,.doc,.docx"
        required
      />
    </div>
    
    <button type="submit">Upload File</button>
    
    <div id="upload-progress" className="htmx-indicator">
      <progress value="0" max="100">Uploading...</progress>
      <span>Uploading file...</span>
    </div>
    
    <div id="upload-result"></div>
  </form>
);

export const uploadHandler = async (req: Request): Promise<Response> => {
  if (req.method === "GET") {
    const html = await render(<FileUploadForm />);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  
  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      
      if (!file) {
        const errorHtml = await render(
          <div className="error">
            <p>No file selected</p>
          </div>
        );
        return new Response(errorHtml, {
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      
      // Simulate file processing
      const uploadId = crypto.randomUUID();
      const fileSize = file.size;
      const fileName = file.name;
      
      // Save file (in real app, you'd save to storage)
      console.log(`Uploading ${fileName} (${fileSize} bytes)`);
      
      const successHtml = await render(
        <div className="success">
          <h3>Upload Successful!</h3>
          <p>File: {fileName}</p>
          <p>Size: {Math.round(fileSize / 1024)} KB</p>
          <p>Upload ID: {uploadId}</p>
          <button 
            hx-get="/upload"
            hx-target="#upload-container"
            hx-swap="innerHTML"
          >
            Upload Another File
          </button>
        </div>
      );
      
      return new Response(successHtml, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
      
    } catch (error) {
      const errorHtml = await render(
        <div className="error">
          <p>Upload failed: {error.message}</p>
        </div>
      );
      return new Response(errorHtml, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }
  }
  
  return new Response("Method Not Allowed", { status: 405 });
};
```

### 6. Real-Time Updates with Server-Sent Events

Real-time features traditionally require WebSocket complexity or polling solutions. HTMX extensions enable Server-Sent Events as a simpler alternative for many use cases:

```typescript
// routes/notifications.tsx
import { render } from "mono-jsx";

const NotificationCenter = () => (
  <div 
    hx-ext="sse"
    sse-connect="/events"
    sse-swap="notification"
    hx-target="#notifications"
    hx-swap="afterbegin"
  >
    <h2>Live Notifications</h2>
    <div id="notifications" className="notification-list">
      <p>Waiting for notifications...</p>
    </div>
  </div>
);

const NotificationItem = ({ 
  message, 
  type = "info", 
  timestamp 
}: { 
  message: string; 
  type?: "info" | "success" | "warning" | "error"; 
  timestamp: string; 
}) => (
  <div className={`notification notification-${type}`}>
    <span className="message">{message}</span>
    <time className="timestamp">{timestamp}</time>
    <button 
      hx-delete="/notifications"
      hx-target="closest .notification"
      hx-swap="outerHTML"
      className="close-btn"
      aria-label="Dismiss notification"
    >
      ×
    </button>
  </div>
);

export const notificationHandler = async (req: Request): Promise<Response> => {
  if (req.method === "GET") {
    const html = await render(<NotificationCenter />);
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  
  return new Response("Method Not Allowed", { status: 405 });
};

export const eventsHandler = async (_req: Request): Promise<Response> => {
  const body = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(`data: <div class="notification notification-success">
        <span class="message">Connected to live updates</span>
        <time class="timestamp">${new Date().toLocaleTimeString()}</time>
      </div>\n\n`);
      
      // Simulate periodic notifications
      const interval = setInterval(() => {
        const notifications = [
          "New user registered",
          "Order #1234 completed", 
          "System backup started",
          "New comment on your post",
          "Weekly report is ready"
        ];
        
        const message = notifications[Math.floor(Math.random() * notifications.length)];
        const types = ["info", "success", "warning"] as const;
        const type = types[Math.floor(Math.random() * types.length)];
        
        const notificationHtml = `<div class="notification notification-${type}">
          <span class="message">${message}</span>
          <time class="timestamp">${new Date().toLocaleTimeString()}</time>
          <button 
            hx-delete="/notifications"
            hx-target="closest .notification"
            hx-swap="outerHTML"
            class="close-btn"
            aria-label="Dismiss notification"
          >×</button>
        </div>`;
        
        controller.enqueue(`event: notification\ndata: ${notificationHtml}\n\n`);
      }, 5000);
      
      // Clean up on disconnect
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 60000); // Close after 1 minute for demo
    }
  });
  
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};
```

## Valuable HTMX Extensions

HTMX's extension system proves useful for specific use cases. Core extensions like head-support, idiomorph, and preload solve common performance and functionality challenges.

### Preload Extension for Performance

The preload extension significantly improves perceived performance by starting resource loading when users press mouse down, giving the server a head start over regular clicks:

```html
<script src="https://unpkg.com/htmx.org@2.0.0/dist/ext/preload.js"></script>

<div hx-ext="preload">
  <a href="/dashboard" preload="mousedown">Dashboard</a>
  <a href="/reports" preload="mouseover">Reports</a>
</div>
```

## Best Practices and Patterns

### 1. Type-Safe Request Handlers

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type RouteHandler = (req: Request) => Promise<Response>;

const createRoute = (handlers: Partial<Record<HttpMethod, RouteHandler>>): RouteHandler => {
  return async (req: Request): Promise<Response> => {
    const handler = handlers[req.method as HttpMethod];
    
    if (!handler) {
      return new Response("Method Not Allowed", { status: 405 });
    }
    
    return handler(req);
  };
};

// Usage
export const userRoute = createRoute({
  GET: async (req) => { /* get user */ },
  PUT: async (req) => { /* update user */ },
  DELETE: async (req) => { /* delete user */ }
});
```

### 2. HTMX Request Detection

```typescript
const isHtmxRequest = (req: Request): boolean => 
  req.headers.get("HX-Request") === "true";

const getHtmxTrigger = (req: Request): string | null =>
  req.headers.get("HX-Trigger");

const shouldRenderPartial = (req: Request): boolean =>
  isHtmxRequest(req) && !req.headers.get("HX-Boosted");
```

### 3. Progressive Enhancement Utilities

```typescript
const enhanceForm = (formElement: HTMLFormElement) => {
  // Add HTMX attributes programmatically if needed
  if (!formElement.hasAttribute("hx-post")) {
    formElement.setAttribute("hx-post", formElement.action);
    formElement.setAttribute("hx-target", "#form-result");
  }
};

// CSS for progressive enhancement
const progressiveStyles = `
.htmx-indicator { 
  display: none; 
  opacity: 0;
  transition: opacity 0.3s ease;
}
.htmx-request .htmx-indicator { 
  display: inline; 
  opacity: 1;
}
.htmx-swapping {
  opacity: 0.5;
  transition: opacity 150ms ease-out;
}
`;
```

## Performance Considerations

### Efficient DOM Updates

HTMX's approach to partial DOM updates offers several advantages over traditional SPAs:

1. **Smaller bundles**: Applications load faster without heavy JavaScript frameworks
2. **Better SEO**: Server-side rendering means search engines see real content
3. **Efficient updates**: Only the parts that change get replaced in the DOM
4. **Cacheable responses**: HTML fragments cache well at the browser and CDN level

### Memory Management

```typescript
// Clean up resources when elements are swapped out
document.addEventListener("htmx:beforeSwap", (event) => {
  const element = event.target as HTMLElement;
  
  // Clean up event listeners, timers, etc.
  const timers = element.querySelectorAll("[data-timer-id]");
  timers.forEach(timer => {
    const timerId = timer.getAttribute("data-timer-id");
    if (timerId) clearInterval(parseInt(timerId));
  });
});
```

## Testing HTMX Applications

```typescript
// Testing HTMX endpoints
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

Deno.test("Search endpoint returns HTML fragments", async () => {
  const request = new Request("http://localhost/search?q=test", {
    headers: { "HX-Request": "true" }
  });
  
  const response = await searchHandler(request);
  const html = await response.text();
  
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert(html.includes('<div id="search-results">'));
});

Deno.test("Form validation returns errors", async () => {
  const formData = new FormData();
  formData.append("email", "invalid-email");
  
  const request = new Request("http://localhost/contact", {
    method: "POST",
    body: formData,
    headers: { "HX-Request": "true" }
  });
  
  const response = await contactHandler(request);
  const html = await response.text();
  
  assertEquals(response.status, 200);
  assert(html.includes("Valid email is required"));
});
```

## HTMX's Place in Modern Web Development

HTMX provides "high power tools for HTML" that extend the language with capabilities many developers wish it had. The patterns demonstrated here show how sophisticated user experiences don't require complex JavaScript frameworks.

Key advantages of this approach:

- **Progressive enhancement**: Applications work without JavaScript, reducing support complexity
- **Type safety**: Full TypeScript support in server-side rendering enables confident refactoring
- **Performance**: Smaller bundles and efficient updates improve application metrics
- **Maintainability**: Declarative HTML attributes are easier to debug than JavaScript state management
- **Accessibility**: Standard HTML semantics provide accessibility features by default

HTMX echoes jQuery's golden era - stable API, thoughtful feature additions, and respect for web standards. For content-driven applications and form-heavy interfaces, it offers a compelling alternative to SPA frameworks.

The TypeScript patterns and mono-jsx usage for server-side rendering demonstrate how modern type safety and hypermedia simplicity complement each other. This approach enables building robust web applications that work with the web's architecture rather than against it.

For developers tired of JavaScript complexity or building applications where HTML-over-the-wire makes sense, HTMX offers a refreshing perspective on web development.
