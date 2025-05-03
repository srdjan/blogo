/**
 * Simplified configuration with hardcoded values
 */

export type Environment = "development" | "production" | "test";

// Core configuration interface with strong typing
export interface Config {
  // Server settings
  server: {
    port: number;
    host: string;
    publicUrl: string;
  };

  // Blog settings
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

/**
 * Hardcoded default configuration
 */
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
