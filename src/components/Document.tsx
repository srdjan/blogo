/**
 * Document component that renders the full HTML document
 * Uses mono-jsx exclusively for all HTML rendering
 */

import { Layout } from "./Layout.tsx";
import { htmlToJsx } from "../utils/html-to-jsx.tsx";

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
}: DocumentProps) => {
  // We need to return a string with the DOCTYPE
  // This is a limitation of JSX, which doesn't support DOCTYPE declarations
  const docType = "<!DOCTYPE html>";

  const document = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <MetaTag name="description" content={description} />

        {/* Structured Data */}
        <StructuredData data={structuredData} />

        {/* Open Graph tags */}
        <SocialTags tags={ogTags} />

        {/* Twitter Card tags */}
        <SocialTags tags={twitterTags} />

        <LinkTag rel="stylesheet" href="/css/main.css" />
        <LinkTag rel="stylesheet" href="/css/color-override.css" />
        <LinkTag 
          rel="alternate" 
          href="/feed.xml" 
          title={`${title} RSS Feed`} 
        />
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
