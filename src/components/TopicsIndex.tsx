import type { TagsByTopic } from "../config/topics.ts";

export const TopicsIndex = (props: { readonly groups: TagsByTopic }) => {
  const { groups } = props;

  return (
    <>
      <h1>Topics & Tags</h1>
      {groups.length === 0 ? <p>No tags found.</p> : (
        groups.map(({ topic, tags }) => {
          const headingId = `topic-${
            topic.toLowerCase().replace(/[^a-z0-9]+/gi, "-")
          }`;
          return (
            <section
              key={topic}
              aria-labelledby={headingId}
            >
              <h2 id={headingId}>{topic}</h2>
              <p>
                {tags.map((tag, index) => (
                  <>
                    {index > 0 && " • "}
                    <a
                      href={`/tags/${encodeURIComponent(tag.name)}`}
                      hx-get={`/tags/${encodeURIComponent(tag.name)}`}
                      hx-target="#content-area"
                      hx-swap="innerHTML"
                      hx-push-url="true"
                    >
                      {tag.name} ({tag.count})
                    </a>
                  </>
                ))}
              </p>
              <hr />
            </section>
          );
        })
      )}
    </>
  );
};
