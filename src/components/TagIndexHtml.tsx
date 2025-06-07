import { TagInfo } from "../types.ts";
import { createHtmxLink } from "../utils/html-helpers.ts";

export const renderTagIndexHtml = (tags: TagInfo[]): string => {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  const tagLinks = sortedTags.map((tag) => {
    const sizeClass = tag.count >= 10 ? "lg" : tag.count >= 5 ? "md" : "sm";

    return createHtmxLink(
      `/tags/${tag.name}`,
      `${tag.name} <span class="tag-count">${tag.count}</span>`,
      `tag tag-${sizeClass} link`,
      `title="${tag.count} posts"`,
    );
  }).join("");

  return `<section class="tag-index content-section">
    <h1>Tags</h1>
    <div class="tag-cloud">
      ${tagLinks}
    </div>
  </section>`;
};
