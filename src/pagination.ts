// src/pagination.ts - Type-safe pagination utilities
import type { Post } from "./types.ts";

/**
 * Pagination metadata
 */
export interface Pagination {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginated collection of items
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

/**
 * Create a paginated result from a collection of items
 */
export const paginate = <T>(
  items: T[],
  page: number,
  itemsPerPage: number
): PaginatedResult<T> => {
  // Handle invalid inputs with defensive programming
  const safePage = Math.max(1, page);
  const safeItemsPerPage = Math.max(1, itemsPerPage);

  // Calculate pagination metadata
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / safeItemsPerPage);
  const currentPage = Math.min(safePage, totalPages || 1); // Ensure we don't exceed total pages

  // Calculate start and end indices
  const startIndex = (currentPage - 1) * safeItemsPerPage;
  const endIndex = Math.min(startIndex + safeItemsPerPage, totalItems);

  // Extract the current page of items
  const pageItems = items.slice(startIndex, endIndex);

  return {
    items: pageItems,
    pagination: {
      currentPage,
      totalPages,
      itemsPerPage: safeItemsPerPage,
      totalItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

/**
 * Generate pagination links
 */
export const generatePaginationLinks = (
  pagination: Pagination,
  baseUrl: string
): Record<string, string | null> => {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

  // Format a URL for a specific page
  const formatPageUrl = (page: number): string => {
    const url = new URL(baseUrl);
    url.searchParams.set("page", page.toString());
    return url.toString();
  };

  return {
    first: currentPage > 1 ? formatPageUrl(1) : null,
    prev: hasPrevPage ? formatPageUrl(currentPage - 1) : null,
    current: formatPageUrl(currentPage),
    next: hasNextPage ? formatPageUrl(currentPage + 1) : null,
    last: currentPage < totalPages ? formatPageUrl(totalPages) : null,
  };
};

/**
 * Paginate posts with type-safe filtering options
 */
export const paginatePosts = (
  posts: Post[],
  options: {
    page: number;
    itemsPerPage: number;
    tag?: string;
    search?: string;
  }
): PaginatedResult<Post> => {
  const { page, itemsPerPage, tag, search } = options;

  // Apply filters if needed
  let filteredPosts = posts;

  // Filter by tag
  if (tag) {
    filteredPosts = filteredPosts.filter(post =>
      post.tags?.includes(tag)
    );
  }

  // Filter by search query
  if (search && search.trim() !== "") {
    const searchTerms = search.toLowerCase().trim().split(/\s+/);

    filteredPosts = filteredPosts.filter(post => {
      const titleLower = post.title.toLowerCase();
      const contentLower = post.content.toLowerCase();
      const excerptLower = (post.excerpt || "").toLowerCase();
      const tagsLower = (post.tags || []).join(" ").toLowerCase();

      // Match if ANY search term is found in ANY searchable field
      return searchTerms.some(term =>
        titleLower.includes(term) ||
        contentLower.includes(term) ||
        excerptLower.includes(term) ||
        tagsLower.includes(term)
      );
    });
  }

  // Apply pagination
  return paginate(filteredPosts, page, itemsPerPage);
};