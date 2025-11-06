export type Environment = "development" | "production" | "test";

export type BlogConfig = {
  readonly title: string;
  readonly description: string;
  readonly postsDir: string;
  readonly postsPerPage: number;
};

export type ServerConfig = {
  readonly port: number;
  readonly host: string;
  readonly publicUrl: string;
};

export type DebugConfig = {
  readonly enableLogs: boolean;
  readonly verboseLogs: boolean;
  readonly showStackTraces: boolean;
};

export type Config = {
  readonly server: ServerConfig;
  readonly blog: BlogConfig;
  readonly env: Environment;
  readonly debug: DebugConfig;
};

const getEnvironment = (): Environment => {
  const env = Deno.env.get("DENO_ENV") || "development";
  const validEnvs: readonly Environment[] = [
    "development",
    "production",
    "test",
  ];

  if (!validEnvs.includes(env as Environment)) {
    console.warn(`Invalid environment "${env}", defaulting to "development"`);
    return "development";
  }

  return env as Environment;
};

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

const getDebugSettings = (env: Environment): DebugConfig => {
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

export const createConfig = (): Config => {
  const environment = getEnvironment();
  const port = getPort();

  return {
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
};
