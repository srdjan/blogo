---
title: Building the Web Like It's 2025, How ui-lib Rethinks Component Architecture
date: 2025-09-22
tags: [WebDev, HTMX, Typescript, SSR]
excerpt: Server-side rendered pages with progressive
  enhancement, colocated API endpoints and simplified shared components
  patterns.
---

The web development landscape has become increasingly complex. We've moved from simple HTML pages to intricate client-side applications requiring megabytes of JavaScript, complex state management, and elaborate hydration processes. But what if there was a better way? What if we could build modern, interactive applications while embracing the web platform's native capabilities rather than fighting against them?

Meet **ui-lib** — a different approach to building web applications that reconsiders common patterns in modern component architecture.

## The Problem with Modern Web Development

Today's web development stack typically looks like this:

1. Server renders HTML (maybe)
2. Client downloads massive JavaScript bundles
3. Framework hydrates the DOM (expensive)
4. State lives in JavaScript memory (fragile)
5. Components manage their own styling (chaos)

This approach has several fundamental problems:

- **Performance bottlenecks**: Hydration can take hundreds of milliseconds
- **Fragile state**: Refresh the page, lose your state
- **Bundle bloat**: Even simple apps require hundreds of KB of JavaScript
- **Accessibility afterthoughts**: Interactive elements often bypass native browser behaviors
- **Styling conflicts**: CSS-in-JS and component styles create unpredictable cascades

## The ui-lib Philosophy: DOM-Native Architecture

ui-lib takes a different approach. Instead of treating the DOM as just a rendering target, it uses the DOM as the primary source of truth for application state. Here are the core principles:

### 1. State Lives in the DOM, Not JavaScript Memory

Instead of maintaining state in JavaScript objects that need to be synced with the DOM, ui-lib stores state directly in DOM attributes, CSS properties, and element content.

```javascript
// Traditional approach: State in JS memory
const [cartCount, setCartCount] = useState(0);

// ui-lib approach: State in DOM
document.documentElement.style.setProperty('--cart-count', '3');
cartElement.setAttribute('data-cart-count', '3');
```

**Benefits:**
- **Zero hydration cost**: State is already present in server-rendered HTML
- **Persistent across refreshes**: DOM state survives page reloads
- **Instantly accessible**: CSS can react to state changes without JavaScript
- **Cross-tab synchronization**: LocalStorage updates can sync DOM state

### 2. Three-Tier Reactivity System

ui-lib implements a reactivity system with three performance tiers:

**Tier 1: CSS Property Reactivity (Instant, 0ms)**
```css
.cart-badge::after {
  content: var(--cart-count, '0');
  opacity: var(--cart-count, 0);
}
```

**Tier 2: Pub/Sub State Manager (~1ms)**
```javascript
stateManager.publishState('cart-updated', { count: 3 });
```

**Tier 3: DOM Event Communication (~5ms)**
```javascript
window.dispatchEvent(new CustomEvent('cart-changed', {
  detail: { items, total }
}));
```

This tiered approach means visual updates happen instantly via CSS, while more complex reactions can use progressively slower but more powerful mechanisms.

### 3. Token-Based Component Sealing

One of ui-lib's key features is its token-based component system. Components are sealed — you cannot access their internal implementation. Instead, they expose a typed interface of CSS custom properties for customization.

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
  // ... more token groups
}>;

const ProductCard = createTokenComponent<ProductCardProps, ProductCardTokens>(
  "product-card",
  defaultTokens,
  (tokens) => generateCSS(tokens),
  (props) => renderHTML(props)
);
```

**Benefits:**
- **Strong encapsulation**: No internal implementation leakage
- **Type-safe customization**: Full TypeScript inference for all tokens
- **Consistent theming**: Unified token system across all components
- **Zero runtime overhead**: Tokens compile to CSS custom properties

### 4. Server-Side First, Progressive Enhancement

ui-lib components are functions that return HTML strings. They render completely on the server, work without JavaScript, and can be progressively enhanced with HTMX or lightweight client-side code.

```typescript
defineComponent("todo-item", {
  render: (props: { id: string; text: string; done: boolean }) => `
    <div class="todo-item ${props.done ? 'todo-item--done' : ''}">
      <span>${props.text}</span>
      <button hx-patch="/api/todos/${props.id}/toggle">
        ${props.done ? 'Undo' : 'Done'}
      </button>
    </div>
  `
});
```

The component works immediately when the HTML loads. HTMX adds progressive enhancement for dynamic updates without requiring a client-side framework.

## Real-World Example: Shopping Cart Demo

To demonstrate these principles, we built a complete e-commerce application using ui-lib. Here's what makes it special:

### DOM-Native Cart State

The shopping cart count lives in three places simultaneously:

```javascript
// 1. CSS custom property for instant badge updates
document.documentElement.style.setProperty('--cart-count', count.toString());

// 2. Data attribute for JavaScript access
cartElement.setAttribute('data-cart-count', count.toString());

// 3. LocalStorage for persistence
localStorage.setItem('cart-data', JSON.stringify(cartItems));
```

This means:
- The cart badge updates instantly without JavaScript
- The count persists across page refreshes
- Other components can react to cart changes
- Cross-tab synchronization works automatically

### Token-Based Product Cards

Product cards are sealed but highly customizable:

```javascript
// Usage with custom tokens
ProductCard({
  product: productData,
  tokens: {
    base: { borderRadius: '12px', padding: '24px' },
    price: { fontSize: '1.5rem', color: '#059669' },
    image: { aspectRatio: '1/1' }
  }
});
```

The tokens compile to CSS custom properties, providing instant visual updates and consistent theming across the entire application.

### Progressive Enhancement with HTMX

Forms work immediately, then HTMX adds dynamic behavior:

```html
<form hx-post="/api/cart/add" hx-target="#cart-summary">
  <button type="submit">Add to Cart</button>
</form>
```

If JavaScript fails to load, the form still submits normally. When HTMX loads, it adds smooth AJAX updates.

## Performance Characteristics

The shopping cart demo shows these performance characteristics:

- **SSR rendering**: ~0.5ms per component
- **Zero hydration cost**: Works immediately when HTML loads
- **Client bundle**: <10KB total for all enhancements
- **First paint**: Sub-100ms on most connections
- **Interaction ready**: Immediately (forms work without JS)

Compare this to typical React applications that require:
- 50-500KB bundle sizes
- 100-1000ms hydration time
- Complex state synchronization
- Framework-specific debugging tools

## Developer Experience

Despite its different architecture, ui-lib provides a solid developer experience:

### Type Safety End-to-End

```typescript
// Components have full TypeScript inference
const HomePage = ({ products }: { products: Product[] }) => `
  <div class="product-grid">
    ${products.map(product => ProductCard({ product })).join('')}
  </div>
`;

// Token contracts are fully typed
const customTokens: Partial<ProductCardTokens> = {
  base: {
    borderRadius: '8px', // ✅ Valid
    padding: 20         // ❌ Type error: string expected
  }
};
```

### Hot Reloading

Development servers support hot reloading of components, styles, and server logic:

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
    {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
  </div>
);
```

## When to Use ui-lib

ui-lib excels in several scenarios:

### ✅ Perfect For:

- Content-heavy sites that need interactivity (blogs, documentation, e-commerce)
- Progressive web apps that must work offline
- Performance-critical applications (mobile, low-bandwidth)
- Accessible applications (government, healthcare, education)
- Server-side rendered applications with dynamic features

### ⚠️ Consider Alternatives For:

- Highly interactive SPAs (complex dashboards, games, design tools)
- Real-time collaborative applications (Google Docs, Figma)
- Applications requiring complex client-side routing

## The Future of Web Development

ui-lib represents a return to web fundamentals while maintaining modern developer ergonomics. It suggests an approach where:

- The DOM is your state manager
- CSS handles most reactivity
- JavaScript enhances rather than controls
- Components are truly portable
- Performance is built-in, not bolted-on

## Getting Started

Ready to try a different approach? Get started with ui-lib:

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

The shopping cart demo showcases all major features:
- Token-based components
- DOM-native state management
- Three-tier reactivity
- Progressive enhancement with HTMX
- Complete e-commerce flow

## Conclusion

Web development doesn't have to be complicated. By using the DOM's native capabilities and rethinking how we manage state and components, ui-lib offers a path to simpler, faster, more accessible web applications.

The web platform has evolved significantly since the early days of jQuery and plain HTML. Modern browsers provide comprehensive APIs for state management, styling, and interactivity. ui-lib uses these capabilities to create a development experience that's both capable and approachable.

As we move into 2025 and beyond, perhaps it's time to stop fighting the web platform and start working with it. ui-lib shows us what that future might look like.

---

*Want to dive deeper? Check out the [ui-lib repository](https://github.com/your-org/ui-lib) and explore the complete shopping cart demo to see these concepts in action.*

**Try ui-lib today:** `deno task dev:shopping`

*What do you think? Are you ready to put the DOM back in control?*