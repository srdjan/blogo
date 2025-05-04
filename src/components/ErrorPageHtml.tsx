/**
 * ErrorPage component using the html tag function
 */

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
    <p><a href="/" class="button link" hx-get="/" hx-target="#content-area" hx-swap="innerHTML" hx-push-url="true">Return Home</a></p>
  </section>`;
};
