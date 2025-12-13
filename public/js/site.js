if (window.htmx) {
  window.htmx.config.scrollBehavior = "auto";
  window.htmx.config.scrollIntoViewOnBoost = false;
  window.htmx.config.getCacheBusterParam = true; // Disable GET request caching
  window.htmx.config.refreshOnHistoryMiss = true; // Refresh on back/forward
}

const ScrollRestoration = {
  storageKey(path) {
    return `scroll:${path}`;
  },

  save(path = window.location.pathname + window.location.search) {
    try {
      const position = {
        x: window.scrollX,
        y: window.scrollY,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(this.storageKey(path), JSON.stringify(position));
    } catch (_error) {
      // sessionStorage might be unavailable (private mode, etc.)
    }
  },

  restore(path) {
    try {
      const raw = sessionStorage.getItem(this.storageKey(path));
      if (!raw) return false;

      const { x = 0, y = 0 } = JSON.parse(raw);
      // Use rAF to ensure DOM has rendered before scrolling back
      requestAnimationFrame(() => {
        window.scrollTo(x, y);
      });
      return true;
    } catch (_error) {
      return false;
    }
  },
};

const Core = {
  init() {
    this.setupEventListeners();

    // Set Verdana theme permanently
    document.documentElement.setAttribute("data-theme", "verdana");

    // Set active nav link on initial page load
    this.updateActiveNavLink();
  },

  setupEventListeners() {
    // Persist scroll position before HTMX navigation swaps content
    document.addEventListener("htmx:beforeRequest", () => {
      ScrollRestoration.save();
    });

    // Handle browser back/forward button - always refresh home from server
    document.addEventListener("htmx:historyRestore", (event) => {
      const restoredPath = event?.detail?.path || window.location.pathname;

      // When returning to home, force a fresh load so view counts reflect the
      // latest increments (avoids reusing HTMX history snapshots).
      if (restoredPath === "/") {
        window.location.reload();
        return;
      }

      const restored = ScrollRestoration.restore(restoredPath);
      if (!restored) {
        window.scrollTo(0, 0);
      }
      this.updateActiveNavLink();
    });

    // Fallback for native history navigation (when HTMX doesn't fire)
    window.addEventListener("popstate", () => {
      if (window.location.pathname === "/") {
        window.location.reload();
      }
    });

    // Handle HTMX after swaps for scrolling and active link updates
    document.addEventListener("htmx:afterSwap", (event) => {
      // Scroll to top after content swap
      if (event.detail.target.id === "content-area") {
        const nextPath = event?.detail?.pathInfo?.path ||
          window.location.pathname;
        const restored = ScrollRestoration.restore(nextPath);
        if (!restored) {
          window.scrollTo(0, 0);
        }

        // Prevent duplicate rendering for home page
        if (event.detail.pathInfo?.path === "/") {
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
          searchModal instanceof HTMLDialogElement &&
          searchModal.open
        ) {
          searchModal.close();
          updateSearchToggleState(false);
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
    this.searchToggle = document.getElementById("search-toggle");

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
              updateSearchToggleState(false);
            }
          });
        });
      })
      .catch((err) => {
        this.searchResults.innerHTML = "Error: Could not perform search.";
      });
  },
};

const updateSearchToggleState = (expanded) => {
  const toggle = document.getElementById("search-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
};

// Simple function to ensure search functionality works
function ensureSearchToggleWorks() {
  const searchToggle = document.getElementById("search-toggle");
  const searchModal = document.getElementById("search-modal");
  const searchCloseBtn = document.querySelector(".search-close");

  updateSearchToggleState(false);

  // Search toggle
  if (searchToggle && !searchToggle.hasAttribute("data-listener-attached")) {
    searchToggle.setAttribute("data-listener-attached", "true");

    searchToggle.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent anchor navigation
      const modal = document.getElementById("search-modal");
      const input = document.getElementById("search-input");
      if (modal) {
        modal.showModal();
        updateSearchToggleState(true);
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
        updateSearchToggleState(false);
      }
    });
  }

  // Click outside modal to close
  if (searchModal && !searchModal.hasAttribute("data-listener-attached")) {
    searchModal.setAttribute("data-listener-attached", "true");

    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) {
        searchModal.close();
        updateSearchToggleState(false);
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
        updateSearchToggleState(false);
      }
    }
  });
});
