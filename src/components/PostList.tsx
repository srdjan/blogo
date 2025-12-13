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
      {activeTag && (
        <p>
          <a
            href="/tags"
            hx-get="/tags"
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            ← View all tags
          </a>
        </p>
      )}
      {posts.length === 0 ? <p>No posts found.</p> : (
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
                <p>
                  {post.formattedDate && (
                    <time dateTime={post.date}>{post.formattedDate}</time>
                  )}
                  {post.formattedDate && post.viewCount && " • "}
                  <ViewCount count={post.viewCount} />
                </p>
                {post.excerpt && <p>{post.excerpt}</p>}
                {post.tags && post.tags.length > 0 && (
                  <p>
                    <small>
                      Tags: {post.tags.map((tag, index) => (
                        <>
                          {index > 0 && ", "}
                          <a
                            href={`/tags/${encodeURIComponent(tag)}`}
                            hx-get={`/tags/${encodeURIComponent(tag)}`}
                            hx-target="#content-area"
                            hx-swap="innerHTML"
                            hx-push-url="true"
                            rel="tag"
                          >
                            {tag}
                          </a>
                        </>
                      ))}
                    </small>
                  </p>
                )}
              </article>
              <hr />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
