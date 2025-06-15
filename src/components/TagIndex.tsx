import { TagInfo } from "../types.ts";

export function TagIndex({ tags }: { tags: TagInfo[] }) {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <section>
      <ul role="list">
        {sortedTags.map((tag) => {
          return (
            <li>
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
