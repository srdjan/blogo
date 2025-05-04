/**
 * Error page component
 */

import { RawHTML } from "../utils/jsx-utils.tsx";

type ErrorPageProps = {
  title: string;
  message: string;
  stackTrace?: string;
};

export const ErrorPage = ({ title, message, stackTrace }: ErrorPageProps) => {
  return (
    <section class="error-page content-section">
      <h1>{title}</h1>
      <div class="error-message">
        <p>{message}</p>
      </div>
      
      {stackTrace && (
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre class="error-stack">{stackTrace}</pre>
        </details>
      )}
      
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
