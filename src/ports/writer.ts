import type { AppResult } from "../lib/types.ts";
import { tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import { copy } from "@std/fs/copy";
import { ensureDir } from "@std/fs/ensure-dir";
import { walk } from "@std/fs/walk";

export interface FileWriter {
  readonly writeFile: (
    path: string,
    content: string,
  ) => Promise<AppResult<void>>;
  readonly ensureDir: (path: string) => Promise<AppResult<void>>;
  readonly copyDir: (src: string, dest: string) => Promise<AppResult<void>>;
  readonly clean: (path: string) => Promise<AppResult<void>>;
  readonly listFiles: (dir: string) => Promise<AppResult<readonly string[]>>;
  readonly readBytes: (path: string) => Promise<AppResult<Uint8Array>>;
  readonly readText: (path: string) => Promise<AppResult<string>>;
  readonly rename: (from: string, to: string) => Promise<AppResult<void>>;
}

export const createFileWriter = (): FileWriter => ({
  writeFile: (path: string, content: string): Promise<AppResult<void>> =>
    tryCatch(
      async () => {
        // Ensure parent directory exists
        const dir = path.substring(0, path.lastIndexOf("/"));
        if (dir) await ensureDir(dir);
        await Deno.writeTextFile(path, content);
      },
      (e) =>
        createError("IOError", `Failed to write file: ${path}`, e, { path }),
    ),

  ensureDir: (path: string): Promise<AppResult<void>> =>
    tryCatch(
      () => ensureDir(path),
      (e) =>
        createError("IOError", `Failed to ensure directory: ${path}`, e, {
          path,
        }),
    ),

  copyDir: (src: string, dest: string): Promise<AppResult<void>> =>
    tryCatch(
      () => copy(src, dest, { overwrite: true }),
      (e) =>
        createError("IOError", `Failed to copy ${src} to ${dest}`, e, {
          path: src,
        }),
    ),

  clean: (path: string): Promise<AppResult<void>> =>
    tryCatch(
      async () => {
        try {
          await Deno.remove(path, { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e;
        }
      },
      (e) =>
        createError("IOError", `Failed to clean directory: ${path}`, e, {
          path,
        }),
    ),

  listFiles: (dir: string): Promise<AppResult<readonly string[]>> =>
    tryCatch(
      async () => {
        // Collect the full list first so callers can rename during use
        const files: string[] = [];
        for await (const entry of walk(dir, { includeDirs: false })) {
          files.push(entry.path);
        }
        return files;
      },
      (e) =>
        createError("IOError", `Failed to list files: ${dir}`, e, {
          path: dir,
        }),
    ),

  readBytes: (path: string): Promise<AppResult<Uint8Array>> =>
    tryCatch(
      () => Deno.readFile(path),
      (e) =>
        createError("IOError", `Failed to read file: ${path}`, e, { path }),
    ),

  readText: (path: string): Promise<AppResult<string>> =>
    tryCatch(
      () => Deno.readTextFile(path),
      (e) =>
        createError("IOError", `Failed to read file: ${path}`, e, { path }),
    ),

  rename: (from: string, to: string): Promise<AppResult<void>> =>
    tryCatch(
      () => Deno.rename(from, to),
      (e) =>
        createError("IOError", `Failed to rename ${from} to ${to}`, e, {
          path: from,
        }),
    ),
});
