// src/pagination.ts - Type-safe pagination utilities with optimized filtering
import type { Post } from "./types.ts";
import { tryCatchSync } from "./error.ts";

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
 * Filter options for paginating collections
 */
export interface FilterOptions {
  tag?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "date" | "title";
  sortDir?: "asc" | "desc";
}

/**
 * Pagination options
 */
export interface PaginationOptions extends FilterOptions {
  page: number;
  itemsPerPage: number;
}

/**
 * Create a paginated result from a collection of items
 */
export const paginate = <T>(
  items: T[],
  page: number,
  itemsPerPage: number,
): PaginatedResult<T> => {
  // Handle invalid inputs with defensive programming
  const safePage = Math.max(1, page);
  const safeItemsPerPage = Math.max(1, itemsPerPage);

  // Calculate pagination metadata
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / safeItemsPerPage) || 1; // At least 1 page
  const currentPage = Math.min(safePage, totalPages); // Ensure we don't exceed total pages

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
  baseUrl: string,
  extraParams?: Record<string, string>,
): Record<string, string | null> => {
  const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

  // Format a URL for a specific page
  const formatPageUrl = (page: number): string => {
    const url = new URL(baseUrl);
    url.searchParams.set("page", page.toString());

    // Add any extra query parameters
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }

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
 * Apply filters to a collection of posts
 */
export const filterPosts = (
  posts: Post[],
  options: FilterOptions = {},
): Post[] => {
  const { tag, search, dateFrom, dateTo, sortBy = "date", sortDir = "desc" } =
    options;

  // Create a safe wrapper to handle potential errors in filtering
  return tryCatchSync(() => {
    let filteredPosts = [...posts]; // Create a copy to avoid mutating original

    // Filter by tag if specified
    if (tag) {
      filteredPosts = filteredPosts.filter((post) => post.tags?.includes(tag));
    }

    // Filter by date range if specified
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime();
      filteredPosts = filteredPosts.filter((post) =>
        new Date(post.date).getTime() >= fromDate
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo).getTime();
      filteredPosts = filteredPosts.filter((post) =>
        new Date(post.date).getTime() <= toDate
      );
    }

    // Filter by search query if specified
    if (search && search.trim() !== "") {
      const searchTerms = search.toLowerCase().trim().split(/\s+/);

      filteredPosts = filteredPosts.filter((post) => {
        // Pre-compute lowercase versions for performance
        const titleLower = post.title.toLowerCase();
        const contentLower = post.content.toLowerCase();
        const excerptLower = (post.excerpt || "").toLowerCase();
        const tagsLower = (post.tags || []).join(" ").toLowerCase();

        // Match if ANY search term is found in ANY searchable field
        return searchTerms.some((term) =>
          titleLower.includes(term) ||
          contentLower.includes(term) ||
          excerptLower.includes(term) ||
          tagsLower.includes(term)
        );
      });
    }

    // Sort the posts
    filteredPosts.sort((a, b) => {
      let comparison: number;

      if (sortBy === "date") {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      } else {
        comparison = 0;
      }

      return sortDir === "desc" ? -comparison : comparison;
    });

    return filteredPosts;
  }, () => {
    // Fallback to original posts if any error occurs
    console.error("Error filtering posts, returning unfiltered");
    return posts;
  }).value;
};

/**
 * Paginate posts with type-safe filtering options
 */
export const paginatePosts = (
  posts: Post[],
  options: PaginationOptions,
): PaginatedResult<Post> => {
  const { page, itemsPerPage, ...filterOptions } = options;

  // First apply all filters
  const filteredPosts = filterPosts(posts, filterOptions);

  // Then paginate the filtered results
  return paginate(filteredPosts, page, itemsPerPage);
};
