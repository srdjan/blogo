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
          <div>
            <time dateTime={post.date}>
              {post.formattedDate || new Date(post.date).toLocaleDateString()}
            </time>
            {post.tags && post.tags.length > 0 && (
              <div>
                {post.tags.map((tag) => (
                  <a href={`/tags/${tag}`}>#{tag}</a>
                )).reduce((prev, curr, index) => (
                  index === 0 ? [curr] : [...prev, " ", curr]
                ), [] as (JSX.Element | string)[])}
              </div>
            )}
          </div>
        </header>
        <section>
          <div innerHTML={post.content}></div>
        </section>
      </article>
    </main>
  );
}