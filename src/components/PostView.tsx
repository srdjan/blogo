// Individual post view component for mono-jsx
import type { Post } from "../lib/types.ts";
import { html } from "mono-jsx/jsx-runtime";
import { deriveTopicsFromTags } from "../config/topics.ts";

export const PostView = (props: { readonly post: Post }) => {
  const { post } = props;

  return (
    <>
      <article class="post-content">
        <header class="post-header">
          <h1>{post.title}</h1>
          {post.formattedDate && (
            <p class="post-meta">
              <time dateTime={post.date}>{post.formattedDate}</time>
            </p>
          )}
          {/* Derived topics shown above tags for hierarchy */}
          {post.tags && post.tags.length > 0 && (() => {
            const topics = deriveTopicsFromTags(post.tags as readonly string[]);
            return topics.length > 0
              ? (
                <div class="topics">
                  <small>Topics: {topics.join(", ")}</small>
                </div>
              )
              : null;
          })()}
        </header>

        {post.tags && post.tags.length > 0 && (
          <nav class="tags" aria-label="Post tags">
            <ul>
              {post.tags.map((tag) => (
                <li>
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
        <section class="content">
          {html(post.content)}
        </section>
      </article>
      <nav
        style="text-align: center; margin-top: var(--space-xl);"
        aria-label="Post pagination"
      >
        <a
          href="/"
          hx-get="/"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          &lArr; Back to home
        </a>
      </nav>
    </>
  );
};
