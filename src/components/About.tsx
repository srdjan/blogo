export const About = () => {
  return (
    <div class="about-content">
      <h1>About This Blog</h1>
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

      <h2>Features</h2>
      <ul>
        <li>Server-side rendering with mono-jsx</li>
        <li>HTMX for dynamic content loading</li>
        <li>Markdown content with frontmatter</li>
        <li>Tag-based organization</li>
        <li>Search functionality</li>
        <li>RSS feed</li>
        <li>SEO optimized</li>
      </ul>
      <nav style="text-align: center; margin-top: var(--space-xl);">
        <a href="/">← Back to home</a>
      </nav>
    </div>
  );
};
