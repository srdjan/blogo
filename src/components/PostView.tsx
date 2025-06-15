// Individual post view component for mono-jsx
import { Post } from "../types.ts";

interface PostViewProps {
  post: Post;
}

export function PostView({ post }: PostViewProps) {
  return (
    <main>
      <article {...({itemScope: true, itemType: "https://schema.org/BlogPosting"} as any)}>
        <header>
          <h1 {...({itemProp: "headline"} as any)}>{post.title}</h1>
          <div class="post-meta">
            <time dateTime={post.date} {...({itemProp: "datePublished"} as any)}>
              {post.formattedDate || new Date(post.date).toLocaleDateString()}
            </time>
            {post.modified && (
              <time dateTime={post.modified} {...({itemProp: "dateModified"} as any)} class="modified-date">
                Updated: {new Date(post.modified).toLocaleDateString()}
              </time>
            )}
            <span {...({itemProp: "author", itemScope: true, itemType: "https://schema.org/Person"} as any)}>
              <meta {...({itemProp: "name", content: "Claude & Srdjan"} as any)} />
            </span>
          </div>
          {post.tags && post.tags.length > 0 && (
            <ul role="list" class="post-tags">
              {post.tags.map((tag) => (
                <li>
                  <a href={`/tags/${tag}`} rel="tag" {...({itemProp: "keywords"} as any)}>#{tag}</a>
                </li>
              ))}
            </ul>
          )}
        </header>
        <section {...({itemProp: "articleBody"} as any)}>
          <div {...({innerHTML: post.content} as any)}></div>
        </section>
        {post.excerpt && (
          <meta {...({itemProp: "description", content: post.excerpt} as any)} />
        )}
      </article>
    </main>
  );
}