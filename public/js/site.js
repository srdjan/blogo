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

    // Initialize Mermaid if available
    this.initMermaid();
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

          if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
          ) {
            console.log("Filtered full page response to content-area only");
          }
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

        // Re-initialize Mermaid for new content
        this.initMermaid();

        // Log successful content swap (for debugging)
        if (
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ) {
          console.log("HTMX content swap successful:", {
            path: event.detail.pathInfo.path,
            target: event.detail.target.id,
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
    document.querySelectorAll(".nav-links a").forEach((link) => {
      link.classList.remove("active");
    });

    // Add active class to current nav link
    let activeLink;

    if (currentPath === "/") {
      // Home page
      activeLink = document.querySelector('.nav-links a[href="/"]');
    } else if (currentPath.startsWith("/tags")) {
      // Tags page
      activeLink = document.querySelector('.nav-links a[href="/tags"]');
    } else if (currentPath === "/about") {
      // About page
      activeLink = document.querySelector('.nav-links a[href="/about"]');
    } else if (currentPath.startsWith("/posts")) {
      // Individual post - highlight Home
      activeLink = document.querySelector('.nav-links a[href="/"]');
    }

    // Add active class if we found a matching link
    if (activeLink) {
      activeLink.classList.add("active");
    }
  },

  initMermaid() {
    // Wait for mermaid to be available
    if (typeof mermaid === "undefined") {
      console.log("Mermaid not yet loaded, retrying...");
      setTimeout(() => this.initMermaid(), 100);
      return;
    }

    try {
      console.log("Mermaid found, initializing...");

      // Configure Mermaid with bright pastel colors
      mermaid.initialize({
        startOnLoad: false, // We'll manually trigger rendering
        theme: "base",
        themeVariables: {
          // Brighter, more pastel primary colors
          primaryColor: "#B8E6B8", // Light sage green
          secondaryColor: "#F5E6A3", // Light amber
          tertiaryColor: "#F0C5C5", // Light coral
          quaternaryColor: "#C5D7F0", // Light blue

          // Text and borders
          primaryTextColor: "#2c3e50", // Darker text for better contrast
          primaryBorderColor: "#95a5a6", // Lighter border
          lineColor: "#7f8c8d", // Medium gray for lines

          // Background colors
          background: "#ffffff",
          secondaryBackground: "#f8f9fa",
          tertiaryBackground: "#e9ecef",

          // Node-specific colors (these override the defaults)
          cScale0: "#B8E6B8", // Light sage
          cScale1: "#F5E6A3", // Light amber
          cScale2: "#F0C5C5", // Light coral
          cScale3: "#C5D7F0", // Light blue
          cScale4: "#E6D7F0", // Light purple
          cScale5: "#D7F0E6", // Light mint

          // Subgraph colors
          clusterBkg: "#f8f9fa",
          clusterBorder: "#bdc3c7",

          // Special elements
          activationBorderColor: "#34495e",
          activationBkgColor: "#ecf0f1",
        },
      });

      // Find all mermaid elements and render them
      const mermaidElements = document.querySelectorAll(".mermaid");
      console.log(`Found ${mermaidElements.length} mermaid elements`);

      if (mermaidElements.length > 0) {
        // Use the run method for newer mermaid versions
        mermaid.run({
          nodes: mermaidElements,
        });
        console.log("Mermaid rendering completed");
      }
    } catch (error) {
      console.error("Mermaid initialization failed:", error);

      // Fallback: try the older init method
      try {
        console.log("Trying fallback mermaid.init()...");
        mermaid.init();
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
      }
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
        if (
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ) {
          console.error("Search error:", err);
        }
      });
  },
};

// Initialize all modules when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  Core.init();
  Search.init();

  // Setup search modal functionality
  const searchToggle = document.querySelector(".search-toggle");
  const searchModal = document.getElementById("search-modal");
  const searchInput = document.getElementById("search-input");

  // Open search modal
  if (searchToggle && searchModal) {
    searchToggle.addEventListener("click", (e) => {
      e.preventDefault();
      searchModal.style.display = "block";
      setTimeout(() => searchInput?.focus(), 100);
    });
  }

  // Close search modal
  const searchCloseBtn = searchModal?.querySelector(
    'button[aria-label="Close search"]',
  );
  if (searchCloseBtn) {
    searchCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      searchModal.style.display = "none";
    });
  }

  // Close modal when clicking outside
  if (searchModal) {
    searchModal.addEventListener("click", (e) => {
      if (e.target === searchModal) {
        searchModal.style.display = "none";
      }
    });
  }

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchModal?.style.display === "block") {
      searchModal.style.display = "none";
    }
  });
});
