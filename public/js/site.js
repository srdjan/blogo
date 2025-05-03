/**
 * Site-wide JavaScript functionality - modular organization
 */

// Core module for general functionality
const Core = {
  init() {
    this.setupEventListeners();

    // Initialize home link to have correct behavior on first page load
    const homeLink = document.querySelector('a[href="/"].link');
    if (homeLink && window.location.pathname === "/") {
      // On the home page, we don't need push-url for the home link
      homeLink.removeAttribute("hx-push-url");
    }

    // Set active nav link on initial page load
    this.updateActiveNavLink();
  },

  setupEventListeners() {
    // Handle HTMX swaps and scrolling
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

        // Log successful content swap (for debugging)
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          console.log("HTMX content swap successful:", {
            path: event.detail.pathInfo.path,
            target: event.detail.target.id
          });
        }
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
  },

  updateActiveNavLink() {
    // Get current path
    const currentPath = window.location.pathname;

    // Remove active class from all nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.remove('active');
    });

    // Add active class to current nav link
    let activeLink;

    if (currentPath === '/') {
      // Home page
      activeLink = document.querySelector('.nav-links a[href="/"]');
    } else if (currentPath.startsWith('/tags')) {
      // Tags page
      activeLink = document.querySelector('.nav-links a[href="/tags"]');
    } else if (currentPath === '/about') {
      // About page
      activeLink = document.querySelector('.nav-links a[href="/about"]');
    } else if (currentPath.startsWith('/posts')) {
      // Individual post - highlight Home
      activeLink = document.querySelector('.nav-links a[href="/"]');
    }

    // Add active class if we found a matching link
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
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

    // Auto-focus search input when modal opens
    if (this.searchToggle) {
      this.searchToggle.addEventListener("click", () => {
        setTimeout(() => this.searchInput.focus(), 10);
      });
    }

    // Close search modal when clicking outside content
    if (this.searchModal) {
      this.searchModal.addEventListener("click", (e) => {
        if (e.target === this.searchModal) {
          this.searchModal.style.display = "none";
        }
      });
    }
  },

  performSearch(query) {
    this.searchResults.innerHTML = "Searching...";

    fetch("/search?q=" + encodeURIComponent(query))
      .then((res) => res.text())
      .then((html) => {
        this.searchResults.innerHTML = html;
      })
      .catch((err) => {
        this.searchResults.innerHTML = "Error: Could not perform search.";
        // Only log errors in development
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          console.error("Search error:", err);
        }
      });
  }
};

// Initialize all modules when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  Core.init();
  Search.init();
});
