import { createHomeLink } from "../utils/html-helpers.ts";

export const renderNotFoundHtml = (): string => {
  return `<section class="not-found content-section">
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <p>${createHomeLink()}</p>
  </section>`;
};
