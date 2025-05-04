/**
 * Document component that renders the full HTML document
 */

import { Layout } from "./Layout.tsx";

type DocumentProps = {
  title: string;
  description: string;
  path: string;
  content: string;
  structuredData?: string;
  ogTags?: string;
  twitterTags?: string;
};

export const Document = ({
  title,
  description,
  path,
  content,
  structuredData = "",
  ogTags = "",
  twitterTags = "",
}: DocumentProps) => {
  // We need to return a string with the DOCTYPE
  // This is a limitation of JSX, which doesn't support DOCTYPE declarations
  const docType = "<!DOCTYPE html>";

  const document = (
    <html lang="en">
      <head>
        {html`<meta charset="UTF-8">`}
        {html`<meta name="viewport" content="width=device-width, initial-scale=1.0">`}
        <title>{title}</title>
        {html`<meta name="description" content="${description}">`}

        {/* Structured Data */}
        {structuredData && html`<script type="application/ld+json">${structuredData}</script>`}

        {/* Open Graph tags */}
        {ogTags && html`${ogTags}`}

        {/* Twitter Card tags */}
        {twitterTags && html`${twitterTags}`}

        {html`<link rel="stylesheet" href="/css/main.css">`}
        {html`<link rel="stylesheet" href="/css/color-override.css">`}
        {html`<link rel="alternate" type="application/rss+xml" title="${title} RSS Feed" href="/feed.xml">`}
        <script src="/js/htmx.min.js"></script>
        <script src="/js/site.js"></script>
      </head>
      <body>
        <Layout
          title={title}
          description={description}
          path={path}
          content={content}
        />
      </body>
    </html>
  );

  // Combine the DOCTYPE with the document
  return `${docType}\n${document}`;
};
