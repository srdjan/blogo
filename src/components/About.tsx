export const About = () => {
  return (
    <div class="about-content" role="presentation">
      <h1>Hi, I'm Srdjan...</h1>
      <p>
        This is my personal, minimal blog built for experimenting with AI agents 
        and ability to fine tune custom writing styles.
      </p>

      <h2>About me</h2>
      <p>
        I have extensive experience in leadership roles within various companies in the 
        technology industry. Currently, as an SVP of Architecture at First Advantage, currently, I lead 
        Cloud migration efforts and product platform modernization. With previous roles 
        such as Technical Principal at ThoughtWorks, Chief Architect at Lifion by ADP and CTO at Cignium Technologies, I have a strong 
        background in software development and agile culture advisory. 
      </p>
      <nav class="social-links" aria-label="Social media links">
        <a
          href="https://github.com/srdjan"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          <span>GitHub</span>
        </a>
        <a
          href="https://www.linkedin.com/in/ssrdjan/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6Z" />
            <rect width="4" height="12" x="2" y="9" />
            <circle cx="4" cy="4" r="2" />
          </svg>
          <span>LinkedIn</span>
        </a>
        <a
          href="https://x.com/djidja8"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4l16 16" />
            <path d="M20 4 4 20" />
          </svg>
          <span>X (Twitter)</span>
        </a>
        <a
          href="https://srdjan.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Learn more about Srdjan (opens in a new tab)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
          </svg>
          <span>Home</span>
        </a>
      </nav>
      <nav style="text-align: center; margin-top: var(--space-xl);">
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
    </div>
  );
};
