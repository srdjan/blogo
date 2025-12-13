// Individual post view component for mono-jsx
import type { Post } from "../lib/types.ts";
import { html } from "mono-jsx/jsx-runtime";
import { deriveTopicsFromTags } from "../config/topics.ts";
import { ViewCount } from "./ViewCount.tsx";

export const PostView = (props: { readonly post: Post }) => {
  const { post } = props;

  return (
    <>
      <article>
        <header>
          <h2>{post.title}</h2>
          <p>
            {post.formattedDate && (
              <time dateTime={post.date}>{post.formattedDate}</time>
            )}
            {post.formattedDate && post.viewCount && " • "}
            <ViewCount count={post.viewCount} />
          </p>
          {/* Derived topics shown above tags for hierarchy */}
          {post.tags && post.tags.length > 0 && (() => {
            const topics = deriveTopicsFromTags(post.tags as readonly string[]);
            return topics.length > 0
              ? (
                <p>
                  <small>Topics: {topics.join(", ")}</small>
                </p>
              )
              : null;
          })()}
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
        </header>

        <section>
          {html(post.content)}
        </section>
      </article>
      <hr />
      <nav aria-label="Post pagination">
        <p>
          <a
            href="/"
            hx-get="/"
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            ← Back to all posts
          </a>
        </p>
      </nav>
    </>
  );
};
