import type { Post, TagInfo, TagName } from "../lib/types.ts";

// Create a raw HTML fragment that mono-jsx can render
const createRawHTML = (html: string): string => html;

export const PostList = (props: { 
  readonly posts: readonly Post[]; 
  readonly activeTag?: TagName;
}): JSX.Element => {
  const { posts, activeTag } = props;

  return (
    <main>
      <h1>Blog Posts</h1>
      {activeTag && (
        <p>
          Posts tagged with <strong>{activeTag}</strong> -{" "}
          <a href="/tags">View all tags</a>
        </p>
      )}
      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <ul>
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2>
                  <a
                    href={`/posts/${post.slug}`}
                    hx-get={`/posts/${post.slug}`}
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    {post.title}
                  </a>
                </h2>
                {post.formattedDate && <time>{post.formattedDate}</time>}
                {post.excerpt && <p>{post.excerpt}</p>}
                {post.tags && post.tags.length > 0 && (
                  <div class="tags">
                    {post.tags.map((tag) => (
                      <a
                        key={tag}
                        href={`/tags/${encodeURIComponent(tag)}`}
                        hx-get={`/tags/${encodeURIComponent(tag)}`}
                        hx-target="#content-area"
                        hx-swap="innerHTML"
                        hx-push-url="true"
                        class="tag"
                      >
                        {tag}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export const PostView = (props: { readonly post: Post }): JSX.Element => {
  const { post } = props;

  return (
    <main>
      <article>
        <header>
          <h1>{post.title}</h1>
          {post.formattedDate && <time>{post.formattedDate}</time>}
          {post.tags && post.tags.length > 0 && (
            <div class="tags">
              {post.tags.map((tag) => (
                <a
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  hx-get={`/tags/${encodeURIComponent(tag)}`}
                  hx-target="#content-area"
                  hx-swap="innerHTML"
                  hx-push-url="true"
                  class="tag"
                >
                  {tag}
                </a>
              ))}
            </div>
          )}
        </header>
        <div class="content">
          {html(post.content)}
        </div>
      </article>
      <nav>
        <a href="/">← Back to home</a>
      </nav>
    </main>
  );
};

export const TagIndex = (props: { readonly tags: readonly TagInfo[] }): JSX.Element => {
  const { tags } = props;

  return (
    <main>
      <h1>Tags</h1>
      {tags.length === 0 ? (
        <p>No tags found.</p>
      ) : (
        <ul>
          {tags.map((tag) => (
            <li key={tag.name}>
              <a
                href={`/tags/${encodeURIComponent(tag.name)}`}
                hx-get={`/tags/${encodeURIComponent(tag.name)}`}
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
              >
                {tag.name} ({tag.count})
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export const SearchResults = (props: { 
  readonly posts: readonly Post[]; 
  readonly query: string;
}): JSX.Element => {
  const { posts, query } = props;

  return (
    <main>
      <h1>Search Results</h1>
      <p>
        {posts.length === 0
          ? `No posts found for "${query}".`
          : `Found ${posts.length} post${posts.length === 1 ? "" : "s"} for "${query}".`}
      </p>
      {posts.length > 0 && (
        <ul>
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2>
                  <a
                    href={`/posts/${post.slug}`}
                    hx-get={`/posts/${post.slug}`}
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                  >
                    {post.title}
                  </a>
                </h2>
                {post.formattedDate && <time>{post.formattedDate}</time>}
                {post.excerpt && <p>{post.excerpt}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
      <nav>
        <a href="/">← Back to home</a>
      </nav>
    </main>
  );
};

export const About = (): JSX.Element => {
  return (
    <main>
      <h1>About This Blog</h1>
      <p>
        This is a minimal blog built with{" "}
        <a href="https://github.com/srdjan/mono-jsx" target="_blank" rel="noopener noreferrer">
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

      <h2>Technology Stack</h2>
      <ul>
        <li>Deno runtime</li>
        <li>TypeScript</li>
        <li>mono-jsx for templating</li>
        <li>HTMX for interactivity</li>
        <li>Modern CSS with nesting</li>
      </ul>

      <nav>
        <a href="/">← Back to home</a>
      </nav>
    </main>
  );
};

export const NotFound = (): JSX.Element => {
  return (
    <main>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <nav>
        <a href="/">← Back to home</a>
      </nav>
    </main>
  );
};