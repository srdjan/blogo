if (window.htmx) {
  window.htmx.config.scrollBehavior = "auto";
  window.htmx.config.scrollIntoViewOnBoost = false;
  window.htmx.config.getCacheBusterParam = true; // Disable GET request caching
  window.htmx.config.refreshOnHistoryMiss = true; // Refresh on back/forward
}

const Core = {
  init() {
    this.setupEventListeners();
    this.initTheme();
    this.initPalette();

    // Initialize home link to have correct behavior on first page load
    const homeLink = document.querySelector('a[href="/"].link');
    if (homeLink && window.location.pathname === "/") {
      // On the home page, we don't need push-url for the home link
      // homeLink.removeAttribute("hx-push-url");
    }

    // Set active nav link on initial page load
    this.updateActiveNavLink();
  },

  initTheme() {
    // Get saved theme or default to system preference
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark =
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (systemPrefersDark ? "dark" : "light");

    // Apply theme
    document.documentElement.setAttribute("data-theme", theme);
    this.updateThemeIcon(theme);

    // Listen for theme toggle button clicks
    const themeToggle = document.querySelector(".theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => this.toggleTheme());
    }
  },

  initPalette() {
    // Get saved palette or default to 'automerge'
    const savedPalette = localStorage.getItem("palette");
    const palette = savedPalette || "automerge";

    // Apply palette
    document.documentElement.setAttribute("data-palette", palette);

    // Listen for palette toggle button clicks
    const paletteToggle = document.querySelector(".palette-toggle");
    if (paletteToggle) {
      paletteToggle.addEventListener("click", () => this.togglePalette());
    }
  },

  togglePalette() {
    const current = document.documentElement.getAttribute("data-palette") ||
      "automerge";
    const next = current === "automerge" ? "default" : "automerge";
    document.documentElement.setAttribute("data-palette", next);
    localStorage.setItem("palette", next);
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") ||
      "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    this.updateThemeIcon(newTheme);
  },

  updateThemeIcon(theme) {
    const sunIcon = document.querySelector(".sun-icon");
    const moonIcon = document.querySelector(".moon-icon");

    if (theme === "dark") {
      sunIcon?.style.setProperty("display", "block");
      moonIcon?.style.setProperty("display", "none");
    } else {
      sunIcon?.style.setProperty("display", "none");
      moonIcon?.style.setProperty("display", "block");
    }
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
        window.scrollTo(0, 0);

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
  const toggle = document.querySelector(".search-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
};

// Simple function to ensure search functionality works
function ensureSearchToggleWorks() {
  const searchToggle = document.querySelector(".search-toggle");
  const searchCloseBtn = document.querySelector(
    'button[aria-label="Close search"]',
  );
  const searchModal = document.getElementById("search-modal");

  updateSearchToggleState(false);

  // Search toggle
  if (searchToggle && !searchToggle.hasAttribute("data-listener-attached")) {
    searchToggle.setAttribute("data-listener-attached", "true");

    searchToggle.addEventListener("click", (e) => {
      e.preventDefault();
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

  // Click outside modal
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
