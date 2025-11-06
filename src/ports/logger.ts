export type LogLevel = "error" | "warn" | "info" | "debug";

export interface Logger {
  readonly error: (message: string, data?: unknown) => void;
  readonly warn: (message: string, data?: unknown) => void;
  readonly info: (message: string, data?: unknown) => void;
  readonly debug: (message: string, data?: unknown) => void;
}

export type LoggerConfig = {
  readonly enableLogs: boolean;
  readonly verboseLogs: boolean;
  readonly minLevel: LogLevel;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export const createLogger = (config: LoggerConfig): Logger => {
  const shouldLog = (level: LogLevel): boolean => {
    return config.enableLogs &&
      LOG_LEVELS[level] <= LOG_LEVELS[config.minLevel];
  };

  const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = config.verboseLogs ? new Date().toISOString() : "";
    const prefix = config.verboseLogs
      ? `[${level.toUpperCase()}] ${timestamp}: `
      : "";
    return `${prefix}${message}`;
  };

  const log = (level: LogLevel, message: string, data?: unknown): void => {
    if (!shouldLog(level)) return;

    const formattedMessage = formatMessage(level, message);
    const logFn = level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : level === "info"
      ? console.info
      : console.log;

    if (config.verboseLogs && data !== undefined) {
      logFn(formattedMessage, data);
    } else {
      logFn(formattedMessage);
    }
  };

  return {
    error: (message: string, data?: unknown) => log("error", message, data),
    warn: (message: string, data?: unknown) => log("warn", message, data),
    info: (message: string, data?: unknown) => log("info", message, data),
    debug: (message: string, data?: unknown) => log("debug", message, data),
  };
};

export const noopLogger: Logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};
