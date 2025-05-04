/**
 * Post component for rendering a blog post
 * Uses mono-jsx exclusively for rendering, including markdown content
 */

import { Post as PostType } from "../types.ts";
import { formatDate } from "../utils.ts";
import { htmlToJsx } from "../utils/html-to-jsx.tsx";

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

// Component for rendering post content
const PostContentBody = ({ post }: { post: PostType }) => {
  // Use JSX content if available, otherwise convert HTML to JSX
  if (post.contentJsx) {
    return <div class="post-content">{post.contentJsx}</div>;
  }
  
  // Fallback to converting HTML to JSX
  return <div class="post-content">{htmlToJsx(post.content)}</div>;
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
      <PostContentBody post={post} />
    </article>
  );
};
