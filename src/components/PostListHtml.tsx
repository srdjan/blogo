import { Post } from "../types.ts";

// Define Pagination type locally
type Pagination = {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

// Helper to create post excerpt
function renderPostExcerpt(post: Post) {
  if (!post.excerpt) return null;

  return (
    <summary>
      {post.excerpt}
    </summary>
  );
}

// Helper to create post meta information
function renderPostMeta(post: Post) {
  const formattedDate = post.formattedDate ||
    new Date(post.date).toLocaleDateString();

  return (
    <div>
      <time dateTime={post.date}>{formattedDate}</time>
      {post.tags && post.tags.length > 0
        ? (
          <div>
            {post.tags.map((tag) => <a key={tag} href={`/tags/${tag}`}>#{tag}</a>)}
          </div>
        )
        : null}
    </div>
  );
}

// Helper to create pagination
function renderPagination(pagination: Pagination, activeTag?: string) {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;

  const baseUrl = activeTag ? `/tags/${activeTag}` : "/";

  return (
    <nav aria-label="pagination">
      {hasPrevPage
        ? (
          <a
            href={`${baseUrl}?page=${currentPage - 1}`}
            hx-get={`${baseUrl}?page=${currentPage - 1}`}
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
            aria-label="Previous page"
          >
            Previous
          </a>
        )
        : <span aria-disabled="true">Previous</span>}

      <span>Page {currentPage} of {totalPages}</span>

      {hasNextPage
        ? (
          <a
            href={`${baseUrl}?page=${currentPage + 1}`}
            hx-get={`${baseUrl}?page=${currentPage + 1}`}
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
            aria-label="Next page"
          >
            Next
          </a>
        )
        : <span aria-disabled="true">Next</span>}
    </nav>
  );
}

export function PostListHtml({
  posts,
  activeTag,
  pagination,
}: {
  posts: Post[];
  activeTag?: string;
  pagination?: Pagination;
}) {
  return (
    <main>
      {activeTag
        ? (
          <header>
            <h1>Posts Tagged "{activeTag}"</h1>
            <aside role="banner">
              <p>
                Showing {posts.length} {posts.length === 1 ? "post" : "posts"}
                {" "}
                tagged with <strong>{activeTag}</strong>
              </p>
              <a
                href="/"
                hx-get="/"
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
              >
                Show All Posts
              </a>
            </aside>
          </header>
        )
        : null}

      <section>
        {posts.length > 0
          ? (
            posts.map((post) => (
              <article key={post.slug}>
                <header>
                  <h2>
                    <a
                      href={`/posts/${post.slug}`}
                      hx-get={`/posts/${post.slug}`}
                      hx-target="#content-area"
                      hx-swap="innerHTML"
                      hx-push-url="true"
                    >
                      {post.title}
                    </a>
                  </h2>
                  {renderPostMeta(post)}
                </header>
                {renderPostExcerpt(post)}
              </article>
            ))
          )
          : (
            <aside>
              <p>
                No posts found{activeTag ? ` tagged with "${activeTag}"` : ""}.
              </p>
            </aside>
          )}
      </section>

      {pagination ? renderPagination(pagination, activeTag) : null}
    </main>
  );
}
