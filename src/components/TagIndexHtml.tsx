import { TagInfo } from "../types.ts";

export const renderTagIndexHtml = (tags: TagInfo[]): string => {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);
  
  const tagLinks = sortedTags.map(tag => {
    const sizeClass = tag.count >= 10 ? "lg" : tag.count >= 5 ? "md" : "sm";
    
    return `<a
      href="/tags/${tag.name}"
      class="tag tag-${sizeClass} link"
      hx-get="/tags/${tag.name}"
      hx-target="#content-area"
      hx-swap="innerHTML"
      hx-push-url="true"
      title="${tag.count} posts"
    >
      ${tag.name}
      <span class="tag-count">${tag.count}</span>
    </a>`;
  }).join("");
  
  return `<section class="tag-index content-section">
    <h1>Tags</h1>
    <div class="tag-cloud">
      ${tagLinks}
    </div>
  </section>`;
};
