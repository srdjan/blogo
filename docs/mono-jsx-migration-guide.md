# Mono-JSX Migration Guide

## Current Status

We've attempted to refactor the rendering functions in `src/render.tsx` to use
mono-jsx components, but encountered several challenges:

1. Mono-jsx doesn't support `dangerouslySetInnerHTML` for injecting raw HTML
2. Fragment components (`<>...</>`) don't convert properly to strings
3. The blog heavily relies on injecting HTML content from various sources

## Temporary Solution

To keep the blog functioning, we've temporarily reverted to using template
strings for most rendering functions:

1. `renderPostList`: Reverted to template strings
2. `renderTagIndex`: Reverted to template strings
3. `renderAbout`: Reverted to template strings
4. `renderNotFound`: Reverted to template strings
5. `renderErrorPage`: Reverted to template strings
6. `renderSearchResults`: Reverted to template strings

We've kept the JSX components in the `src/components` directory for future use,
but they're currently commented out in the imports.

## Recommended Approach for Future Migration

For a successful migration to mono-jsx, we recommend the following approach:

### 1. Understand Mono-JSX Limitations

- No support for `dangerouslySetInnerHTML`
- No support for Fragment components (`<>...</>`)
- Different attribute naming conventions than standard HTML
- Limited support for event handlers

### 2. Create a Custom HTML Renderer

Create a custom HTML renderer that can handle raw HTML content:

```typescript
// Example of a custom HTML renderer
const renderHtml = (html: string): string => {
  // Process the HTML as needed
  return html;
};
```

### 3. Use a Hybrid Approach

Use a hybrid approach where:

- Static UI elements are rendered using JSX
- Dynamic content is rendered using template strings
- The two are combined using a custom renderer

### 4. Refactor One Component at a Time

Start with simpler components that don't require raw HTML injection:

1. Navigation menu
2. Footer
3. Pagination controls
4. Tag cloud

### 5. Test Thoroughly

After each refactoring step, test thoroughly to ensure everything works as
expected.

## Benefits of Migration

Despite the challenges, migrating to mono-jsx offers several benefits:

1. **Type Safety**: Better type checking for components and props
2. **Maintainability**: More modular and reusable code
3. **Readability**: JSX is often more readable than template strings
4. **Composability**: Easier to compose UI from smaller pieces

## Next Steps

1. Research alternatives to `dangerouslySetInnerHTML` in mono-jsx
2. Explore ways to handle Fragment components
3. Create a custom HTML renderer
4. Start refactoring simpler components
5. Update this guide as progress is made
