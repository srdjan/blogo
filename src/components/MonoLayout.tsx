// Mono-jsx compatible Layout component - built incrementally
interface MonoLayoutProps {
  title: string;
  description?: string;
  children: any;
  path?: string;
}

export const MonoLayout = ({ title, description, children, path = "/" }: MonoLayoutProps) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="stylesheet" href="/css/main.css" />
        <link rel="alternate" href="/feed.xml" title={`${title} RSS Feed`} />
      </head>
      <body>
        <div id="app-layout">
          <header id="site-header">
            <nav>
              <ul>
                <li>
                  <a href="/" class={path === "/" ? "link active" : "link"}>
                    Home
                  </a>
                </li>
                <li>
                  <a href="/tags" class={path === "/tags" ? "link active" : "link"}>
                    Tags
                  </a>
                </li>
                <li>
                  <a href="/about" class={path === "/about" ? "link active" : "link"}>
                    About
                  </a>
                </li>
                <li>
                  <a href="/mono-test" class={path === "/mono-test" ? "link active" : "link"}>
                    Test
                  </a>
                </li>
              </ul>
            </nav>
          </header>

          <main id="content-main" class="content-main">
            <div id="content-area">
              {children}
            </div>
          </main>

          <footer>
            <p>
              Claude & Srdjan vibe coded together...
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
};