/**
 * Search modal component
 * Demonstrates proper mono-jsx usage
 */

export const SearchModal = () => {
  return (
    <div
      id="search-modal"
      class="search-modal-overlay"
      style="display:none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-heading"
    >
      <div class="search-modal-content">
        <div class="search-header">
          <h2 id="search-heading">Search</h2>
          <button
            type="button"
            class="search-close"
            aria-label="Close search"
            onClick="document.getElementById('search-modal').style.display='none'"
          >
            ✕ Close
          </button>
        </div>
        <form class="search-form" id="search-form" role="search" action="/search">
          <input
            type="search"
            name="q"
            placeholder="Search posts..."
            required
            id="search-input"
            autoFocus
            aria-labelledby="search-heading"
          />
          <button type="submit" aria-label="Submit search">Search</button>
        </form>
        <div
          id="search-results"
          class="search-results"
          aria-live="polite"
          role="region"
          aria-label="Search results"
        ></div>
      </div>
    </div>
  );
};
