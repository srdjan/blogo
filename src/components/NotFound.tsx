/**
 * Not Found (404) page component
 */

export const NotFound = () => {
  return (
    <section class="not-found content-section">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <p>
        <a 
          href="/" 
          class="button link" 
          hx-get="/" 
          hx-target="#content-area" 
          hx-swap="innerHTML" 
          hx-push-url="true"
        >
          Return Home
        </a>
      </p>
    </section>
  );
};
