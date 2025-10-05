import type { TagInfo } from "../lib/types.ts";

export const TagIndex = (props: { readonly tags: readonly TagInfo[] }) => {
  const { tags } = props;

  return (
    <main>
      <h2>Tags</h2>
      {tags.length === 0 ? (
        <p>No tags found.</p>
      ) : (
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
      )}
    </main>
  );
};