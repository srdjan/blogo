# CSS Architecture Documentation

**Project**: Blogo - Modern Blog System
**CSS File**: `public/css/main.css` (~1800 lines)
**Architecture**: Cascade Layers + Modern CSS Features
**Last Updated**: After Layout Unification & Refactoring

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Cascade Layers](#cascade-layers)
3. [Design Tokens](#design-tokens)
4. [Layout System](#layout-system)
5. [Component Patterns](#component-patterns)
6. [Utility Classes](#utility-classes)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Cascade Layer Strategy

```css
@layer reset, tokens, utilities, layout, components, overrides;
```

**Why this order?**
1. **reset** - Browser normalization (lowest specificity needs)
2. **tokens** - Design system values (no selectors, just custom properties)
3. **utilities** - Reusable single-purpose classes (trumps tokens)
4. **layout** - Page-level structure (trumps utilities)
5. **components** - Semantic component styles (trumps layout)
6. **overrides** - Escape hatch for exceptions (highest priority)

**Key Benefit**: Later layers always win, regardless of selector specificity. This eliminates specificity wars.

---

## Cascade Layers

### 1. Reset Layer

**Purpose**: Browser normalization and box model fixes

**Key Rules**:
```css
@layer reset {
  ul, ol { list-style: none; padding: 0; }
  li { list-style-type: none; }
  * { box-sizing: border-box; }
}
```

**When to add**: Only for true browser resets or normalizations

---

### 2. Tokens Layer

**Purpose**: Design system foundation - all design decisions as CSS custom properties

**Categories**:

#### Typography Scale (Fluid)
```css
--font-size-base: clamp(1.25rem, 1.5rem + -0.15 * (100vw - 20rem) / (80rem - 20rem), 1.5rem);
--font-size-sm: clamp(1.2rem, 1.42rem + ..., 1.42rem);
--font-size-lg: clamp(1.62rem, 1.89rem + ..., 1.89rem);
```

**Why fluid?** Responsive typography without media queries. Font sizes scale smoothly between min (mobile) and max (desktop).

#### Spacing System
```css
--layout-inline-padding: var(--size-4);
--layout-block-spacing: var(--size-6);
--layout-max-width: var(--page-max-width); /* 72rem */
```

#### Colors
```css
--color-text: hsl(0, 0%, 95%);
--color-bg: hsl(0, 0%, 9%);
--color-primary: hsl(201, 100%, 55%);
```

**When to add**: Any value used more than twice across the codebase

---

### 3. Utilities Layer

**Purpose**: Single-purpose, reusable classes (intentionally use `!important`)

**Available Utilities**:

```css
/* Centering */
.u-center-content     /* text-align: center + margin-inline: auto */
.u-center-block       /* margin-inline: auto only */

/* Width */
.u-full-width         /* width: 100% !important + all variants */
.u-max-content-width  /* max-width: var(--content-max-width) */

/* Flexbox */
.u-flex-col-center    /* column flex with centered items */
.u-flex-wrap-center   /* wrapped flex with centered items */
.u-flex-row-center    /* row flex with centered items */
```

**When to use**: For quick layout adjustments that don't warrant a component class

**When NOT to use**: For component-specific styling (use components layer)

---

### 4. Layout Layer

**Purpose**: Page-level structure and positioning

**Key Selectors**:

#### Unified Main Content
```css
main#content-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: var(--layout-max-width);
  margin-inline: auto;
  padding-inline: var(--layout-inline-padding);
  text-align: center;
}
```

**Why this works**:
- `display: flex` + `flex-direction: column` stacks children vertically
- `align-items: center` centers all children horizontally
- `text-align: center` inherited by all descendants
- Children only override when needed (e.g., lists use `text-align: left`)

#### Child Element Rules
```css
main#content-area {
  /* Direct children take full width */
  & > * { width: 100%; }

  /* Lists centered as blocks, left-aligned text */
  & > ul, & > ol {
    text-align: center;
    padding-inline-start: 0;
    list-style-position: inside;
  }

  /* Article content lists need left alignment */
  & > article .content > ul,
  & > article .content > ol {
    display: inline-block;
    text-align: left;
    margin-inline: auto;
  }

  /* Sections add vertical spacing */
  & > section {
    margin-block: var(--layout-block-spacing);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}
```

**When to modify**: Only when changing page-level layout behavior

---

### 5. Components Layer

**Purpose**: Semantic component styling

**Key Components**:

#### Post List
```css
main#content-area > ul {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  container-type: inline-size;

  & > li {
    width: 100%;
    margin-block-end: var(--size-6);

    & > article {
      padding: var(--size-4);
      container-type: inline-size;

      @container (min-width: 30rem) {
        padding: clamp(0.75rem, 3vw, 1.5rem);
      }
    }
  }
}
```

**Container Queries**: Enable responsive styling based on container width, not viewport

#### Tag Lists
```css
ul[role="list"] {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-2);
  /* Inline tag chips */
}

section ul[role="list"] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, max-content));
  /* Tag index grid */
}
```

**When to add**: For new semantic components with reusable patterns

---

### 6. Overrides Layer

**Purpose**: Escape hatch for exceptional cases (use sparingly)

**Current Overrides**:
```css
@layer overrides {
  article ul, article ol, article li {
    font-size: var(--font-size-base);
    line-height: var(--line-height-relaxed);
    letter-spacing: var(--letter-spacing-base);
  }
}
```

**When to use**:
- ✅ Fixing third-party library styles
- ✅ Temporary workarounds pending refactor
- ❌ Regular component styling (use components layer)
- ❌ Fighting your own specificity (refactor instead)

---

## Layout System

### Single Source of Truth: `main#content-area`

**The unified layout**:
```
<main id="content-area">
  <!-- All page content renders here -->
  <!-- Components return fragments, not <main> wrappers -->
</main>
```

**How it works with HTMX**:

1. **Full page load**: Layout.tsx renders `<main id="content-area">{children}</main>`
2. **HTMX swap**: Component returns fragment, HTMX replaces innerHTML of `#content-area`
3. **Result**: Single `<main>` always, no nested elements

### Centering Strategy

**Philosophy**: Center by default, override where needed

```css
/* Parent sets centering */
main#content-area {
  text-align: center;
  align-items: center;
}

/* Children inherit, override if needed */
& > ul {
  text-align: center; /* Inherits from parent */
  list-style-position: inside; /* Bullets inside text flow */
}

& > article .content > ul {
  text-align: left; /* Article content lists need left align */
}
```

### Responsive Strategy

**Fluid Typography** (no media queries needed):
```css
font-size: clamp(min, preferred, max);
/* Scales smoothly between viewport widths */
```

**Container Queries** (component-level responsiveness):
```css
main#content-area > ul > li > article {
  container-type: inline-size;

  @container (min-width: 30rem) {
    padding: clamp(0.75rem, 3vw, 1.5rem);
  }
}
```

**Media Queries** (layout-level breakpoints only):
```css
@media (min-width: 48rem) {
  nav, main, footer {
    max-width: var(--layout-max-width);
  }
}
```

---

## Component Patterns

### Pattern 1: Tag Chips

**Markup**:
```tsx
<nav class="tags" aria-label="Post tags">
  <a class="tag" href="/tags/foo">foo</a>
  <a class="tag" href="/tags/bar">bar</a>
</nav>
```

**CSS**:
```css
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--size-1);
  justify-content: center;
}

.tag {
  font-family: var(--font-mono);
  padding: 0.15rem 0.5rem;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 0.75rem;
  /* Small, subtle chip appearance */
}
```

### Pattern 2: Article Cards (in Lists)

**Markup**:
```tsx
<ul>
  <li>
    <article>
      <h2><a href="/posts/slug">Title</a></h2>
      <time>Date</time>
      <p>Excerpt</p>
      <nav class="tags">...</nav>
    </article>
  </li>
</ul>
```

**CSS**: Automatically styled by `main#content-area > ul` component rules

### Pattern 3: Sections with Headings

**Markup**:
```tsx
<section>
  <h2>Section Title</h2>
  <p>Content here</p>
</section>
```

**CSS**: Automatically centered by layout layer rules

---

## Utility Classes

### When to Use Utilities

**✅ Good uses**:
```html
<!-- Quick flex centering -->
<div class="u-flex-row-center">
  <span>Icon</span>
  <span>Text</span>
</div>

<!-- Force full width -->
<div class="u-full-width">Content</div>
```

**❌ Bad uses**:
```html
<!-- Component-specific styling (use component class) -->
<div class="u-center-content u-flex-col-center post-card">

<!-- Styling should be in component class, not utilities -->
```

### Available Utilities Reference

| Class | Purpose | When to Use |
|-------|---------|-------------|
| `.u-center-content` | Center text + block | Quick centering |
| `.u-center-block` | Center block only | Block without text centering |
| `.u-full-width` | Force 100% width | Override width constraints |
| `.u-flex-col-center` | Vertical flex center | Stacked centered items |
| `.u-flex-wrap-center` | Wrapped flex center | Tag chips, badges |
| `.u-flex-row-center` | Horizontal flex center | Icon + text combos |

---

## Best Practices

### DO ✅

1. **Use cascade layers properly**
   ```css
   @layer components {
     .my-component { /* styles */ }
   }
   ```

2. **Leverage CSS nesting**
   ```css
   .parent {
     & .child { /* nested styles */ }
   }
   ```

3. **Use custom properties for values**
   ```css
   padding: var(--size-4);
   color: var(--color-primary);
   ```

4. **Container queries for component responsiveness**
   ```css
   @container (min-width: 30rem) { /* styles */ }
   ```

5. **Semantic HTML first, classes second**
   ```html
   <article> <!-- semantic -->
     <header> <!-- semantic -->
       <h1>Title</h1>
     </header>
   </article>
   ```

### DON'T ❌

1. **Don't use `!important` outside utilities layer**
   ```css
   /* ❌ Bad */
   .component { width: 100% !important; }

   /* ✅ Good */
   @layer components {
     .component { width: 100%; }
   }
   ```

2. **Don't fight specificity**
   ```css
   /* ❌ Bad */
   main > div > ul > li > article { }

   /* ✅ Good */
   .article-card { }
   ```

3. **Don't duplicate values**
   ```css
   /* ❌ Bad */
   .a { padding: 1.5rem; }
   .b { padding: 1.5rem; }

   /* ✅ Good */
   .a, .b { padding: var(--size-4); }
   ```

4. **Don't nest too deep**
   ```css
   /* ❌ Bad - 5 levels deep */
   .a { & .b { & .c { & .d { & .e { } } } } }

   /* ✅ Good - 2-3 levels max */
   .a { & .b { } }
   ```

5. **Don't create component wrappers in TSX**
   ```tsx
   <!-- ❌ Bad - component wraps in <main> -->
   export const Page = () => <main>...</main>

   <!-- ✅ Good - component returns fragment -->
   export const Page = () => <>...</>
   ```

---

## Common Patterns

### Centering Content

**Full-width centered container**:
```css
.container {
  width: 100%;
  max-width: var(--layout-max-width);
  margin-inline: auto;
  padding-inline: var(--layout-inline-padding);
}
```

**Centered text + block**:
```css
.centered {
  text-align: center;
  margin-inline: auto;
}
```

**Flex centering**:
```css
.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

### Responsive Spacing

**Using fluid clamp**:
```css
padding: clamp(0.75rem, 3vw, 1.5rem);
/* Scales from 0.75rem (mobile) to 1.5rem (desktop) */
```

**Using container queries**:
```css
.component {
  padding: var(--size-4);

  @container (min-width: 30rem) {
    padding: var(--size-6);
  }
}
```

### Lists

**Reset list styles**:
```css
ul, ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
```

**Centered list with inside bullets**:
```css
ul {
  text-align: center;
  padding-inline-start: 0;
  list-style-position: inside;
}
```

**Left-aligned list centered as block**:
```css
ul {
  display: inline-block;
  text-align: left;
  margin-inline: auto;
}
```

---

## Troubleshooting

### Content Not Centered

**Problem**: Element appears left-aligned
**Check**:
1. Does parent have `text-align: center`?
2. Is element `display: block` with `margin-inline: auto`?
3. Is element inheriting `text-align: left` from somewhere?

**Solution**:
```css
.element {
  text-align: center;
  margin-inline: auto;
}
```

### Lists Showing Bullets Outside

**Problem**: Bullets appear outside left edge
**Fix**:
```css
ul {
  padding-inline-start: 0;
  list-style-position: inside; /* Bullets inside text flow */
}
```

### Component Not Taking Full Width

**Problem**: Element is narrower than expected
**Check**:
1. Does element have `width: 100%`?
2. Is parent using flexbox without `flex-grow`?
3. Is `max-width` constraining it?

**Solution**:
```css
.element {
  width: 100%;
  flex-grow: 1; /* If in flex container */
}
```

### Specificity Issues

**Problem**: Styles not applying
**Check**:
1. Which cascade layer is the rule in?
2. Is there a more specific selector overriding?
3. Browser DevTools shows which rule wins

**Solution**: Move rule to appropriate layer or use more specific selector

### HTMX Content Not Styling

**Problem**: Swapped content has no styles
**Check**:
1. Are styles targeting `#content-area` children?
2. Does swapped content have expected structure?
3. Did component return `<main>` wrapper instead of fragment?

**Solution**: Ensure components return fragments, not `<main>` wrappers

---

## Performance Considerations

### CSS File Size
- **Current**: ~1800 lines
- **Gzipped**: ~12-15KB
- **Acceptable**: Yes (under 20KB threshold)

### Selector Performance
- **Preferred**: Class selectors (`.class`)
- **Good**: Element selectors (`article`)
- **Okay**: Descendant combinators (`main > ul`)
- **Avoid**: Deep nesting (`a > b > c > d > e`)

### Container Queries
- **Impact**: Minimal (modern browsers optimize well)
- **Usage**: Good for component-level responsiveness
- **Fallback**: Not needed (progressive enhancement)

### Custom Properties
- **Impact**: Negligible (browser-optimized)
- **Benefit**: Maintainability > micro-optimization

---

## Maintenance Guide

### Adding a New Component

1. **Create component markup** (TSX):
   ```tsx
   export const MyComponent = () => (
     <>
       <h2>Title</h2>
       <p>Content</p>
     </>
   );
   ```

2. **Add component styles** (if needed):
   ```css
   @layer components {
     .my-component {
       /* Component-specific styles */
     }
   }
   ```

3. **Use existing utilities/layout** where possible

### Modifying Layout

1. **Identify affected area**: Layout layer vs component layer
2. **Check cascade layer**: Modify in correct layer
3. **Test all pages**: Layout changes affect everything
4. **Verify HTMX**: Test swapping behavior

### Adding Design Tokens

1. **Add to tokens layer**:
   ```css
   @layer tokens {
     :root {
       --my-new-token: value;
     }
   }
   ```

2. **Use throughout codebase**:
   ```css
   .component {
     property: var(--my-new-token);
   }
   ```

3. **Document purpose** in this file

---

## Summary

This CSS architecture uses:
- ✅ **Cascade layers** for predictable specificity
- ✅ **Design tokens** for consistency
- ✅ **Unified layout** for simplicity
- ✅ **Modern CSS** (container queries, nesting, custom properties)
- ✅ **Semantic HTML** for accessibility
- ✅ **Component patterns** for reusability

**Result**: Maintainable, scalable, performant CSS that's easy to reason about.

---

## Quick Reference

### File Structure
```
public/css/main.css
  ├── @layer reset      (lines 10-47)
  ├── @layer tokens     (lines 106-220)
  ├── @layer utilities  (lines 50-103)
  ├── @layer layout     (lines 260-406)
  ├── @layer components (lines 1055-1139)
  └── @layer overrides  (lines 1142-1151)
```

### Key Selectors
- `main#content-area` - Unified main content
- `main#content-area > ul` - Post lists
- `.tags` - Tag chip wrapper
- `.tag` - Individual tag chip
- `ul[role="list"]` - Tag lists

### Documentation Files
- `CSS_ARCHITECTURE.md` - This file
- `CSS_REFACTORING_PLAN.md` - Original refactoring plan
- `REFACTORING_COMPLETE.md` - Refactoring results
- `LAYOUT_UNIFICATION_COMPLETE.md` - Layout unification results
