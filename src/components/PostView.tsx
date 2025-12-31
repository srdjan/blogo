// Individual post view component for hsx
import type { Post } from "../lib/types.ts";
import { html } from "../http/render-vnode.ts";
import { deriveTopicsFromTags } from "../config/topics.ts";
import { ViewCount } from "./ViewCount.tsx";

export const PostView = (props: { readonly post: Post }) => {
  const { post } = props;

  return (
    <>
      <article class="post-content">
        <header class="post-header">
          <h1>{post.title}</h1>
          <div class="post-meta">
            {post.formattedDate && (
              <time dateTime={post.date}>{post.formattedDate}</time>
            )}
            <ViewCount count={post.viewCount} />
          </div>
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
          get="/"
          target="#content-area"
          swap="innerHTML"
          pushUrl="true"
        >
          &lArr; Back
        </a>
      </nav>
    </>
  );
};
