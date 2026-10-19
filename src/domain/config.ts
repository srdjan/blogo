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

export type SiteConfig = {
  readonly canonicalUrl: string;
  readonly name: string;
  readonly twitterHandle: string;
};

export type Config = {
  readonly server: ServerConfig;
  readonly blog: BlogConfig;
  readonly site: SiteConfig;
  readonly env: Environment;
  readonly debug: DebugConfig;
};

type EnvRecord = Readonly<Record<string, string | undefined>>;

const validEnvs: readonly Environment[] = [
  "development",
  "production",
  "test",
];

const isEnvironment = (value: string): value is Environment =>
  (validEnvs as readonly string[]).includes(value);

const parseEnvironment = (
  env: EnvRecord,
): {
  readonly environment: Environment;
  readonly warnings: readonly string[];
} => {
  const raw = env["DENO_ENV"] || "development";
  if (isEnvironment(raw)) return { environment: raw, warnings: [] };
  return {
    environment: "development",
    warnings: [`Invalid environment "${raw}", defaulting to "development"`],
  };
};

const parsePort = (env: EnvRecord): number => {
  const portStr = env["PORT"];
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

export const parseConfig = (
  env: EnvRecord,
): { readonly config: Config; readonly warnings: readonly string[] } => {
  const { environment, warnings } = parseEnvironment(env);
  const port = parsePort(env);

  return {
    config: {
      server: {
        port,
        host: "localhost",
        publicUrl: env["PUBLIC_URL"] || `http://localhost:${port}`,
      },
      blog: {
        title: env["BLOG_TITLE"] || "Minimal Blog",
        description: env["BLOG_DESCRIPTION"] ||
          "A minimal blog vibe coded with Claude",
        postsDir: env["POSTS_DIR"] || "content/posts",
        postsPerPage: parseInt(env["POSTS_PER_PAGE"] || "10", 10),
      },
      site: {
        canonicalUrl: env["PUBLIC_URL"] || "https://blogo.timok.deno.net",
        name: "Blogo - Modern Development Blog",
        twitterHandle: env["TWITTER_HANDLE"] || "@blogo_dev",
      },
      env: environment,
      debug: getDebugSettings(environment),
    },
    warnings,
  };
};

export const createConfig = (): Config => {
  const { config, warnings } = parseConfig(Deno.env.toObject());
  for (const warning of warnings) console.warn(warning);
  return config;
};
