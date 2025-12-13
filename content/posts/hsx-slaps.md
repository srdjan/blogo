---
title: "CSS-Only UI Components: A Kanban Board Without JavaScript"
date: 2025-12-10
tags: [CSS, HTML, Web Components, HTMX, No-Framework]
excerpt: An honest look at hsx-ui - a framework-free CSS component library that uses :has() selectors and data attributes to build interactive UIs without a single line of JavaScript framework code.
---

# CSS-Only UI Components: A Kanban Board Without JavaScript

Look at this CSS selector:

```css
[data-board]:not(:has([data-toggle="show-done"] input:checked))
  [data-column][data-column-type="done"] {
  display: none;
}
```

This hides the "Done" column when a checkbox is unchecked. No JavaScript. No event listeners. No state management library. Just CSS reacting to a checkbox.

To me is interesting that we're in 2025 and this approach actually works in production. The `:has()` selector - sometimes called the "parent selector" - landed in all major browsers, and it changes everything about what CSS can do.

I've been working on hsx-ui, a component library that takes this idea seriously. Framework-free. SSR-first. Data-attribute-driven. Here's what I learned about the strengths and limitations of this approach.

## The Core Idea

Instead of JavaScript managing UI state, hsx-ui uses HTML form elements and CSS `:has()` selectors:

```html
<label data-toggle="show-done">
  <input type="checkbox" checked />
  <span>Show Done</span>
</label>
```

```css
/* When checkbox is unchecked, hide done column */
[data-board]:not(:has([data-toggle="show-done"] input:checked))
  [data-column][data-column-type="done"] {
  display: none;
}
```

The checkbox holds state. CSS reads it. No JavaScript required for the toggle behavior.

This extends to card selection (radio inputs), filters (radio groups), focus modes, density controls - all driven by native form elements that CSS can query.

## What Works Beautifully

### Semantic HTML That Actually Means Something

Cards use `<article>`. Columns use `<section>`. Navigation uses `<nav>`. Headers use `<header>`. This isn't just ceremony - it creates a clear DOM structure that screen readers understand without extra ARIA markup:

```html
<section data-column data-column-type="maybe" aria-label="Maybe column">
  <header>
    <h2>Maybe? <span data-column-count>14</span></h2>
  </header>
  <ol>
    <li><label><input type="radio" name="selected-card" hidden />
      <article data-card data-status="investigating">
        <h3>Keyboard shortcut to move cards</h3>
      </article>
    </label></li>
  </ol>
</section>
```

### Component Scoping Without Shadow DOM

Data attributes define component boundaries. Descendant selectors handle the rest:

```css
/* Card root gets the data attribute */
[data-card] { ... }

/* Children styled via descendant selectors */
[data-card] > header { ... }
[data-card] h3 { ... }
[data-card] footer { ... }
```

A `<header>` inside `[data-card]` won't affect `<header>` inside `[data-layout]`. You get encapsulation without the complexity of Web Components.

### Zero Build Step

There's no bundler. No npm scripts. No compilation. You open HTML files in a browser. You edit CSS files and refresh. I explored this for months and the simplicity is surprisingly liberating.

```html
<link rel="stylesheet" href="css/hsx-foundation.css" />
<link rel="stylesheet" href="css/hsx-board.css" />
<link rel="stylesheet" href="css/hsx-card.css" />
```

### Container Queries for Real Responsive Design

The board responds to its own width, not the viewport:

```css
[data-board] {
  container-name: hsx-board;
  container-type: inline-size;
}

@container hsx-board (min-width: 60ch) {
  [data-board] > header {
    flex-direction: row;
    justify-content: space-between;
  }
}
```

This means the same board component works in a full-width layout or squeezed into a sidebar - it adapts to its container.

### OKLCH Color System

Colors use OKLCH primitives with semantic derivation:

```css
:root {
  --lch-blue: 54% 0.15 255;
  --color-link: oklch(var(--lch-blue));
  --color-link-hover: oklch(from var(--color-link) calc(l + 0.1) c h);
}
```

The `color-mix()` function creates hierarchies automatically:

```css
--text-muted: color-mix(in srgb, var(--color-ink) 50%, var(--color-canvas));
--text-subtle: color-mix(in srgb, var(--color-ink) 65%, var(--color-canvas));
```

Change one primitive, and the whole theme updates consistently.

## Real Talk: The Tradeoffs

### Browser Support Is the Elephant in the Room

`:has()` shipped in Safari 15.4 (March 2022), Chrome 105 (August 2022), and Firefox 121 (December 2023). That's... recent. If you need to support older browsers, this approach simply won't work. No polyfill exists for `:has()`.

The experimental CSS `@function` used for utilities like `--tint()` and `--shade()`? That's Chrome 141+ only. Essentially cutting-edge.

### Complex Selectors Get Unwieldy

This selector is readable:

```css
[data-card][data-golden] { ... }
```

This one requires careful thought:

```css
[data-board]:has([data-toggle="focus"] input:checked):has([data-column][data-expanded])
  [data-column]:not([data-expanded]) {
  opacity: 0.5;
}
```

When you chain multiple `:has()` conditions, specificity becomes hard to reason about. I found myself adding comments to explain what each selector does - a sign that CSS is being asked to do more than it was designed for.

### State Is Scattered Across the DOM

With React or Vue, state lives in one place. With hsx-ui, state is distributed across form inputs scattered throughout the markup. Want to know if the "Done" column is visible? Find the checkbox. Want to know which card is selected? Find the checked radio button.

This means server-side rendering is trivial (just render the right `checked` attributes), but debugging client-side state requires DOM inspection rather than Redux DevTools.

### Limited Scope by Design

hsx-ui builds kanban boards and layouts. That's it. If you need a date picker, autocomplete, or drag-and-drop, you're bringing your own JavaScript anyway. This isn't a general-purpose component library - it's a specialized toolkit for a specific UI pattern.

### Theme Code Duplication

Look at this pattern repeated in the foundation:

```css
/* Explicit light theme */
:root[data-theme="light"] {
  --lch-canvas: 97% 0.012 85;
  /* ... all the light tokens ... */
}

/* System preference: light */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --lch-canvas: 97% 0.012 85;
    /* ... identical tokens ... */
  }
}
```

The same values appear twice - once for explicit `data-theme` override, once for system preference fallback. This works but violates DRY. CSS preprocessors could help, but that reintroduces a build step.

## Constructive Feedback (As a Reviewer)

If I'm reviewing this library, here's what I'd suggest:

**1. Add a browser support section prominently.** Someone will try this in IE11 or older Firefox and blame the library when it fails. Be upfront.

**2. Consider providing a `.no-has` fallback strategy.** Even if it's just documentation on how to detect support and fall back to JavaScript.

**3. The experimental CSS functions are cool but should be clearly marked.** Chrome 141+ is basically "latest Chrome only." Move them to a separate file or behind feature detection.

**4. Documentation needs a "why data attributes?" section.** The pattern is unconventional. Explain the encapsulation benefits, specificity predictability, and framework compatibility story explicitly.

**5. Add accessibility testing.** The semantic HTML is great, but I'd want to see screen reader testing results. Do the `:has()`-based interactions announce properly?

**6. Consider extracting reusable patterns.** The toggle, filter pill, and density control patterns could become their own mini-libraries usable outside the kanban context.

## When This Approach Shines

Use hsx-ui (or this pattern) when:

- You're building server-rendered applications where JavaScript is progressive enhancement
- Your target browsers are modern (2022+)
- You want the simplest possible toolchain
- You're pairing with HTMX for partial page updates
- You value semantic HTML and accessibility defaults

Skip this approach when:

- You need complex client-side state management
- You're targeting older browsers
- You want drag-and-drop, rich text editing, or complex form validation
- You need a full design system, not just board components

## The Verdict

hsx-ui demonstrates that CSS has grown up. `:has()` unlocks patterns that previously required JavaScript. Container queries enable true component-based responsive design. OKLCH and `color-mix()` create coherent color systems.

But "you can" doesn't mean "you should always." The tradeoffs are real: browser support, selector complexity, scattered state. For new projects targeting modern browsers with server-first rendering, this approach is worth considering. For existing applications with IE11 users, it's a non-starter.

This means... the future of CSS is interesting. We're rediscovering what the platform can do when we stop reaching for JavaScript as the first tool. hsx-ui is one experiment in that direction. It won't replace React for complex SPAs, but for the surprisingly large category of "pages with interactive bits," it's a compelling alternative.

I'll take the simplicity of opening an HTML file and refreshing the browser over configuring Webpack any day. Even if it means writing selectors that look like small programs.

---

*hsx-ui is framework-free, SSR-first, and available for anyone who wants to explore the CSS-only approach. Perfect for a Sunday afternoon experiment with a good espresso.*
