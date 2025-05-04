/**
 * Tag index component
 */

import { TagInfo } from "../types.ts";

// Helper function to determine tag size class based on count
const sizeClassForCount = (count: number): string => {
  if (count >= 10) return "lg";
  if (count >= 5) return "md";
  return "sm";
};

// Component for rendering a single tag in the tag cloud
export const TagCloudItem = ({ tag, count }: { tag: string; count: number }) => {
  const sizeClass = sizeClassForCount(count);

  return (
    <a
      href={`/tags/${tag}`}
      class={`tag tag-${sizeClass} link`}
      hx-get={`/tags/${tag}`}
      hx-target="#content-area"
      hx-swap="innerHTML"
      hx-push-url="true"
      title={`${count} posts`}
    >
      {tag}
      <span class="tag-count">{count}</span>
    </a>
  );
};

// Component for rendering the tag index page
export const TagIndex = ({ tags }: { tags: TagInfo[] }) => {
  // Sort tags by count (descending)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <section class="tag-index content-section">
      <h1>Tags</h1>
      <div class="tag-cloud">
        {sortedTags.map(tag => (
          <TagCloudItem key={tag.name} tag={tag.name} count={tag.count} />
        ))}
      </div>
    </section>
  );
};
