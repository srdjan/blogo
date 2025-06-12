import { Post } from "../types.ts";

// Helper to create post excerpt
function renderPostExcerpt(post: Post) {
  if (!post.excerpt) return null;

  return (
    <summary>
      {post.excerpt}
    </summary>
  );
}

// Helper to create post meta information
function renderPostMeta(post: Post) {
  const formattedDate = post.formattedDate ||
    new Date(post.date).toLocaleDateString();

  return (
    <div>
      <time dateTime={post.date}>{formattedDate}</time>
      {post.tags && post.tags.length > 0
        ? (
          <ul role="list">
            {post.tags.map((tag) => (
              <li key={tag}>
                <a href={`/tags/${tag}`}>#{tag}</a>
              </li>
            ))}
          </ul>
        )
        : null}
    </div>
  );
}

export function SearchResultsHtml(
  { posts, query }: { posts: Post[]; query: string },
) {
  return (
    <main>
      <header>
        <h1>Search Results</h1>
        <p>
          Results for: <strong>"{query}"</strong>
        </p>
      </header>

      <section>
        {posts.length > 0
          ? (
            posts.map((post) => (
              <article key={post.slug}>
                <header>
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
                  {renderPostMeta(post)}
                </header>
                {renderPostExcerpt(post)}
              </article>
            ))
          )
          : (
            <aside>
              <p>No posts found for "{query}".</p>
              <a
                href="/"
                hx-get="/"
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
              >
                ← Back to all posts
              </a>
            </aside>
          )}
      </section>
    </main>
  );
}
