export type Environment = "development" | "production" | "test";

export type Config = {
  readonly server: {
    readonly port: number;
    readonly host: string;
    readonly publicUrl: string;
  };

  readonly blog: {
    readonly title: string;
    readonly description: string;
    readonly postsDir: string;
    readonly postsPerPage: number;
  };

  readonly env: Environment;

  readonly debug: {
    readonly enableLogs: boolean;
    readonly verboseLogs: boolean;
    readonly showStackTraces: boolean;
  };
};

/**
 * Get environment from environment variable with validation
 */
const getEnvironment = (): Environment => {
  const env = Deno.env.get("DENO_ENV") || "development";
  const validEnvs: Environment[] = ["development", "production", "test"];

  if (!validEnvs.includes(env as Environment)) {
    console.warn(`Invalid environment "${env}", defaulting to "development"`);
    return "development";
  }

  return env as Environment;
};

/**
 * Get port from environment variable with fallback
 */
const getPort = (): number => {
  const portStr = Deno.env.get("PORT");
  if (portStr) {
    const port = parseInt(portStr, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 8000;
};

/**
 * Determine debug settings based on environment
 */
const getDebugSettings = (env: Environment) => {
  switch (env) {
    case "production":
      return {
        enableLogs: false,
        verboseLogs: false,
        showStackTraces: false,
      };
    case "test":
      return {
        enableLogs: false,
        verboseLogs: false,
        showStackTraces: true,
      };
    case "development":
    default:
      return {
        enableLogs: true,
        verboseLogs: true,
        showStackTraces: true,
      };
  }
};

const environment = getEnvironment();
const port = getPort();

export const CONFIG: Config = {
  server: {
    port,
    host: "localhost",
    publicUrl: Deno.env.get("PUBLIC_URL") || `http://localhost:${port}`,
  },
  blog: {
    title: Deno.env.get("BLOG_TITLE") || "Minimal Blog",
    description: Deno.env.get("BLOG_DESCRIPTION") ||
      "A minimal blog vibe coded with Claude",
    postsDir: Deno.env.get("POSTS_DIR") || "content/posts",
    postsPerPage: parseInt(Deno.env.get("POSTS_PER_PAGE") || "10", 10),
  },
  env: environment,
  debug: getDebugSettings(environment),
};
