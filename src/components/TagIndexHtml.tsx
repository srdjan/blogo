import { TagInfo } from "../types.ts";
import { createHtmxLink } from "../utils/html-helpers.ts";

export const renderTagIndexHtml = (tags: TagInfo[]): string => {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  const tagLinks = sortedTags.map((tag) => {
    const sizeClass = tag.count >= 10 ? "lg" : tag.count >= 5 ? "md" : "sm";
    const tagLink = createHtmxLink(
      `/tags/${tag.name}`,
      tag.name,
      `tag-${sizeClass}`,
      `title="${tag.count} posts"`,
    );
    const count = `<small>${tag.count}</small>`;

    return `<li>${tagLink} ${count}</li>`;
  }).join("");

  return `<section>
    <h1>Tags</h1>
    <ul role="list">
      ${tagLinks}
    </ul>
  </section>`;
};
