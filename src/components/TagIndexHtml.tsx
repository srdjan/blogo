import { TagInfo } from "../types.ts";

export function TagIndexHtml({ tags }: { tags: TagInfo[] }) {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <section>
      <h1>Tags</h1>
      <ul role="list">
        {sortedTags.map((tag) => {
          return (
            <li key={tag.name}>
              <a
                href={`/tags/${tag.name}`}
                hx-get={`/tags/${tag.name}`}
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
                title={`${tag.count} posts`}
              >
                # {tag.name}
              </a>{" "}
              <small>{tag.count}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
