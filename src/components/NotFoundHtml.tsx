import { createHomeLink } from "../utils/html-helpers.ts";

export const renderNotFoundHtml = (): string => {
  return `<section>
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <p>${createHomeLink()}</p>
  </section>`;
};
