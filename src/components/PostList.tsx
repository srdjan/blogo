/**
 * Components for rendering lists of posts
 */

import { Post } from "../types.ts";
import type { Pagination as PaginationType } from "../pagination.ts";
import { Tags } from "./Post.tsx";
import { formatDate } from "../utils.ts";

// Helper function to get formatted date from a post
const getFormattedDate = (post: Post): string => {
  return post.formattedDate || formatDate(post.date);
};

// Component for rendering a post card in the list
export const PostCard = ({ post }: { post: Post }) => {
  const formattedDate = getFormattedDate(post);

  return (
    <article class="post-card">
      <div class="post-card-inner">
        <h2>
          <a
            href={`/posts/${post.slug}`}
            class="link"
            hx-get={`/posts/${post.slug}`}
            hx-target="#content-area"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            {post.title}
          </a>
        </h2>
        <div class="post-meta">
          <time dateTime={post.date}>{formattedDate}</time>
          {post.tags && <Tags tags={post.tags} />}
        </div>
        {post.excerpt && <p class="post-excerpt">{post.excerpt}</p>}
      </div>
    </article>
  );
};

// Component for rendering pagination controls
export const Pagination = ({ pagination }: { pagination: PaginationType }) => {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return <div></div>; // Return empty div instead of null
  }

  // Generate page numbers to show
  const pageNumbers: Array<number | null> = [];

  // Always show first page
  pageNumbers.push(1);

  // Add ellipsis if needed
  if (currentPage > 3) {
    pageNumbers.push(null); // represents ellipsis
  }

  // Show nearby pages
  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    pageNumbers.push(i);
  }

  // Add ellipsis if needed
  if (currentPage < totalPages - 2) {
    pageNumbers.push(null); // represents ellipsis
  }

  // Always show last page if it's not the only page
  if (totalPages > 1) {
    pageNumbers.push(totalPages);
  }

  return (
    <nav class="pagination content-section" aria-label="Pagination Navigation">
      {hasPrevPage ? (
        <a
          href={`?page=${currentPage - 1}`}
          class="pagination-prev link"
          hx-get={`?page=${currentPage - 1}`}
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
          aria-label="Previous page"
        >
          Previous
        </a>
      ) : (
        <span class="pagination-prev pagination-disabled" aria-disabled="true">
          Previous
        </span>
      )}

      <div class="pagination-pages">
        {pageNumbers.map((page, index) => {
          if (page === null) {
            return <span key={`ellipsis-${index}`} class="pagination-ellipsis">&hellip;</span>;
          }

          if (page === currentPage) {
            return <span key={`current-${page}`} class="pagination-current" aria-current="page">{page}</span>;
          }

          return (
            <a
              key={`page-${page}`}
              href={`?page=${page}`}
              class="link"
              hx-get={`?page=${page}`}
              hx-target="#content-area"
              hx-swap="innerHTML"
              hx-push-url="true"
            >
              {page}
            </a>
          );
        })}
      </div>

      {hasNextPage ? (
        <a
          href={`?page=${currentPage + 1}`}
          class="pagination-next link"
          hx-get={`?page=${currentPage + 1}`}
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
          aria-label="Next page"
        >
          Next
        </a>
      ) : (
        <span class="pagination-next pagination-disabled" aria-disabled="true">
          Next
        </span>
      )}

      <div class="pagination-info">
        <p>Page {currentPage} of {totalPages}</p>
      </div>
    </nav>
  );
};

// Component for rendering a list of posts
export const PostList = ({
  posts,
  activeTag,
  pagination
}: {
  posts: Post[];
  activeTag?: string;
  pagination?: PaginationType;
}) => {
  return (
    <section class="post-list content-section">
      <div class="content-wrapper">
        {activeTag && (
          <div class="tag-header-container">
            <h1>Posts Tagged "{activeTag}"</h1>
            <div class="tag-filter-header">
              <p>
                Showing {posts.length} post{posts.length !== 1 ? "s" : ""} tagged with <strong>{activeTag}</strong>
              </p>
              <a
                href="/"
                class="button link"
                hx-get="/"
                hx-target="#content-area"
                hx-swap="innerHTML"
                hx-push-url="true"
              >
                Show All Posts
              </a>
            </div>
          </div>
        )}

        <div class="post-cards-container">
          {posts.length > 0 ? (
            posts.map(post => <PostCard key={post.slug} post={post} />)
          ) : (
            <div class="empty-state">
              <p>No posts found{activeTag ? ` tagged with "${activeTag}"` : ""}.</p>
            </div>
          )}
        </div>

        {pagination && <Pagination pagination={pagination} />}
      </div>
    </section>
  );
};
