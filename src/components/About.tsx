export const About = () => {
  return (
    <>
      <h1 class="u-text-center">About This Blog</h1>
      <p>
        This is a minimal blog built with{" "}
        <a
          href="https://github.com/srdjan/mono-jsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          mono-jsx
        </a>{" "}
        and HTMX for seamless navigation.
      </p>

      <h2 class="u-text-center">Features</h2>
      <ul class="u-inline-block u-text-center u-center-inline">
        <li>Server-side rendering with mono-jsx</li>
        <li>HTMX for dynamic content loading</li>
        <li>Markdown content with frontmatter</li>
        <li>Tag-based organization</li>
        <li>Search functionality</li>
        <li>RSS feed</li>
        <li>SEO optimized</li>
      </ul>
      <nav class="u-shell u-text-center">
        <a href="/">← Back to home</a>
      </nav>
    </>
  );
};
