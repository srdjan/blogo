import { CONFIG } from "../config.ts";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface Logger {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
}

/**
 * Unified logger that respects configuration settings
 */
export const logger: Logger = {
  error: (message: string, data?: unknown): void => {
    if (CONFIG.debug.verboseLogs && data) {
      console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, data);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  warn: (message: string, data?: unknown): void => {
    if (CONFIG.debug.enableLogs) {
      if (CONFIG.debug.verboseLogs && data) {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data);
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  },

  info: (message: string, data?: unknown): void => {
    if (CONFIG.debug.enableLogs) {
      if (CONFIG.debug.verboseLogs && data) {
        console.info(`[INFO] ${new Date().toISOString()}: ${message}`, data);
      } else {
        console.log(message);
      }
    }
  },

  debug: (message: string, data?: unknown): void => {
    if (CONFIG.debug.verboseLogs) {
      if (data) {
        console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  },
};

/**
 * Safely stringify an object, handling circular references
 */
export const safeStringify = (obj: unknown): string => {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (error) {
    return `[Cannot stringify: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
};

/**
 * Get object type description for debugging
 */
export const getObjectType = (obj: unknown): string => {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";

  if (typeof obj === "string") return "string";
  if (typeof obj === "number") return "number";
  if (typeof obj === "boolean") return "boolean";
  if (typeof obj === "function") return "function";

  if (Array.isArray(obj)) return "array";

  if (obj instanceof Response) return "Response";
  if (obj instanceof Request) return "Request";
  if (obj instanceof Element) return "DOMElement";
  if (obj instanceof Error) return "Error";

  return obj.constructor?.name || "object";
};
