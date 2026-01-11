import type { AppResult } from "../lib/types.ts";
import { tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";

export interface FileSystem {
  readonly readFile: (path: string) => Promise<AppResult<string>>;
  readonly readDir: (path: string) => Promise<AppResult<readonly string[]>>;
  readonly exists: (path: string) => Promise<boolean>;
  readonly stat: (path: string) => Promise<FileInfo | null>;
}

export type FileInfo = {
  readonly name: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly size: number;
  readonly mtime: Date;
};

export const createFileSystem = (): FileSystem => ({
  readFile: (path: string): Promise<AppResult<string>> => {
    return tryCatch(
      () => Deno.readTextFile(path),
      (e) =>
        createError("IOError", `Failed to read file: ${path}`, e, { path }),
    );
  },

  readDir: (path: string): Promise<AppResult<readonly string[]>> => {
    return tryCatch(
      async () => {
        const entries: string[] = [];
        for await (const entry of Deno.readDir(path)) {
          entries.push(entry.name);
        }
        return entries;
      },
      (e) =>
        createError("IOError", `Failed to read directory: ${path}`, e, {
          path,
        }),
    );
  },

  exists: async (path: string): Promise<boolean> => {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  },

  stat: async (path: string): Promise<FileInfo | null> => {
    try {
      const stat = await Deno.stat(path);
      return {
        name: path.split("/").pop() ?? path,
        isFile: stat.isFile,
        isDirectory: stat.isDirectory,
        size: stat.size,
        mtime: stat.mtime ?? new Date(),
      };
    } catch {
      return null;
    }
  },
});
