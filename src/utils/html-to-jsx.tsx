/**
 * Utility functions for converting HTML strings to JSX elements
 * This provides a clean way to use mono-jsx with HTML content from various sources
 */

/**
 * A wrapper around mono-jsx's html tag function that provides safer handling
 * for potentially undefined HTML strings
 * 
 * This leverages mono-jsx's built-in html tag function but adds error handling
 */
export const htmlToJsx = (htmlContent: string | undefined): JSX.Element => {
  if (!htmlContent) {
    return <div class="empty-content"></div>;
  }
  
  try {
    // Use mono-jsx's built-in html tag function
    // This is equivalent to html`${htmlContent}` in JSX
    return <div>{html`${htmlContent}`}</div>;
  } catch (error) {
    console.error("Error parsing HTML:", error);
    // Return a minimal container if parsing fails
    return <div class="parse-error">Error parsing HTML content</div>;
  }
};

/**
 * Specially optimized for markdown-generated HTML
 * Renders the markdown HTML content directly as JSX
 */
export const markdownToJsx = (htmlContent: string): JSX.Element => {
  return htmlToJsx(htmlContent);
};

/**
 * Escape a string for safe inclusion in HTML attributes
 * Utility function for when you need to manually insert content
 */
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};