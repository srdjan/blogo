export const NotFound = () => {
  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <nav class="u-shell u-text-center">
        <a
          href="/"
          hx-get="/"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          &lArr; Back
        </a>
      </nav>
    </section>
  );
};
