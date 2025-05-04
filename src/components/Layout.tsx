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

export const Layout = ({ title: _title, description: _description, path, content }: LayoutProps) => {
  // Return the layout JSX 
  // The conversion to string happens in the Document component
  // This is a regular JSX component
  return (
    <div id="app-layout">
      <header id="site-header">
        <Navigation currentPath={path} />
        <SearchModal />
      </header>

      <main id="content-main" class="content-main">
        <div id="content-area" class="htmx-swappable">
          {/* Use our htmlToJsx utility to safely handle HTML content */}
          {htmlToJsx(content)}
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
};
