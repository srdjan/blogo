import type { Logger } from "../../src/ports/logger.ts";

export type LogEntry = { readonly level: string; readonly message: string };

export const createRecordingLogger = (): Logger & {
  readonly entries: readonly LogEntry[];
} => {
  const entries: LogEntry[] = [];
  const record = (level: string) => (message: string): void => {
    entries.push({ level, message });
  };
  return {
    entries,
    error: record("error"),
    warn: record("warn"),
    info: record("info"),
    debug: record("debug"),
  };
};
