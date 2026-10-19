import type { FileSystem } from "../../src/ports/file-system.ts";
import type { AppResult } from "../../src/lib/types.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";

export type MemoryFileSystemOptions = {
  readonly failOn?: ReadonlySet<string>;
  readonly failAll?: boolean;
};

export type MemoryFileSystem = FileSystem & {
  readonly calls: { readFile: number; readDir: number };
};

/**
 * In-memory FileSystem. A path "exists" when it is a key or a parent
 * directory of a key. `failAll` and `failOn` make readFile and readDir fail
 * and make exists report false.
 */
export const createMemoryFileSystem = (
  files: Record<string, string>,
  options: MemoryFileSystemOptions = {},
): MemoryFileSystem => {
  const calls = { readFile: 0, readDir: 0 };
  const fails = (path: string): boolean =>
    options.failAll === true || (options.failOn?.has(path) ?? false);
  const dirPrefix = (path: string): string =>
    path.endsWith("/") ? path : `${path}/`;

  return {
    calls,
    readFile: (path: string): Promise<AppResult<string>> => {
      calls.readFile++;
      const content = files[path];
      if (fails(path) || content === undefined) {
        return Promise.resolve(
          err(createError("IOError", `File not found: ${path}`, undefined, {
            path,
          })),
        );
      }
      return Promise.resolve(ok(content));
    },

    readDir: (path: string): Promise<AppResult<readonly string[]>> => {
      calls.readDir++;
      if (fails(path)) {
        return Promise.resolve(
          err(
            createError(
              "IOError",
              `Failed to read directory: ${path}`,
              undefined,
              {
                path,
              },
            ),
          ),
        );
      }
      const prefix = dirPrefix(path);
      const entries = Object.keys(files)
        .filter((filePath) => filePath.startsWith(prefix))
        .map((filePath) => filePath.substring(prefix.length))
        .map((rest) => rest.split("/")[0] ?? rest);
      return Promise.resolve(ok([...new Set(entries)]));
    },

    exists: (path: string): Promise<boolean> => {
      if (fails(path)) return Promise.resolve(false);
      const prefix = dirPrefix(path);
      return Promise.resolve(
        path in files ||
          Object.keys(files).some((key) => key.startsWith(prefix)),
      );
    },

    stat: (path: string) => {
      const content = files[path];
      if (content === undefined) return Promise.resolve(null);
      return Promise.resolve({
        name: path.split("/").pop() ?? path,
        isFile: true,
        isDirectory: false,
        size: content.length,
        mtime: new Date(),
      });
    },
  };
};
