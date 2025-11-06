import type { TagsByTopic } from "../config/topics.ts";

export const TopicsIndex = (props: { readonly groups: TagsByTopic }) => {
  const { groups } = props;

  return (
    <>
      <h1 class="topics-title">Topics & Tags</h1>
      {groups.length === 0 ? <p>No tags found.</p> : (
        groups.map(({ topic, tags }) => {
          const headingId = `topic-${
            topic.toLowerCase().replace(/[^a-z0-9]+/gi, "-")
          }`;
          return (
            <section
              class="topic-section"
              key={topic}
              aria-labelledby={headingId}
            >
              <h2 id={headingId} style="text-align: center;">{topic}</h2>
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
                      {tag.name} ({tag.count})
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
};
