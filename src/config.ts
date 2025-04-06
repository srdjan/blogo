// src/config.ts - Typed configuration with functional loading
import { Result } from "./types.ts";
import { createError } from "./error.ts";
import type { AppError } from "./error.ts";

// Application environment
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

  // Environment settings
  env: Environment;

  // Debug settings
  debug: {
    enableLogs: boolean;
    verboseLogs: boolean;
    showStackTraces: boolean;
  };
}

// Default configuration with sensible values
const defaultConfig: Config = {
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

/**
 * Load configuration from environment variables
 */
const loadEnvConfig = async (): Promise<Partial<Config>> => {
  // Get the environment
  const env = (Deno.env.get("DENO_ENV") || "development") as Environment;

  // Load the port
  const port = parseInt(Deno.env.get("PORT") || "0", 10);

  // Load blog title
  const blogTitle = Deno.env.get("BLOG_TITLE");

  // Load blog description
  const blogDescription = Deno.env.get("BLOG_DESCRIPTION");

  // Load public URL
  const publicUrl = Deno.env.get("PUBLIC_URL");

  // Build partial config from environment variables
  const envConfig: Partial<Config> = {
    env,
    debug: {
      enableLogs: Deno.env.get("DEBUG") === "true",
      verboseLogs: Deno.env.get("VERBOSE") === "true",
      showStackTraces: Deno.env.get("SHOW_STACK_TRACES") !== "false",
    },
  };

  // Add optional settings if present
  if (port > 0) {
    envConfig.server = { ...envConfig.server, port };
  }

  if (blogTitle) {
    envConfig.blog = { ...envConfig.blog, title: blogTitle };
  }

  if (blogDescription) {
    envConfig.blog = { ...envConfig.blog, description: blogDescription };
  }

  if (publicUrl) {
    envConfig.server = { ...envConfig.server, publicUrl };
  }

  return envConfig;
};

/**
 * Merge configs with proper type safety
 */
const mergeConfigs = (base: Config, overlay: Partial<Config>): Config => {
  return {
    ...base,
    server: { ...base.server, ...overlay.server },
    blog: { ...base.blog, ...overlay.blog },
    env: overlay.env || base.env,
    debug: { ...base.debug, ...overlay.debug },
  };
};

/**
 * Load and validate the application configuration
 */
export const loadConfig = async (): Promise<Result<Config, AppError>> => {
  try {
    // Load environment configuration
    const envConfig = await loadEnvConfig();

    // Merge with defaults
    const config = mergeConfigs(defaultConfig, envConfig);

    // Validate the configuration
    validateConfig(config);

    return { ok: true, value: config };
  } catch (error) {
    return {
      ok: false,
      error: createError(
        "ValidationError",
        "Configuration validation failed",
        error
      ),
    };
  }
};

/**
 * Validate configuration fields
 * Throws if validation fails
 */
const validateConfig = (config: Config): void => {
  // Validate port
  if (config.server.port <= 0 || config.server.port > 65535) {
    throw new Error(`Invalid port: ${config.server.port}`);
  }

  // Validate public URL
  try {
    new URL(config.server.publicUrl);
  } catch {
    throw new Error(`Invalid public URL: ${config.server.publicUrl}`);
  }

  // Validate posts per page
  if (config.blog.postsPerPage <= 0) {
    throw new Error(`Invalid posts per page: ${config.blog.postsPerPage}`);
  }
};