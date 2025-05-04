/**
 * Main layout component
 * Demonstrates proper mono-jsx usage with composition
 */

import { Navigation } from "./Navigation.tsx";
import { SearchModal } from "./SearchModal.tsx";
import { htmlToJsx } from "../utils/html-to-jsx.tsx";

type LayoutProps = {
  title: string;
  description: string;
  path: string;
  content: string; // HTML content as string
};

export const Layout = ({ title: _title, description: _description, path, content }: LayoutProps): JSX.Element | string => {
  try {
    // Try to render the Navigation component
    let navigationContent: string | JSX.Element;
    try {
      navigationContent = <Navigation currentPath={path} />;
    } catch (error) {
      console.error("Failed to render Navigation component:", error);
      // Fallback for navigation
      navigationContent = `
        <nav>
          <div class="nav-links">
            <a href="/" class="link${path === '/' ? ' active' : ''}">Home</a>
            <a href="/tags" class="link${path === '/tags' ? ' active' : ''}">Tags</a>
            <a href="/about" class="link${path === '/about' ? ' active' : ''}">About</a>
            <a href="/feed.xml" class="link">RSS</a>
          </div>
        </nav>
      `;
    }

    // Return JSX for the layout
    return (
      <div id="app-layout">
        <header id="site-header">
          {navigationContent}
          <div id="search-modal" class="search-modal"></div>
        </header>

        <main id="content-main" class="content-main">
          <div id="content-area" class="htmx-swappable">
            {html`${content}`}
          </div>
        </main>

        <footer>
          <p>
            Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
              <span class="avatar">⊣˚∆˚⊢</span>
            </a> & Claude
          </p>
        </footer>
      </div>
    );
  } catch (error) {
    console.error("Error in Layout component:", error);
    
    // Fallback to a plain HTML string if JSX rendering fails
    return `
      <div id="app-layout">
        <header id="site-header">
          <nav>
            <div class="nav-links">
              <a href="/" class="link${path === '/' ? ' active' : ''}">Home</a>
              <a href="/tags" class="link${path === '/tags' ? ' active' : ''}">Tags</a>
              <a href="/about" class="link${path === '/about' ? ' active' : ''}">About</a>
              <a href="/feed.xml" class="link">RSS</a>
            </div>
          </nav>
          <div id="search-modal" class="search-modal"></div>
        </header>

        <main id="content-main" class="content-main">
          <div id="content-area" class="htmx-swappable">
            ${content}
          </div>
        </main>

        <footer>
          <p>
            Cooked with ❤️ by <a href="https://srdjan.github.io" target="_blank" rel="noopener noreferrer">
              <span class="avatar">⊣˚∆˚⊢</span>
            </a> & Claude
          </p>
        </footer>
      </div>
    `;
  }
};
