import type { Post } from "../lib/types.ts";

export const SearchResults = (props: {
  readonly posts: readonly Post[];
  readonly query: string;
}) => {
  const { posts, query } = props;

  return (
    <>
      <h2>Search Results</h2>
      <p>
        {posts.length === 0
          ? `No posts found for "${query}".`
          : `Found ${posts.length} post${posts.length === 1 ? "" : "s"} for "${query}".`}
      </p>
      {posts.length > 0 && (
        <ul class="post-list u-flow-lg">
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
              </article>
            </li>
          ))}
        </ul>
      )}
      <nav class="u-shell u-text-center">
        <a href="/">&lArr; Back to home</a>
      </nav>
    </>
  );
};
