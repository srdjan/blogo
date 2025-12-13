import type { Topic } from "../config/topics.ts";

export type RSSSubscriptionProps = {
  readonly baseUrl: string;
  readonly topics: ReadonlyArray<{
    readonly topic: Topic;
    readonly feedPath: string; // e.g. /rss/topic/web-development
    readonly count: number;
  }>;
};

export const RSSSubscription = (props: RSSSubscriptionProps) => {
  const { baseUrl, topics } = props;
  const mainFeed = `${baseUrl}/rss.xml`;

  const copyJs = (text: string) =>
    `navigator.clipboard.writeText('${text}').then(()=>{this.classList.add('copied');this.disabled=true;setTimeout(()=>{this.classList.remove('copied');this.disabled=false;},1200)})`;

  return (
    <div class="rss-content">
      <h1>RSS Subscriptions</h1>
      <p>
        RSS lets you subscribe to updates using your favorite reader (Feedly,
        Inoreader, NetNewsWire, Reeder, etc.). Copy a feed URL and add it to
        your reader.
      </p>

      <section>
        <h2>Main Blog Feed</h2>
        <div class="feed-row">
          <a
            class="feed-link"
            href={mainFeed}
            rel="alternate"
            type="application/rss+xml"
          >
            {mainFeed}
          </a>
          <button
            type="button"
            class="copy"
            onClick={copyJs(mainFeed)}
            aria-label="Copy feed URL"
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
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
        </div>
      </section>

      <section>
        <h2>Topic Feeds</h2>
        {topics.map(({ topic, feedPath, count }) => {
          const url = `${baseUrl}${feedPath}`;
          return (
            <article class="topic-feed">
              <h3>{topic}</h3>
              <p class="topic-count">
                {count} post{count === 1 ? "" : "s"}
              </p>
              <div class="feed-row">
                <a
                  class="feed-link"
                  href={url}
                  rel="alternate"
                  type="application/rss+xml"
                >
                  {url}
                </a>
                <button
                  type="button"
                  class="copy"
                  onClick={copyJs(url)}
                  aria-label="Copy feed URL"
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
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section>
        <h2>How to use these feeds</h2>
        <ul>
          <li>
            Feedly / Inoreader: Paste the URL in "Add Content" or "Add
            Subscription".
          </li>
          <li>
            NetNewsWire / Reeder: File → New Subscription, then paste the URL.
          </li>
          <li>
            Any reader: Look for an option to add a feed and paste the URL.
          </li>
        </ul>
      </section>
    </div>
  );
};
