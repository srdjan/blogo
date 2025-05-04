# Mono-JSX Implementation Guide

This document provides a comprehensive guide to how we've implemented mono-jsx in our blog, especially for rendering markdown content.

## Overview

We've successfully integrated mono-jsx for HTML rendering throughout the blog, including:

1. Converting HTML strings to JSX elements
2. Rendering markdown content with mono-jsx
3. Using mono-jsx components for UI elements

## Architecture

### 1. HTML-to-JSX Conversion

We've created a utility module (`src/utils/html-to-jsx.tsx`) that provides functions for converting HTML strings to mono-jsx elements:

```typescript
// Converts HTML string to JSX elements
export const htmlToJsx = (htmlContent: string | undefined): JSX.Element => {
  if (!htmlContent) {
    return <div class="empty-content"></div>;
  }
  
  try {
    // Use mono-jsx's built-in html tag function
    return <div>{html`${htmlContent}`}</div>;
  } catch (error) {
    console.error("Error parsing HTML:", error);
    return <div class="parse-error">Error parsing HTML content</div>;
  }
};

// Specifically for markdown content
export const markdownToJsx = (htmlContent: string): JSX.Element => {
  return htmlToJsx(htmlContent);
};
```

### 2. Markdown Rendering

Our custom markdown renderer (`src/markdown-renderer.tsx`) provides two primary functions:

1. `markdownToHtml`: Converts markdown to HTML (string)
2. `markdownToJsxElements`: Converts markdown to JSX elements (for mono-jsx)

This approach allows us to:
- Maintain backward compatibility with HTML string rendering
- Add new JSX-based rendering for mono-jsx

### 3. Post Type Enhancement

We've enhanced the `Post` type to include JSX content:

```typescript
export interface Post extends PostMeta {
  content: string; // HTML content as string (for backward compatibility)
  contentJsx?: JSX.Element; // JSX element content for mono-jsx rendering
  formattedDate?: string; // Pre-formatted date string
}
```

### 4. Component Structure

Our component structure follows these patterns:

1. **Helper Components**: Small, reusable components that handle specific rendering tasks
2. **Content Components**: Components that render specific types of content (posts, tags, etc.)
3. **Layout Components**: Components that handle overall page structure

## Migration Strategy

We used an incremental migration approach:

1. Created utility functions for HTML-to-JSX conversion
2. Implemented a custom markdown renderer
3. Updated the Post component to use JSX content when available
4. Updated the Document component with mono-jsx components for HTML elements

## Best Practices

### When Using HTML Content

When working with HTML content from external sources (e.g., markdown):

```typescript
// In components:
import { htmlToJsx } from "../utils/html-to-jsx.tsx";

// Then render:
<div class="content">
  {htmlToJsx(htmlContent)}
</div>
```

### For New Components

When creating new components:

1. Use mono-jsx's JSX syntax directly
2. Create small, focused components
3. Use helper components for repeated patterns

Example:

```typescript
// Helper component
const MetaTag = ({ name, content }: { name: string; content: string }) => {
  return <meta name={name} content={content} />;
};

// Main component that uses the helper
const Head = ({ title, description }) => {
  return (
    <head>
      <title>{title}</title>
      <MetaTag name="description" content={description} />
    </head>
  );
};
```

## Important Notes

1. **No dangerouslySetInnerHTML**: mono-jsx doesn't support this attribute. Use our `htmlToJsx` utility instead.

2. **HTML Attribute Names**: Use standard HTML attribute names (e.g., `class` instead of `className`).

3. **Fragment Limitations**: Be cautious with fragment components (`<>...</>`), as they may not convert properly to strings.

4. **Debugging**: If you encounter rendering issues, check both the HTML string and JSX elements.

## Future Improvements

1. **Component Library**: Build a comprehensive library of reusable components.

2. **Custom Markdown Processor**: Consider a custom markdown processor that generates JSX directly.

3. **Streaming Rendering**: Explore mono-jsx's streaming rendering capabilities for large pages.

4. **Hydration**: Investigate client-side hydration for interactive components.

## Conclusion

By using mono-jsx throughout our blog, we've gained:

- Type safety for all HTML rendering
- Consistent component patterns
- Improved code organization and maintainability
- Better handling of markdown content

This approach provides a solid foundation for future enhancements and features.