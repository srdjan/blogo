import { CONFIG } from "./config.ts";
/**
 * Escape HTML/XML special characters to prevent XSS
 * @param text The text to escape
 * @param forXml Whether to use XML-compatible apostrophe escaping
 */
const escapeMarkup = (text: string, forXml = false): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, forXml ? "&apos;" : "&#039;");
};

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (text: string): string => escapeMarkup(text, false);

/**
 * Escape XML special characters with XML-compatible apostrophe escaping
 */
export const escapeXml = (text: string): string => escapeMarkup(text, true);

/**
 * Format a date string consistently
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

/**
 * Safely strip HTML tags from a string
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

/**
 * Logger utility to control logging based on environment
 */
export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    if (CONFIG.debug.enableLogs) {
      console.log(message, ...args);
    }
  },

  error: (message: string, ...args: unknown[]): void => {
    // Always log errors, but conditionally include stack traces and details
    if (CONFIG.debug.verboseLogs) {
      console.error(message, ...args);
    } else {
      console.error(message);
    }
  },

  warn: (message: string, ...args: unknown[]): void => {
    if (CONFIG.debug.enableLogs) {
      console.warn(message, ...args);
    }
  },

  debug: (message: string, ...args: unknown[]): void => {
    if (CONFIG.debug.verboseLogs) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
};