import type { TagsByTopic } from "../config/topics.ts";

export const TopicsIndex = (props: { readonly groups: TagsByTopic }) => {
  const { groups } = props;

  return (
    <>
      <h1>Topics & Tags</h1>
      {groups.length === 0 ? (
        <p>No tags found.</p>
      ) : (
        groups.map(({ topic, tags }) => (
          <section key={topic}>
            <h2>{topic}</h2>
            <ul class="tag-grid" aria-label={`${topic} tags`}>
              {tags.map((tag) => (
                <li key={tag.name}>
                  <a
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    hx-get={`/tags/${encodeURIComponent(tag.name)}`}
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                    class="tag"
                  >
                    {tag.name}
                  </a>
                  <small>({tag.count})</small>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
};
