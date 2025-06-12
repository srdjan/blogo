import { TagInfo } from "../types.ts";

export function TagIndexHtml({ tags }: { tags: TagInfo[] }) {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <section>
      <h1>Tags</h1>
      <ul role="list">
        {sortedTags.map((tag) => {
          const sizeClass = tag.count >= 10 ? "lg" : tag.count >= 5 ? "md" : "sm";
          return (
            <li>
              <a 
                href={`/tags/${tag.name}`}
                hx-get={`/tags/${tag.name}`}
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
                class={`tag-${sizeClass}`}
                title={`${tag.count} posts`}
              >
                # {tag.name}
              </a>
              {' '}
              <small>{tag.count}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
