import type { TagInfo } from "../lib/types.ts";

export const TagIndex = (props: { readonly tags: readonly TagInfo[] }) => {
  const { tags } = props;

  return (
    <main>
      <h2>Tags</h2>
      {tags.length === 0 ? <p>No tags found.</p> : (
        <div class="tags">
          {tags.map((tag, index) => (
            <>
              <a
                href={`/tags/${encodeURIComponent(tag.name)}`}
                get={`/tags/${encodeURIComponent(tag.name)}`}
                target="#content-area"
                swap="innerHTML"
                pushUrl="true"
                class="tag"
              >
                {tag.name}({tag.count})
              </a>
              {index < tags.length - 1 && " "}
            </>
          ))}
        </div>
      )}
    </main>
  );
};
