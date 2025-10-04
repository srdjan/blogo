import type { TagsByTopic } from "../config/topics.ts";

export const TopicsIndex = (props: { readonly groups: TagsByTopic }) => {
  const { groups } = props;

  return (
    <main>
      <h1>Topics & Tags</h1>
      {groups.length === 0 ? (
        <p>No tags found.</p>
      ) : (
        groups.map(({ topic, tags }) => (
          <section>
            <h2>{topic}</h2>
            <div class="tags">
              {tags.map((tag, index) => (
                <>
                  <a
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    hx-get={`/tags/${encodeURIComponent(tag.name)}`}
                    hx-target="#content-area"
                    hx-swap="innerHTML"
                    hx-push-url="true"
                    class="tag"
                  >
                    {tag.name}({tag.count})
                  </a>
                  {index < tags.length - 1 && " "}
                </>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
};

