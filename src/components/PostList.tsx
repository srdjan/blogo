import type { Post, TagName } from "../lib/types.ts";
import { ViewCount } from "./ViewCount.tsx";

export const PostList = (props: {
  readonly posts: readonly Post[];
  readonly activeTag?: TagName;
}) => {
  const { posts, activeTag } = props;

  return (
    <section aria-label={activeTag ? `Posts tagged ${activeTag}` : "Latest posts"}>
      <header class="post-list-header">
        <h1>
          {activeTag ? `Posts tagged with ${activeTag}` : "Latest Posts"}
        </h1>
        {activeTag && (
          <p>
            <a
              href="/tags"
              hx-get="/tags"
              hx-target="#content-area"
              hx-swap="innerHTML"
              hx-push-url="true"
            >
              View all tags
            </a>
          </p>
        )}
      </header>
      {posts.length === 0 ? (
        <p>No posts found.</p>
      ) : (
        <ul class="post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <article class="post-card">
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
                <div class="post-card-meta">
                  {post.formattedDate && (
                    <time dateTime={post.date}>{post.formattedDate}</time>
                  )}
                  <ViewCount count={post.viewCount} />
                </div>
                {post.excerpt && <p>{post.excerpt}</p>}
                {post.tags && post.tags.length > 0 && (
                  <nav class="tags" aria-label="Post tags">
                    <ul>
                      {post.tags.map((tag) => (
                        <li key={`${post.slug}-${tag}`}>
                          <a
                            href={`/tags/${encodeURIComponent(tag)}`}
                            hx-get={`/tags/${encodeURIComponent(tag)}`}
                            hx-target="#content-area"
                            hx-swap="innerHTML"
                            hx-push-url="true"
                            class="tag"
                            rel="tag"
                          >
                            {tag}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
