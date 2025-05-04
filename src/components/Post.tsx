/**
 * Post component for rendering a blog post
 */

import { Post as PostType } from "../types.ts";
import { formatDate } from "../utils.ts";

// Helper function to get formatted date from a post
const getFormattedDate = (post: PostType): string => {
  return post.formattedDate || formatDate(post.date);
};

// Component for rendering tags
export const Tags = ({ tags }: { tags: string[] }) => {
  if (!tags || tags.length === 0) return <div></div>; // Return empty div instead of null

  return (
    <div class="tags">
      {tags.map(tag => (
        <a
          key={tag}
          href={`/tags/${tag}`}
          class="tag link"
          hx-get={`/tags/${tag}`}
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          {tag}
        </a>
      ))}
    </div>
  );
};

// Component for rendering a single post
export const PostContent = ({ post }: { post: PostType }) => {
  const formattedDate = getFormattedDate(post);

  return (
    <article class="post content-section">
      <div class="post-meta-subtle">
        <time dateTime={post.date}>
          {formattedDate} {post.tags && <Tags tags={post.tags} />}
        </time>
      </div>
      <div class="post-content">
        {html`${post.content}`}
      </div>
    </article>
  );
};
