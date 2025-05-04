/**
 * Debug utilities for troubleshooting rendering issues
 */

// Debug levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Current log level (default to INFO in production, DEBUG in development)
const ENV = Deno.env.get("DENO_ENV") || "development";
let currentLogLevel = ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

// Set the log level
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

// Debug log function
export const debugLog = (
  level: LogLevel,
  message: string,
  data?: unknown,
): void => {
  if (level <= currentLogLevel) {
    const timestamp = new Date().toISOString();
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(`[ERROR] ${timestamp}:`, message);
        if (data) console.error(data);
        break;
      case LogLevel.WARN:
        console.warn(`[WARN] ${timestamp}:`, message);
        if (data) console.warn(data);
        break;
      case LogLevel.INFO:
        console.info(`[INFO] ${timestamp}:`, message);
        if (data) console.info(data);
        break;
      case LogLevel.DEBUG:
        console.log(`[DEBUG] ${timestamp}:`, message);
        if (data) console.log(data);
        break;
    }
  }
};

// Simpler aliases
export const logError = (message: string, data?: unknown): void =>
  debugLog(LogLevel.ERROR, message, data);
export const logWarn = (message: string, data?: unknown): void =>
  debugLog(LogLevel.WARN, message, data);
export const logInfo = (message: string, data?: unknown): void =>
  debugLog(LogLevel.INFO, message, data);
export const logDebug = (message: string, data?: unknown): void =>
  debugLog(LogLevel.DEBUG, message, data);

// Check object type and provide a string description
export const getObjectType = (obj: unknown): string => {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  
  // Check for basic types
  if (typeof obj === "string") return "string";
  if (typeof obj === "number") return "number";
  if (typeof obj === "boolean") return "boolean";
  if (typeof obj === "function") return "function";
  
  // Check for arrays
  if (Array.isArray(obj)) return "array";
  
  // Check for more specific object types
  if (obj instanceof Response) return "Response";
  if (obj instanceof Request) return "Request";
  if (obj instanceof Element) return "DOMElement";
  if (obj instanceof Error) return "Error";
  
  // Default to the constructor name or "object"
  return obj.constructor?.name || "object";
};

// Safely stringify an object, handling circular references
export const safeStringify = (obj: unknown): string => {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (error) {
    return `[Cannot stringify: ${error.message}]`;
  }
};