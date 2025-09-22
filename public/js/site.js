const Core = {
  init() {
    this.setupEventListeners();

    // Initialize home link to have correct behavior on first page load
    const homeLink = document.querySelector('a[href="/"].link');
    if (homeLink && window.location.pathname === "/") {
      // On the home page, we don't need push-url for the home link
      // homeLink.removeAttribute("hx-push-url");
    }

    // Set active nav link on initial page load
    this.updateActiveNavLink();
  },

  setupEventListeners() {
    // Handle HTMX before swaps to filter content
    document.addEventListener("htmx:beforeSwap", (event) => {
      if (event.detail.target.id === "content-area") {
        // Create a temporary div to parse the response
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = event.detail.serverResponse;

        // Check if the response contains a full page (has #content-area)
        const contentAreaInResponse = tempDiv.querySelector("#content-area");
        if (contentAreaInResponse) {
          // Extract only the content from within #content-area
          event.detail.serverResponse = contentAreaInResponse.innerHTML;

        }
      }
    });

    // Handle HTMX after swaps for scrolling and active link updates
    document.addEventListener("htmx:afterSwap", (event) => {
      // Scroll to top after content swap
      if (event.detail.target.id === "content-area") {
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Prevent duplicate rendering for home page
        if (event.detail.pathInfo.path === "/") {
          // Ensure we don't add event handlers multiple times
          const homeLink = document.querySelector('a[href="/"].link');
          if (homeLink) {
            // Remove the push-url attribute to prevent history duplication on home
            homeLink.removeAttribute("hx-push-url");
          }
        }

        // Update active navigation link
        this.updateActiveNavLink();

        // Ensure search modal is properly reset after content swap
        const searchModal = document.getElementById("search-modal");
        if (searchModal && searchModal.open) {
          searchModal.close();
        }

        // Ensure search toggle still works after HTMX swap
        ensureSearchToggleWorks();

      }
    });

    // Handle ESC key to close modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const searchModal = document.getElementById("search-modal");
        if (
          searchModal &&
          (searchModal.style.display === "flex" ||
            searchModal.style.display === "block")
        ) {
          searchModal.style.display = "none";
        }
      }
    });
  },

  updateActiveNavLink() {
    // Get current path
    const currentPath = window.location.pathname;

    // Remove aria-current from all nav links
    document.querySelectorAll("nav a").forEach((link) => {
      link.removeAttribute("aria-current");
    });

    // Add aria-current to current nav link
    let activeLink;

    if (currentPath === "/") {
      // Home page
      activeLink = document.querySelector('nav a[href="/"]');
    } else if (currentPath.startsWith("/tags")) {
      // Tags page
      activeLink = document.querySelector('nav a[href="/tags"]');
    } else if (currentPath === "/about") {
      // About page
      activeLink = document.querySelector('nav a[href="/about"]');
    } else if (currentPath.startsWith("/posts")) {
      // Individual post - highlight Home
      activeLink = document.querySelector('nav a[href="/"]');
    }

    // Add aria-current if we found a matching link
    if (activeLink) {
      activeLink.setAttribute("aria-current", "page");
    }
  },
};

// Search module for search functionality
const Search = {
  init() {
    this.searchForm = document.getElementById("search-form");
    this.searchInput = document.getElementById("search-input");
    this.searchResults = document.getElementById("search-results");
    this.searchModal = document.getElementById("search-modal");
    this.searchToggle = document.querySelector(".search-toggle");

    if (!this.searchForm || !this.searchInput || !this.searchResults) return;

    this.setupEventListeners();
  },

  setupEventListeners() {
    // Handle search form submission
    this.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = this.searchInput.value.trim();
      if (!query) return;

      this.performSearch(query);
    });

    // Debounced search on input
    let searchTimeout;
    this.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      const query = this.searchInput.value.trim();

      if (query.length > 2) {
        searchTimeout = setTimeout(() => {
          this.performSearch(query);
        }, 300);
      } else if (!query) {
        this.searchResults.innerHTML = "";
      }
    });

    // Note: Search toggle and modal close are handled by event delegation in main script
  },

  performSearch(query) {
    this.searchResults.innerHTML = "Searching...";

    fetch("/search-modal?q=" + encodeURIComponent(query))
      .then((res) => res.text())
      .then((html) => {
        this.searchResults.innerHTML = html;

        // Add click handlers to close modal when a result is clicked
        const resultLinks = this.searchResults.querySelectorAll(
          ".search-result-link",
        );
        resultLinks.forEach((link) => {
          link.addEventListener("click", () => {
            const searchModal = document.getElementById("search-modal");
            if (searchModal) {
              searchModal.close();
            }
          });
        });
      })
      .catch((err) => {
        this.searchResults.innerHTML = "Error: Could not perform search.";
      });
  },
};

// Simple function to ensure search functionality works
function ensureSearchToggleWorks() {
  const searchToggle = document.querySelector(".search-toggle");
  const searchCloseBtn = document.querySelector(
    'button[aria-label="Close search"]',
  );
  const searchModal = document.getElementById("search-modal");


  // Search toggle
  if (searchToggle && !searchToggle.hasAttribute("data-listener-attached")) {
    searchToggle.setAttribute("data-listener-attached", "true");

    searchToggle.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = document.getElementById("search-modal");
      const input = document.getElementById("search-input");
      if (modal) {
        modal.showModal();
        setTimeout(() => {
          if (input) {
            input.focus();
          }
        }, 100);
      }
    });
  }

  // Close button
  if (
    searchCloseBtn && !searchCloseBtn.hasAttribute("data-listener-attached")
  ) {
    searchCloseBtn.setAttribute("data-listener-attached", "true");

    searchCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = document.getElementById("search-modal");
      if (modal) {
        modal.close();
      }
    });
  }

  // Click outside modal
  if (searchModal && !searchModal.hasAttribute("data-listener-attached")) {
    searchModal.setAttribute("data-listener-attached", "true");

    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) {
        searchModal.close();
      }
    });
  }
}

// Initialize all modules when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  Core.init();
  Search.init();

  // Initial attachment of search listeners
  ensureSearchToggleWorks();

  // Close modal with Escape key (global listener)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const searchModal = document.getElementById("search-modal");
      if (searchModal && searchModal.open) {
        searchModal.close();
      }
    }
  });
});
