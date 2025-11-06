export interface FileSystem {
  readonly readFile: (path: string) => Promise<string>;
  readonly readDir: (path: string) => Promise<readonly string[]>;
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
  readFile: async (path: string): Promise<string> => {
    return await Deno.readTextFile(path);
  },

  readDir: async (path: string): Promise<readonly string[]> => {
    const entries: string[] = [];
    for await (const entry of Deno.readDir(path)) {
      entries.push(entry.name);
    }
    return entries;
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
