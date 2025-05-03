export type Environment = "development" | "production" | "test";

export interface Config {
  server: {
    port: number;
    host: string;
    publicUrl: string;
  };

  blog: {
    title: string;
    description: string;
    postsDir: string;
    postsPerPage: number;
  };

  env: Environment;

  debug: {
    enableLogs: boolean;
    verboseLogs: boolean;
    showStackTraces: boolean;
  };
}

export const CONFIG: Config = {
  server: {
    port: 8000,
    host: "localhost",
    publicUrl: "http://localhost:8000",
  },
  blog: {
    title: "Minimal Blog",
    description: "A minimal blog built with Deno, HTMX, and Markdown",
    postsDir: "content/posts",
    postsPerPage: 10,
  },
  env: "development",
  debug: {
    enableLogs: true,
    verboseLogs: false,
    showStackTraces: true,
  },
};
