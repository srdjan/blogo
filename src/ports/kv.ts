import type { AppResult } from "../lib/types.ts";
import { tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";

export type ViewCountEntry = {
  readonly slug: string;
  readonly value: number;
};

export type ViewCountRead = {
  readonly value: number | null;
  readonly versionstamp: string | null;
};

// Port for view counts. A write succeeds only when the stored version still
// matches the version that the caller read (null means "no value yet").
export interface ViewCountStore {
  readonly get: (slug: string) => Promise<ViewCountRead>;
  readonly compareAndSet: (
    slug: string,
    expectedVersionstamp: string | null,
    value: number,
  ) => Promise<boolean>;
  readonly list: () => Promise<readonly ViewCountEntry[]>;
  readonly close: () => void;
}

const VIEWS_PREFIX = "views";

const createDenoKvViewStore = (kv: Deno.Kv): ViewCountStore => ({
  get: async (slug) => {
    const entry = await kv.get<number>([VIEWS_PREFIX, slug]);
    return { value: entry.value, versionstamp: entry.versionstamp };
  },
  compareAndSet: async (slug, expectedVersionstamp, value) => {
    const key = [VIEWS_PREFIX, slug];
    const result = await kv.atomic()
      .check({ key, versionstamp: expectedVersionstamp })
      .set(key, value)
      .commit();
    return result.ok;
  },
  list: async () => {
    const entries: ViewCountEntry[] = [];
    for await (const entry of kv.list<number>({ prefix: [VIEWS_PREFIX] })) {
      // Key shape: ["views", slug]
      entries.push({ slug: entry.key[1] as string, value: entry.value });
    }
    return entries;
  },
  close: () => kv.close(),
});

export const openDenoKvViewStore = (): Promise<AppResult<ViewCountStore>> =>
  tryCatch(
    async () => createDenoKvViewStore(await Deno.openKv()),
    (e) => createError("IOError", `Failed to open Deno KV: ${e}`),
  );
