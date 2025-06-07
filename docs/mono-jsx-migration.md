# Mono-JSX Migration Guide

## Current Status

We've attempted to refactor `src/render.tsx` to use mono-jsx, but encountered
several challenges:

1. Mono-jsx doesn't support `dangerouslySetInnerHTML` for injecting raw HTML
2. Attribute naming conventions differ from standard HTML (e.g., `charset` vs
   `charSet`)
3. The blog heavily relies on injecting HTML content from various sources

## Recommended Approach

Instead of a full refactoring at once, we recommend an incremental approach:

### 1. Create Component Library

Start by creating reusable components in a dedicated directory:

```
src/components/
  Layout.tsx       # Main layout structure
  Navigation.tsx   # Navigation menu
  PostCard.tsx     # Card for post listings
  TagCloud.tsx     # Tag display component
  SearchModal.tsx  # Search functionality
```

### 2. Refactor Simple Components First

Begin with components that don't require raw HTML injection:

- Navigation links
- Search form
- Pagination controls
- Footer

### 3. Handle HTML Content

For components that need to render raw HTML:

- Consider using a different approach for content that comes from Markdown
- Explore alternatives to `dangerouslySetInnerHTML` in mono-jsx
- Possibly keep template strings for certain parts of the rendering

### 4. Update Routes

Once components are in place, update the routes to use the new components.

## Example Component

Here's an example of a simple component using mono-jsx:

```tsx
// src/components/TagLink.tsx
export const TagLink = ({ tag, count }: { tag: string; count: number }) => {
  const sizeClass = count >= 10 ? "lg" : count >= 5 ? "md" : "sm";

  return (
    <a
      href={`/tags/${tag}`}
      class={`tag tag-${sizeClass} link`}
      hx-get={`/tags/${tag}`}
      hx-target="#content-area"
      hx-swap="innerHTML"
      hx-push-url="true"
      title={`${count} posts`}
    >
      {tag}
      <span class="tag-count">{count}</span>
    </a>
  );
};
```

## Benefits of Migration

Despite the challenges, migrating to mono-jsx offers several benefits:

1. **Type Safety**: Better type checking for components and props
2. **Maintainability**: More modular and reusable code
3. **Readability**: JSX is often more readable than template strings
4. **Composability**: Easier to compose UI from smaller pieces

## Next Steps

1. Create basic component structure
2. Refactor one page at a time, starting with simpler ones
3. Test thoroughly after each refactoring step
4. Update documentation as the migration progresses
