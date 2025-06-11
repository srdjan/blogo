// Layout helper functions instead of components for mono-jsx compatibility

interface LayoutOptions {
  title: string;
  description?: string;
  path?: string;
}

export function createBlogLayout(options: LayoutOptions, children: any) {
  const { title, description, path = "/" } = options;
  
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="stylesheet" href="/css/main.css" />
        <link rel="alternate" href="/feed.xml" title={`${title} RSS Feed`} />
        <script src="/js/htmx.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
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
                    class={path === "/" ? "link active" : "link"}
                    hx-get="/"
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    ◊ Home
                  </a>
                </li>
                <li>
                  <a 
                    href="/tags" 
                    class={path === "/tags" ? "link active" : "link"}
                    hx-get="/tags"
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    ◈ Tags
                  </a>
                </li>
                <li>
                  <a 
                    href="/about" 
                    class={path === "/about" ? "link active" : "link"}
                    hx-get="/about"
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    ◆ About
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    class="search-toggle link"
                    aria-label="Search"
                    aria-expanded="false"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search">
                      <path d="m21 21-4.34-4.34"/>
                      <circle cx="11" cy="11" r="8"/>
                    </svg>
                  </button>
                </li>
                <li>
                  <a href="/feed.xml" class="link" aria-label="RSS Feed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rss-icon lucide-rss">
                      <path d="M4 11a9 9 0 0 1 9 9"/>
                      <path d="M4 4a16 16 0 0 1 16 16"/>
                      <circle cx="5" cy="19" r="1"/>
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
                  <button type="submit" aria-label="Submit search">Search</button>
                </form>
                <section
                  id="search-results"
                  role="region"
                  aria-live="polite"
                  aria-label="Search results"
                ></section>
              </section>
            </dialog>
          </header>

          <main id="content-main" class="content-main">
            <div id="content-area" class="htmx-swappable">
              {children}
            </div>
          </main>

          <footer>
            <p>
              Claude &
              <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
                <span>⊣˚∆˚⊢</span>
              </a>
              vibe coded together...
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}