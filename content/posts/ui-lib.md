---
title: "DOM-Native Components That Actually Work"
date: 2025-09-22
tags: [Web, Development, HTMX, Typescript, SSR]
excerpt: What if the DOM itself managed your app state? No hydration, no megabyte bundles, instant interactivity. Here's what happens when you treat the browser as a platform instead of a rendering target.
---

Modern web apps ship megabytes of JavaScript for features that could run in pure
HTML and CSS. React hydration takes hundreds of milliseconds. State lives in
JavaScript memory that disappears on refresh. CSS-in-JS creates unpredictable
cascades. And we call this progress.

Here's what bugs me about this: browsers are incredibly capable platforms. They
handle state, styling, and interactivity natively. But we ignore these
capabilities and rebuild everything in JavaScript. What if we stopped fighting
the platform and started using it?

**ui-lib** is my attempt to answer that question—a component architecture that
treats the DOM as a first-class state manager, not just a rendering target.

## The Core Idea: State Lives in the DOM

Traditional React apps store state in JavaScript memory and sync it to the DOM:

```javascript
// State in JS memory
const [cartCount, setCartCount] = useState(0);

// Later: sync to DOM
return <span>{cartCount}</span>;
```

ui-lib flips this completely. State lives in the DOM from the start:

```javascript
// State IS the DOM
document.documentElement.style.setProperty("--cart-count", "3");
cartElement.setAttribute("data-cart-count", "3");
```

Here's the cool part: this eliminates hydration entirely. Server-rendered HTML
arrives with state already present. No JavaScript bundle needs to download,
parse, and "rehydrate" what's already there. The page works immediately.

Look at what this enables:

**Zero hydration cost** - State exists in server-rendered HTML **Survives page
refresh** - DOM state persists naturally **Instant CSS reactivity** - Styles
respond to state without JavaScript **Cross-tab sync** - LocalStorage updates
propagate to DOM automatically

To me is interesting how this inverts the normal React model. Instead of
JavaScript owning state and updating the DOM, the DOM owns state and JavaScript
occasionally modifies it.

## Three Tiers of Reactivity

Not all state updates need the same performance characteristics. ui-lib uses
three tiers:

### Tier 1: CSS Property Reactivity (Instant, 0ms)

```css
.cart-badge::after {
  content: var(--cart-count, "0");
  opacity: calc(min(var(--cart-count, 0), 1));
}
```

The cart badge updates the moment the CSS property changes. Zero JavaScript
execution. The browser handles it natively.

### Tier 2: Pub/Sub State Manager (~1ms)

```javascript
stateManager.publishState("cart-updated", { count: 3 });
```

Components subscribe to state changes through a lightweight pub/sub system. Fast
enough for most interactions, simple enough to debug.

### Tier 3: DOM Event Communication (~5ms)

```javascript
window.dispatchEvent(
  new CustomEvent("cart-changed", {
    detail: { items, total },
  }),
);
```

Full DOM events for complex coordination. Slower but more powerful when you need
it.

This means visual updates happen instantly via CSS, while complex reactions use
progressively slower but more capable mechanisms. You get performance where it
matters without sacrificing power where you need it.

## Token-Based Component Sealing

Components in ui-lib are sealed—you cannot touch their internal implementation.
Instead, they expose a typed interface of CSS custom properties for
customization.

```typescript
export type ProductCardTokens = ComponentTokens<{
  base: {
    width: string;
    padding: string;
    borderRadius: string;
    backgroundColor: string;
  };
  price: {
    fontSize: string;
    fontWeight: string;
    color: string;
  };
}>;

const ProductCard = createTokenComponent<ProductCardProps, ProductCardTokens>(
  "product-card",
  defaultTokens,
  (tokens) => generateCSS(tokens),
  (props) => renderHTML(props),
);
```

Look at what this prevents: internal implementation leakage, style conflicts,
breaking changes to internals. What you get instead: strong encapsulation,
type-safe customization, consistent theming, zero runtime overhead.

The tokens compile to CSS custom properties. Change a token, the style updates
instantly. Full TypeScript inference means you can't pass invalid values. It's
surprisingly elegant.

## Server-Side First, Enhanced Progressively

Components are functions that return HTML strings. They render completely on the
server, work without JavaScript, and can be enhanced with HTMX or lightweight
client code.

```typescript
defineComponent("todo-item", {
  render: (props: { id: string; text: string; done: boolean }) => `
    <div class="todo-item ${props.done ? "todo-item--done" : ""}">
      <span>${props.text}</span>
      <button hx-patch="/api/todos/${props.id}/toggle">
        ${props.done ? "Undo" : "Done"}
      </button>
    </div>
  `,
});
```

The component works immediately when HTML loads. No hydration. No waiting for
JavaScript. HTMX adds smooth AJAX updates as progressive enhancement—but the
core functionality doesn't depend of it.

## Real Example: Shopping Cart

I built a complete e-commerce demo to prove this actually works. The shopping
cart count demonstrates all three reactivity tiers at once.

### DOM-Native Cart State

```javascript
// 1. CSS custom property - instant badge updates
document.documentElement.style.setProperty("--cart-count", count.toString());

// 2. Data attribute - JavaScript access
cartElement.setAttribute("data-cart-count", count.toString());

// 3. LocalStorage - persistence
localStorage.setItem("cart-data", JSON.stringify(cartItems));
```

This means:

- Cart badge updates instantly without JavaScript execution
- Count persists across page refreshes
- Other components react to cart changes
- Cross-tab synchronization works automatically

### Token-Based Product Cards

Product cards are sealed but highly customizable:

```javascript
ProductCard({
  product: productData,
  tokens: {
    base: { borderRadius: "12px", padding: "24px" },
    price: { fontSize: "1.5rem", color: "#059669" },
    image: { aspectRatio: "1/1" },
  },
});
```

The tokens compile to CSS custom properties. Visual updates happen instantly.
TypeScript enforces correct values. Theming stays consistent across the entire
application.

### Progressive Enhancement with HTMX

Forms work immediately, then HTMX adds dynamic behavior:

```html
<form hx-post="/api/cart/add" hx-target="#cart-summary">
  <button type="submit">Add to Cart</button>
</form>
```

If JavaScript fails to load, the form still submits normally. When HTMX loads,
it adds smooth AJAX updates. Baseline functionality never depends on JavaScript
succeeding.

## Performance Numbers

The shopping cart demo delivers:

- **SSR rendering**: ~0.5ms per component
- **Hydration cost**: Zero (no hydration needed)
- **Client bundle**: <10KB total for all enhancements
- **First paint**: Sub-100ms on most connections
- **Interaction ready**: Immediately (forms work without JS)

Compare this to typical React apps:

- 50-500KB bundle sizes
- 100-1000ms hydration time
- Complex state synchronization
- Framework-specific debugging tools

I'll take the trade every time.

## Developer Experience

Despite the different architecture, ui-lib provides solid developer experience:

### Type Safety End-to-End

```typescript
// Components have full TypeScript inference
const HomePage = ({ products }: { products: Product[] }) => `
  <div class="product-grid">
    ${products.map((product) => ProductCard({ product })).join("")}
  </div>
`;

// Token contracts are fully typed
const customTokens: Partial<ProductCardTokens> = {
  base: {
    borderRadius: "8px", // ✅ Valid
    padding: 20, // ❌ Type error: string expected
  },
};
```

### Hot Reloading

Development servers support hot reloading of components, styles, and server
logic:

```bash
deno task dev:shopping  # Auto-reloads on changes
```

### Familiar Patterns

Despite the different architecture, ui-lib uses familiar patterns:

```typescript
// Looks like React, renders on server
const TodoApp = ({ todos }: { todos: Todo[] }) => (
  <div class="todo-app">
    <h1>My Todos</h1>
    {todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
  </div>
);
```

The syntax feels familiar. The mental model shifts from client-side to
server-side, but the code looks surprisingly similar.

## Real Talk: Where This Works and Where It Doesn't

ui-lib shines for:

- **Content-heavy sites needing interactivity** (blogs, docs, e-commerce)
- **Progressive web apps** requiring offline functionality
- **Performance-critical applications** (mobile, low-bandwidth)
- **Accessible applications** (government, healthcare, education)
- **Server-rendered apps** with dynamic features

It falls apart for:

- **Highly interactive SPAs** (complex dashboards, games, design tools)
- **Real-time collaborative apps** (Google Docs, Figma)
- **Apps requiring complex client-side routing**

This isn't a React replacement for everything. It's a different architecture
that trades client-side power for server-side simplicity and instant
performance.

## Getting Started

The repository includes working examples:

```bash
# Clone the repository
git clone https://github.com/your-org/ui-lib
cd ui-lib

# Try the todo app
deno task dev:todo

# Try the shopping cart demo
deno task dev:shopping

# Visit http://localhost:8080
```

The shopping cart demo showcases the major features:

- Token-based components
- DOM-native state management
- Three-tier reactivity
- Progressive enhancement with HTMX
- Complete e-commerce flow

## What This Suggests

Modern browsers provide comprehensive APIs for state management, styling, and
interactivity. ui-lib explores whether these capabilities can create a
development experience that's both capable and simple.

Here's what surprised me: using the DOM's native capabilities doesn't mean
sacrificing developer experience. Type safety, hot reloading, familiar
patterns—all work fine without client-side frameworks.

The tradeoff is real: you lose client-side state flexibility in exchange for
instant performance and simpler architecture. For many applications, that's the
right trade.

I've been using this for my band's website and a few side projects. The lack of
build complexity and instant page loads feel refreshing after years of webpack
and hydration. Not everything needs React's power—sometimes the platform itself
is enough.

The space for DOM-native architectures remains mostly unexplored. What I'm
learning: working with the web platform instead of rebuilding it in JavaScript
creates surprisingly capable applications with a fraction of the complexity.

Worth trying for your next content-driven project. You might be surprised how
little JavaScript you actually need.
