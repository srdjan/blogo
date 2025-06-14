// Blog layout component for mono-jsx
// deno-lint-ignore-file no-explicit-any

interface BlogLayoutProps {
  title: string;
  description?: string;
  path?: string;
  children: JSX.Element;
}

export function createBlogLayout(props: BlogLayoutProps) {
  const { title, description, path = "/", children } = props;
  
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
          {...({} as any)}
        />
        <title>{title}</title>
        {description
          ? <meta name="description" content={description} {...({} as any)} />
          : null}
        <link
          rel="icon"
          href="/favicon.svg"
          type="image/svg+xml"
          {...({} as any)}
        />
        <link rel="stylesheet" href="/css/main.css" {...({} as any)} />
        <link
          rel="alternate"
          href="/feed.xml"
          title={`${title} RSS Feed`}
          {...({} as any)}
        />
        <script src="/js/htmx.min.js"></script>
        <script src="/js/site.js"></script>
      </head>
      <body>
        <div id="app-layout">
          <header id="site-header">
            <nav>
              <ul>
                <li>
                  <a
                    href="/"
                    aria-current={path === "/" ? "page" : undefined}
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
                    aria-current={path === "/tags" ? "page" : undefined}
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
                    href="/about"
                    aria-current={path === "/about" ? "page" : undefined}
                    hx-get="/about"
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    About
                  </a>
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
                <li>
                  <a href="https://github.com/srdjan/blogo" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository">
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
                      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                      <path d="M9 18c-4.51 2-5-2-7-2"/>
                    </svg>
                  </a>
                </li>
                <li>
                  <a href="/feed.xml" aria-label="RSS Feed">
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
                      <path d="M4 11a9 9 0 0 1 9 9" />
                      <path d="M4 4a16 16 0 0 1 16 16" />
                      <circle cx="5" cy="19" r="1" />
                    </svg>
                  </a>
                </li>
              </ul>
            </nav>

            <dialog id="search-modal" aria-labelledby="search-heading">
              <section>
                <header>
                  <h2 id="search-heading">Search</h2>
                  <button
                    type="button"
                    aria-label="Close search"
                  >
                    ✕
                  </button>
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
                    Search
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

          <main id="content-main">
            <div id="content-area">
              {children}
            </div>
          </main>

          <footer>
            <p>
              Claude & {" "}
              <a
                href="https://srdjan.github.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>⊣˚∆˚⊢</span>
              </a>
              {" "} vibe coded together...
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}