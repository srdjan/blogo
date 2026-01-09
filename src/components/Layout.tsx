import type { LayoutProps } from "../lib/types.ts";
import { renderVNode } from "../http/render-vnode.ts";

export const createLayout = (props: LayoutProps): Response => {
  const {
    title,
    description,
    path = "/" as const,
    children,
    image,
    author = "Claude & Srdjan",
    publishedTime,
    modifiedTime,
    tags,
    type = "website",
    origin,
    canonicalPath,
    robots,
    structuredData,
  } = props;

  const env = Deno.env.get("DENO_ENV") || "development";
  const isProd = env === "production";

  const fallbackOrigin = Deno.env.get("PUBLIC_URL") ||
    "https://blogo.timok.deno.net";
  const siteOrigin = origin || fallbackOrigin;
  const siteName = "Blogo - Modern Development Blog";
  const twitterHandle = Deno.env.get("TWITTER_HANDLE") || "@blogo_dev";

  const canonicalTarget = canonicalPath ?? path;
  const canonicalUrl = (() => {
    try {
      return new URL(canonicalTarget, siteOrigin).toString();
    } catch (_error) {
      return `${siteOrigin}${canonicalTarget}`;
    }
  })();

  const defaultImage = `${siteOrigin}/images/og-default.svg`;

  const ogImage = image || (
    path.startsWith("/posts/")
      ? `${siteOrigin}/images/og/${path.replace("/posts/", "")}.svg`
      : defaultImage
  );

  const ogImageType = ogImage.endsWith(".svg") ? "image/svg+xml" : "image/png";

  const robotsMeta = robots ??
    "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  const isArticle = type === "article";

  const basePublisher = {
    "@type": "Organization",
    "name": siteName,
    "url": siteOrigin,
    "logo": {
      "@type": "ImageObject",
      "url": `${siteOrigin}/favicon.svg`,
    },
  } as const;

  const primaryStructuredData = isArticle
    ? {
      "@context": "https://schema.org",
      "@type": "BlogPosting" as const,
      "headline": title,
      ...(description ? { "description": description } : {}),
      "url": canonicalUrl,
      "image": ogImage,
      "author": {
        "@type": "Person",
        "name": author,
      },
      "publisher": basePublisher,
      ...(publishedTime ? { "datePublished": publishedTime } : {}),
      ...(modifiedTime ? { "dateModified": modifiedTime } : {}),
      ...(tags && tags.length > 0
        ? { "keywords": tags.join(", "), "articleSection": "Technology" }
        : { "articleSection": "Technology" }),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
    }
    : {
      "@context": "https://schema.org",
      "@type": "Blog" as const,
      "name": siteName,
      "headline": title,
      ...(description ? { "description": description } : {}),
      "url": canonicalUrl,
      "image": ogImage,
      "publisher": basePublisher,
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${siteOrigin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    };

  const additionalJson = structuredData
    ? Array.isArray(structuredData) ? structuredData : [structuredData]
    : [];

  const jsonLdItems = [
    primaryStructuredData,
    ...additionalJson,
  ];

  const jsonLdPayload = jsonLdItems.length === 1 ? jsonLdItems[0] : jsonLdItems;

  const html = (
    <html lang="en" data-palette="automerge">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}

        <link rel="canonical" href={canonicalUrl} />

        <meta {...{ "property": "og:type" }} content={type} />
        <meta {...{ "property": "og:title" }} content={title} />
        {description && (
          <meta {...{ "property": "og:description" }} content={description} />
        )}
        <meta {...{ "property": "og:url" }} content={canonicalUrl} />
        <meta {...{ "property": "og:image" }} content={ogImage} />
        <meta {...{ "property": "og:image:type" }} content={ogImageType} />
        <meta
          {...{ "property": "og:image:alt" }}
          content={`Cover image for: ${title}`}
        />
        <meta
          {...{ "property": "og:site_name" }}
          content={siteName}
        />
        <meta {...{ "property": "og:locale" }} content="en_US" />
        {publishedTime && (
          <meta
            {...{ "property": "article:published_time" }}
            content={publishedTime}
          />
        )}
        {modifiedTime && (
          <meta
            {...{ "property": "article:modified_time" }}
            content={modifiedTime}
          />
        )}
        {author && (
          <meta {...{ "property": "article:author" }} content={author} />
        )}
        {tags && tags.map((tag, _index) =>
          // deno-lint-ignore jsx-key
          <meta {...{ "property": "article:tag" }} content={tag} />
        )}
        {type === "article" && (
          <meta {...{ "property": "article:section" }} content="Technology" />
        )}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {description && (
          <meta name="twitter:description" content={description} />
        )}
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:type" content={ogImageType} />
        <meta name="twitter:image:alt" content={`Cover image for: ${title}`} />
        <meta name="twitter:site" content={twitterHandle} />
        <meta name="twitter:creator" content={twitterHandle} />

        <meta name="author" content={author} />
        <meta name="robots" content={robotsMeta} />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/css/vendor/normalize.min.css" />
        <link rel="stylesheet" href="/css/vendor/open-props.min.css" />
        <link rel="stylesheet" href="/css/main.css" />
        {/* Self-hosted fonts for improved performance */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="alternate"
          href="/feed.xml"
          title="Blogo RSS Feed"
          type="application/rss+xml"
        />
        <link
          rel="alternate"
          href="/rss.xml"
          title="Blogo Full RSS Feed"
          type="application/rss+xml"
        />

        <script type="application/ld+json">
          {JSON.stringify(jsonLdPayload)}
        </script>

        <script src="/js/htmx.min.js" defer></script>
        <script src="/js/site.js" defer></script>
      </head>
      <body>
        <a class="skip-link" href="#content-area">Skip to main content</a>
        <div id="app-layout">
          <header class="site-header" role="banner">
            <div class="site-branding">
              <h1 class="site-title">
                <a
                  href="/"
                  get="/"
                  target="#content-area"
                  swap="innerHTML"
                  pushUrl="true"
                  rel="home"
                >
                  Blogo
                </a>
              </h1>
              <p class="site-description">
                Modern Development Blog
              </p>
            </div>
            <nav class="site-nav" aria-label="Primary">
              <ul>
                <li>
                  <a
                    href="/"
                    {...(path === "/" && { "aria-current": "page" })}
                    get="/"
                    target="#content-area"
                    swap="innerHTML"
                    pushUrl="true"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/tags"
                    {...(path === "/tags" && { "aria-current": "page" })}
                    get="/tags"
                    target="#content-area"
                    swap="innerHTML"
                    pushUrl="true"
                  >
                    Tags
                  </a>
                </li>
                <li>
                  <a
                    href="/rss"
                    {...(path === "/rss" && { "aria-current": "page" })}
                    get="/rss"
                    target="#content-area"
                    swap="innerHTML"
                    pushUrl="true"
                  >
                    RSS
                  </a>
                </li>

                <li>
                  <a
                    href="/about"
                    {...(path === "/about" && { "aria-current": "page" })}
                    get="/about"
                    target="#content-area"
                    swap="innerHTML"
                    pushUrl="true"
                  >
                    About
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    class="palette-toggle"
                    aria-label="Switch color palette"
                    title="Switch color palette (Default/Automerge)"
                  >
                    {/* Simple dotted grid icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="4" cy="4" r="1"></circle>
                      <circle cx="10" cy="4" r="1"></circle>
                      <circle cx="16" cy="4" r="1"></circle>
                      <circle cx="4" cy="10" r="1"></circle>
                      <circle cx="10" cy="10" r="1"></circle>
                      <circle cx="16" cy="10" r="1"></circle>
                      <circle cx="4" cy="16" r="1"></circle>
                      <circle cx="10" cy="16" r="1"></circle>
                      <circle cx="16" cy="16" r="1"></circle>
                    </svg>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    class="theme-toggle"
                    aria-label="Toggle theme"
                    title="Toggle light/dark theme"
                  >
                    <svg
                      class="sun-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    <svg
                      class="moon-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    class="search-toggle"
                    aria-label="Search"
                    aria-expanded="false"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m21 21-4.34-4.34" />
                      <circle cx="11" cy="11" r="8" />
                    </svg>
                  </button>
                </li>
              </ul>
            </nav>

            <dialog id="search-modal" aria-labelledby="search-heading">
              <section>
                <header>
                  <h2 id="search-heading">Search</h2>
                  <button type="button" aria-label="Close search">✕</button>
                </header>
                <form id="search-form" role="search" action="/search">
                  <input
                    type="search"
                    name="q"
                    placeholder="Search posts..."
                    required
                    id="search-input"
                    aria-labelledby="search-heading"
                  />
                  <button type="submit" aria-label="Submit search">
                  </button>
                </form>
                <section
                  id="search-results"
                  role="region"
                  aria-live="polite"
                  aria-label="Search results"
                >
                </section>
              </section>
            </dialog>
          </header>

          <main id="content-area" class="main-content">
            {children}
          </main>

          <footer class="site-footer">
            <div class="footer-content">
              <span>
                Claude &{"  "}
                <a
                  href="https://srdjan.github.io"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>⊣˚∆˚⊢</span>
                </a>{"  "}
                vibe coded together...
              </span>
              <span class="footer-separator">•</span>
              <a
                href="https://github.com/srdjan/blogo"
                target="_blank"
                rel="noopener noreferrer"
                class="github-link"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  style="vertical-align: middle; margin-right: 0.35rem;"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                View source
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );

  // Convert JSX VNode to HTML string using our custom renderer
  const htmlString = "<!DOCTYPE html>" + renderVNode(html);

  return new Response(htmlString, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(isProd
        ? {
          "Cache-Control":
            "public, max-age=60, stale-while-revalidate=300",
        }
        : {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        }),
      "Vary": "HX-Request",
    },
  });
};
