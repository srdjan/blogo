// Individual post view component for mono-jsx
import type { Post } from "../lib/types.ts";
import { html } from "mono-jsx/jsx-runtime";

export const PostView = (props: { readonly post: Post }) => {
  const { post } = props;

  return (
    <main>
      <article>
        <header>
          <h1>{post.title}</h1>
          {post.formattedDate && <time>{post.formattedDate}</time>}
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