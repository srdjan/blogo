---
title: Exploring Component Architecture with ui-lib
date: 2025-09-22
tags: [Web, Development, HTMX, Typescript, SSR, Research]
excerpt: Investigating server-side rendered pages with progressive enhancement, exploring whether DOM-native state management and token-based components could simplify web application architecture.
---

I've been observing how the web development landscape has evolved from simple HTML pages to intricate client-side applications requiring megabytes of JavaScript, complex state management, and elaborate hydration processes. This progression raises questions I keep wondering about: does this complexity truly serve the web platform's actual capabilities?

**ui-lib** is my exploration of a different approach to building web applications—one that reconsiders common patterns in modern component architecture.

## Examining the Current Web Development Stack

As I investigated modern web development, I noticed a typical stack follows this pattern:

1. Server renders HTML (sometimes)
2. Client downloads large JavaScript bundles
3. Framework hydrates the DOM (expensive operation)
4. State lives in JavaScript memory (fragile)
5. Components manage their own styling (complex)

What I've observed is how this approach creates several challenges:

- **Performance bottlenecks**: Hydration can take hundreds of milliseconds
- **Fragile state**: Page refreshes lose state
- **Bundle bloat**: Simple apps require hundreds of KB of JavaScript
- **Accessibility gaps**: Interactive elements often bypass native browser behaviors
- **Styling conflicts**: CSS-in-JS and component styles create unpredictable cascades

## Investigating DOM-Native Architecture

As I explored alternatives, I wondered: what if we used a different approach? Instead of treating the DOM as merely a rendering target, what if we used the DOM as the primary source of truth for application state? Here are the core principles I've been investigating:

### 1. State Lives in the DOM, Not JavaScript Memory

What I discovered is an interesting alternative: instead of maintaining state in JavaScript objects that need to be synced with the DOM, what if we stored state directly in DOM attributes, CSS properties, and element content?

```javascript
// Traditional approach: State in JS memory
const [cartCount, setCartCount] = useState(0);

// ui-lib approach: State in DOM
document.documentElement.style.setProperty('--cart-count', '3');
cartElement.setAttribute('data-cart-count', '3');
```

What I found compelling about this approach are the potential benefits:
- **Zero hydration cost**: State is already present in server-rendered HTML
- **Persistent across refreshes**: DOM state survives page reloads
- **Instantly accessible**: CSS can react to state changes without JavaScript
- **Cross-tab synchronization**: LocalStorage updates can sync DOM state

### 2. Three-Tier Reactivity System

As I investigated further, I explored implementing a reactivity system with three performance tiers:

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

What I discovered is that this tiered approach means visual updates can happen instantly via CSS, while more complex reactions can use progressively slower but more powerful mechanisms.

### 3. Token-Based Component Sealing

What I find particularly interesting is the token-based component system I've been exploring. Components are sealed—you cannot access their internal implementation. Instead, they expose a typed interface of CSS custom properties for customization.

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

What I've come to appreciate about this approach are the potential benefits:
- **Strong encapsulation**: No internal implementation leakage
- **Type-safe customization**: Full TypeScript inference for all tokens
- **Consistent theming**: Unified token system across all components
- **Zero runtime overhead**: Tokens compile to CSS custom properties

### 4. Server-Side First, Progressive Enhancement

What I discovered is that ui-lib components are functions that return HTML strings. They render completely on the server, work without JavaScript, and can be progressively enhanced with HTMX or lightweight client-side code.

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

What I found is that the component works immediately when the HTML loads. HTMX adds progressive enhancement for dynamic updates without requiring a client-side framework.

## Exploring a Real-World Example: Shopping Cart Demo

To demonstrate these principles, I built a complete e-commerce application using ui-lib. Here's what I found interesting about it:

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

What I discovered this means:
- The cart badge updates instantly without JavaScript
- The count persists across page refreshes
- Other components can react to cart changes
- Cross-tab synchronization works automatically

### Token-Based Product Cards

What I found interesting is that product cards are sealed but highly customizable:

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

What I discovered is that the tokens compile to CSS custom properties, providing instant visual updates and consistent theming across the entire application.

### Progressive Enhancement with HTMX

What I found compelling is how forms work immediately, then HTMX adds dynamic behavior:

```html
<form hx-post="/api/cart/add" hx-target="#cart-summary">
  <button type="submit">Add to Cart</button>
</form>
```

What I appreciate is that if JavaScript fails to load, the form still submits normally. When HTMX loads, it adds smooth AJAX updates.

## Examining Performance Characteristics

As I measured the shopping cart demo, I observed these performance characteristics:

- **SSR rendering**: ~0.5ms per component
- **Zero hydration cost**: Works immediately when HTML loads
- **Client bundle**: <10KB total for all enhancements
- **First paint**: Sub-100ms on most connections
- **Interaction ready**: Immediately (forms work without JS)

What strikes me when comparing this to typical React applications that require:
- 50-500KB bundle sizes
- 100-1000ms hydration time
- Complex state synchronization
- Framework-specific debugging tools

## Investigating Developer Experience

What I've discovered is that despite its different architecture, ui-lib provides a solid developer experience:

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

What I found interesting is that despite the different architecture, ui-lib uses familiar patterns:

```typescript
// Looks like React, renders on server
const TodoApp = ({ todos }: { todos: Todo[] }) => (
  <div class="todo-app">
    <h1>My Todos</h1>
    {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
  </div>
);
```

## Examining Use Cases and Tradeoffs

As I've explored ui-lib, I've found it works well in several scenarios:

### Strong Fit:

- Content-heavy sites needing interactivity (blogs, documentation, e-commerce)
- Progressive web apps requiring offline functionality
- Performance-critical applications (mobile, low-bandwidth)
- Accessible applications (government, healthcare, education)
- Server-side rendered applications with dynamic features

### Limited Fit:

- Highly interactive SPAs (complex dashboards, games, design tools)
- Real-time collaborative applications (Google Docs, Figma)
- Applications requiring complex client-side routing

## Questions Worth Exploring

As I continue investigating this space, I'm curious about several possibilities:

- Could DOM-native state management enable simpler architectures for most web applications?
- Might token-based component sealing create more maintainable design systems?
- Would this approach scale to larger teams and more complex applications?
- How might progressive enhancement evolve with continued browser API improvements?
- Could similar patterns apply to mobile or desktop application frameworks?

What I've discovered through exploring ui-lib is a return to web fundamentals while maintaining modern developer ergonomics. This approach suggests interesting possibilities:

- DOM as state manager
- CSS handling most reactivity
- JavaScript enhancing rather than controlling
- Truly portable components
- Built-in performance rather than optimization afterthoughts

## Getting Started

The ui-lib repository provides working examples:

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

What I find valuable about the shopping cart demo is that it showcases the major features I've been exploring:
- Token-based components
- DOM-native state management
- Three-tier reactivity
- Progressive enhancement with HTMX
- Complete e-commerce flow

## Exploring a Path Forward

What I've discovered is that using the DOM's native capabilities and rethinking state and component management might create a path to simpler, faster, more accessible web applications.

Modern browsers provide comprehensive APIs for state management, styling, and interactivity. What I'm investigating with ui-lib is whether these capabilities can create a development experience that's both capable and approachable.

The space for DOM-native architectures remains largely open, and I find it exciting that this approach suggests working with the web platform rather than against it—a direction that could leverage decades of browser evolution while maintaining developer productivity.