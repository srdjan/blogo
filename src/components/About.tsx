export const About = () => {
  return (
    <div class="about-content" role="presentation">
      <h1>Hi, I'm Srdjan...</h1>
      <p>
        This is my personal, minimal blog built for experimenting with AI agents 
        and ability to fine tune custom writing styles.
      </p>

      <h2>
        About me{" "}
        <a
          href="https://srdjan.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Learn more about Srdjan (opens in a new tab)"
        >
          &rArr;
        </a>
      </h2>
      <p>
        I have extensive experience in leadership roles within various companies in the 
        technology industry. As an SVP of Architecture at First Advantage, currently, I lead 
        Cloud migration efforts and product platform modernization. With previous roles 
        such as Chief Architect at Lifion by ADP and CTO at Cignium Technologies, I have a strong 
        background in software development and agile culture advisory. 
      </p>
      <nav style="text-align: center; margin-top: var(--space-xl);">
        <a
          href="/"
          hx-get="/"
          hx-target="#content-area"
          hx-swap="innerHTML"
          hx-push-url="true"
        >
          &lArr; Back to home
        </a>
      </nav>
    </div>
  );
};
