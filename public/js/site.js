/**
 * Site-wide JavaScript functionality
 */

// Handle HTMX swaps and scrolling
document.addEventListener("htmx:afterSwap", (event) => {
  if (event.detail.target.tagName === "MAIN") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Handle ESC key to close modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const searchModal = document.getElementById("search-modal");
    if (searchModal && searchModal.style.display === "flex") {
      searchModal.style.display = "none";
    }
  }
});

// Initialize search functionality when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");

  if (!searchForm || !searchInput || !searchResults) return;

  // Handle search form submission
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    performSearch(query, searchResults);
  });

  // Debounced search on input
  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();

    if (query.length > 2) {
      searchTimeout = setTimeout(() => {
        performSearch(query, searchResults);
      }, 300);
    } else if (!query) {
      searchResults.innerHTML = "";
    }
  });

  // Auto-focus search input when modal opens
  const searchToggle = document.querySelector(".search-toggle");
  if (searchToggle) {
    searchToggle.addEventListener("click", () => {
      setTimeout(() => searchInput.focus(), 10);
    });
  }

  // Close search modal when clicking outside content
  const searchModal = document.getElementById("search-modal");
  if (searchModal) {
    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) {
        searchModal.style.display = "none";
      }
    });
  }
});

/**
 * Perform search and update results
 */
function performSearch(query, resultsElement) {
  resultsElement.innerHTML = "Searching...";

  fetch("/search?q=" + encodeURIComponent(query))
    .then((res) => res.text())
    .then((html) => {
      resultsElement.innerHTML = html;
    })
    .catch((err) => {
      resultsElement.innerHTML = "Error: Could not perform search.";
      console.error("Search error:", err);
    });
}
