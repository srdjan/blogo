/**
 * Document component that renders the full HTML document
 * Uses mono-jsx exclusively for all HTML rendering
 */

import { Layout } from "./Layout.tsx";
import { htmlToJsx } from "../utils/html-to-jsx.tsx";
import { logDebug, logError, getObjectType } from "../utils/debug.ts";
import { responseToString } from "../utils/response-to-string.ts";

type DocumentProps = {
  title: string;
  description: string;
  path: string;
  content: string;
  structuredData?: string;
  ogTags?: string;
  twitterTags?: string;
};

// Helper component for rendering meta tags with proper attributes
const MetaTag = ({ name, content }: { name: string; content: string }) => {
  return <meta name={name} content={content} />;
};

// Helper component for rendering link tags
const LinkTag = ({ rel, href, title }: { rel: string; href: string; title?: string }) => {
  return <link rel={rel} href={href} title={title} />;
};

// Helper component for rendering structured data
const StructuredData = ({ data }: { data: string }) => {
  if (!data) return null;
  
  return (
    <script type="application/ld+json">
      {html`${data}`}
    </script>
  );
};

// Helper component for rendering Open Graph and Twitter Card tags
const SocialTags = ({ tags }: { tags: string }) => {
  if (!tags) return null;
  
  return htmlToJsx(tags);
};

export const Document = ({
  title,
  description,
  path,
  content,
  structuredData = "",
  ogTags = "",
  twitterTags = "",
}: DocumentProps): string => {
  // We need to return a string with the DOCTYPE
  // This is a limitation of JSX, which doesn't support DOCTYPE declarations
  const docType = "<!DOCTYPE html>";

  // Instead of creating the JSX element directly, we'll build an HTML string
  // This avoids potential issues with mono-jsx returning Response objects
  const htmlString = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
    ${ogTags || ''}
    ${twitterTags || ''}
    <link rel="stylesheet" href="/css/main.css">
    <link rel="stylesheet" href="/css/color-override.css">
    <link rel="alternate" href="/feed.xml" title="${title} RSS Feed">
    <script src="/js/htmx.min.js"></script>
    <script src="/js/site.js"></script>
  </head>
  <body>
    <div id="app-layout">
      <header id="site-header">
        <nav>
          <a href="/" class="site-title">Home</a>
          <a href="/about">About</a>
          <div class="search-trigger" hx-get="/search" hx-target="#search-modal" hx-swap="innerHTML">
            <span>Search</span>
          </div>
        </nav>
        <div id="search-modal"></div>
      </header>

      <main id="content-main" class="content-main">
        <div id="content-area" class="htmx-swappable">
          ${content}
        </div>
      </main>

      <footer>
        <p>
          Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
            <span class="avatar">⊣˚∆˚⊢</span>
          </a> & Claude
        </p>
      </footer>
    </div>
  </body>
</html>`;

  logDebug("Generated HTML document directly using string template");
  
  // Return the HTML string directly
  return htmlString;
};
