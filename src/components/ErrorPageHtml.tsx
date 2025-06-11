import { createHomeLink } from "../utils/html-helpers.ts";

export const renderErrorPageHtml = (error: {
  title: string;
  message: string;
  stackTrace?: string;
}): string => {
  const stackTraceHtml = error.stackTrace
    ? `<details>
        <summary>Technical Details</summary>
        <pre>${error.stackTrace}</pre>
      </details>`
    : "";

  return `<section>
    <h1>${error.title}</h1>
    <p><strong>${error.message}</strong></p>
    ${stackTraceHtml}
    <p>${createHomeLink()}</p>
  </section>`;
};
