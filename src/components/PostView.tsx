// Individual post view component for mono-jsx
import { Post } from "../types.ts";

interface PostViewProps {
  post: Post;
}

export function PostView({ post }: PostViewProps) {
  return (
    <main>
      <article>
        <header>
          <h1>{post.title}</h1>
          <time dateTime={post.date}>
            {post.formattedDate || new Date(post.date).toLocaleDateString()}
          </time>
          {post.tags && post.tags.length > 0 && (
            <ul role="list" class="post-tags">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <a href={`/tags/${tag}`}>#{tag}</a>
                </li>
              ))}
            </ul>
          )}
        </header>
        <section>
          <div innerHTML={post.content}></div>
        </section>
      </article>
    </main>
  );
}