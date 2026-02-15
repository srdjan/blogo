import type { AppResult } from "../lib/types.ts";
import { ok, tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import { copy } from "jsr:@std/fs@1.0.14/copy";
import { ensureDir } from "jsr:@std/fs@1.0.14/ensure-dir";

export interface FileWriter {
  readonly writeFile: (
    path: string,
    content: string,
  ) => Promise<AppResult<void>>;
  readonly ensureDir: (path: string) => Promise<AppResult<void>>;
  readonly copyDir: (src: string, dest: string) => Promise<AppResult<void>>;
  readonly clean: (path: string) => Promise<AppResult<void>>;
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
});
