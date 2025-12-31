import type { Post, TagName } from "../lib/types.ts";
import { ViewCount } from "./ViewCount.tsx";

export const PostList = (props: {
  readonly posts: readonly Post[];
  readonly activeTag?: TagName;
}) => {
  const { posts, activeTag } = props;

  return (
    <section
      aria-label={activeTag ? `Posts tagged ${activeTag}` : "Latest posts"}
    >
      <header class="post-list-header">
        {activeTag && (
          <p>
            <a
              href="/tags"
              get="/tags"
              target="#content-area"
              swap="innerHTML"
              pushUrl="true"
            >
              View all tags
            </a>
          </p>
        )}
      </header>
      {posts.length === 0 ? <p>No posts found.</p> : (
        <ul class="post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <article class="post-card">
                <h2>
                  <a
                    href={`/posts/${post.slug}`}
                    get={`/posts/${post.slug}`}
                    target="#content-area"
                    swap="innerHTML"
                    pushUrl="true"
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
                            get={`/tags/${encodeURIComponent(tag)}`}
                            target="#content-area"
                            swap="innerHTML"
                            pushUrl="true"
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
