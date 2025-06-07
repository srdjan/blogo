import { createHomeLink } from "../utils/html-helpers.ts";

export const renderErrorPageHtml = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  const stackTraceHtml = error.stackTrace
    ? `<details class="error-details">
        <summary>Technical Details</summary>
        <pre class="error-stack">${error.stackTrace}</pre>
      </details>`
    : "";
  
  return `<section class="error-page content-section">
    <h1>${error.title}</h1>
    <div class="error-message">
      <p>${error.message}</p>
    </div>
    ${stackTraceHtml}
    <p>${createHomeLink()}</p>
  </section>`;
};
