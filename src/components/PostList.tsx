import type { Post, TagName } from "../lib/types.ts";

export const PostList = (props: { 
  readonly posts: readonly Post[]; 
  readonly activeTag?: TagName;
}) => {
  const { posts, activeTag } = props;

  return (
    <main>
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
            <li>
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
                    {post.tags.map((tag, index) => (
                      <>
                        <a
                          href={`/tags/${encodeURIComponent(tag)}`}
                          hx-get={`/tags/${encodeURIComponent(tag)}`}
                          hx-target="#content-area"
                          hx-swap="innerHTML"
                          hx-push-url="true"
                          class="tag"
                        >
                          {tag}
                        </a>
                        {index < (post.tags?.length ?? 0) - 1 && " "}
                      </>
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