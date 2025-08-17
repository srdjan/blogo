// Individual post view component for mono-jsx
import type { Post } from "../lib/types.ts";

interface PostViewProps {
  post: Post;
}

export function PostView({ post }: PostViewProps) {
  return (
    <main>
      <article itemScope itemType="https://schema.org/BlogPosting">
        <header>
          <h1 itemProp="headline">{post.title}</h1>
          <div class="post-meta">
            <time dateTime={post.date} itemProp="datePublished">
              {post.formattedDate || new Date(post.date).toLocaleDateString()}
            </time>
            {post.modified && (
              <time dateTime={post.modified} itemProp="dateModified" class="modified-date">
                Updated: {new Date(post.modified).toLocaleDateString()}
              </time>
            )}
            <span itemProp="author" itemScope itemType="https://schema.org/Person">
              <meta itemProp="name" content="Claude & Srdjan" />
            </span>
          </div>
          {post.tags && post.tags.length > 0 && (
            <ul role="list" class="post-tags">
              {post.tags.map((tag) => (
                <li>
                  <a href={`/tags/${tag}`} rel="tag" itemProp="keywords">#{tag}</a>
                </li>
              ))}
            </ul>
          )}
        </header>
        <section itemProp="articleBody">
          <div dangerouslySetInnerHTML={{__html: post.content}}></div>
        </section>
        {post.excerpt && (
          <meta itemProp="description" content={post.excerpt} />
        )}
      </article>
    </main>
  );
}