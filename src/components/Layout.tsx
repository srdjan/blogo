import type { LayoutProps } from "../lib/types.ts";

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
    <html lang="en" data-theme="verdana">
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
        <link rel="stylesheet" href="/css/mcss.css" />
        <link rel="stylesheet" href="/css/custom.css" />
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
        <header role="banner">
          <h1>
            <a
              href="/"
              hx-get="/"
              hx-target="#content-area"
              hx-swap="innerHTML"
              hx-push-url="true"
              rel="home"
            >
              Blogo
            </a>
          </h1>
          <p>Modern Development Blog</p>
          <nav aria-label="Primary">
            <ul>
              <li>
                <a
                  href="/"
                  {...(path === "/" && { "aria-current": "page" })}
                  hx-get="/"
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/tags"
                  {...(path === "/tags" && { "aria-current": "page" })}
                  hx-get="/tags"
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                >
                  Tags
                </a>
              </li>
              <li>
                <a
                  href="/rss"
                  {...(path === "/rss" && { "aria-current": "page" })}
                  hx-get="/rss"
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                >
                  RSS
                </a>
              </li>

              <li>
                <a
                  href="/about"
                  {...(path === "/about" && { "aria-current": "page" })}
                  hx-get="/about"
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                >
                  About
                </a>
              </li>
              <li id="search-nav-item">
                <a
                  href="#"
                  id="search-toggle"
                  aria-label="Search"
                  aria-expanded="false"
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
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <hr />

        <dialog id="search-modal" aria-label="Search posts">
          <button
            type="button"
            class="search-close"
            aria-label="Close search"
          >
            ✕
          </button>
          <form id="search-form" role="search" action="/search">
            <div class="search-input-wrapper">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search posts..."
                id="search-input"
                aria-label="Search posts"
              />
            </div>
          </form>
          <section
            id="search-results"
            role="region"
            aria-live="polite"
            aria-label="Search results"
          >
          </section>
        </dialog>

        <main id="content-area">
          {children}
        </main>

        <hr />
        <footer>
          <p>
            Claude &{" "}
            <a
              href="https://srdjan.github.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              ⊣˚∆˚⊢
            </a>{" "}
            vibe coded together •{" "}
            <a
              href="https://github.com/srdjan/blogo"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source
            </a>
          </p>
        </footer>
      </body>
    </html>
  );

  // Convert JSX to string manually, handling mono-jsx Response conversion
  const htmlString = html instanceof Response ? html : String(html);

  if (htmlString instanceof Response) {
    return htmlString;
  }

  return new Response(htmlString, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Vary": "HX-Request",
    },
  });
};
