// Render helper functions for mono-jsx compatibility (replacing string-based components)
import { Post, TagInfo } from "../types.ts";
import { AboutHtml } from "../components/AboutHtml.tsx";
import { TagIndexHtml } from "../components/TagIndexHtml.tsx";

// Define Pagination type locally since we deleted the pagination.ts file
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
    <p class="post-excerpt">
      {post.excerpt}
    </p>
  );
}

// Helper to create post meta information
function renderPostMeta(post: Post) {
  const formattedDate = post.formattedDate || new Date(post.date).toLocaleDateString();
  
  return (
    <div class="post-meta">
      <time dateTime={post.date}>{formattedDate}</time>
{post.tags && post.tags.length > 0 ? (
        <div class="post-tags">
          {post.tags.map(tag => (
            <a href={`/tags/${tag}`} class="tag-link">#{tag}</a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Helper to create pagination
function renderPagination(pagination: Pagination, activeTag?: string) {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;
  
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;

  const baseUrl = activeTag ? `/tags/${activeTag}` : '/';
  
  return (
    <nav aria-label="pagination" class="pagination">
      {hasPrevPage ? (
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
      ) : (
        <span aria-disabled="true">Previous</span>
      )}
      
      <span>Page {currentPage} of {totalPages}</span>
      
      {hasNextPage ? (
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
      ) : (
        <span aria-disabled="true">Next</span>
      )}
    </nav>
  );
}

// Create post list content
export function createPostList(posts: Post[], activeTag?: string, pagination?: Pagination) {
  return (
    <main>
{activeTag ? (
        <header>
          <h1>Posts Tagged "{activeTag}"</h1>
          <aside role="banner">
            <p>
              Showing {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged with <strong>{activeTag}</strong>
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
      ) : null}
      
      <section>
        {posts.length > 0 ? (
          posts.map(post => (
            <article>
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
        ) : (
          <aside>
            <p>No posts found{activeTag ? ` tagged with "${activeTag}"` : ''}.</p>
          </aside>
        )}
      </section>
      
{pagination ? renderPagination(pagination, activeTag) : null}
    </main>
  );
}

// Create tag index content
export function createTagIndex(tags: TagInfo[]) {
  return <TagIndexHtml tags={tags} />;
}


// Create about page content
export function createAbout() {
  return <AboutHtml />;
}

// Create search results content  
export function createSearchResults(posts: Post[], query: string) {
  return (
    <main>
      <header>
        <h1>Search Results</h1>
        <p>Results for: <strong>"{query}"</strong></p>
      </header>
      
      <section>
        {posts.length > 0 ? (
          posts.map(post => (
            <article>
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
        ) : (
          <aside>
            <p>No posts found for "{query}".</p>
            <a 
              href="/"
              hx-get="/"
              hx-target="#content-area"
              hx-swap="innerHTML"
              hx-push-url="true"
            >
              ← Back to all posts
            </a>
          </aside>
        )}
      </section>
    </main>
  );
}