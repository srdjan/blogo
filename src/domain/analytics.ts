import type { Slug } from "../lib/types.ts";
import type { AppResult } from "../lib/types.ts";
import { err, ok, tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";

type ViewsData = Record<string, number>;

export type AnalyticsService = {
  readonly getViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly incrementViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly getAllViewCounts: () => Promise<AppResult<ViewsData>>;
  readonly close: () => void;
};

export const createAnalyticsService = async (): Promise<
  AppResult<AnalyticsService>
> => {
  const kvResult = await tryCatch(
    () => Deno.openKv(),
    (e) => createError("IOError", `Failed to open Deno KV: ${e}`),
  );

  if (!kvResult.ok) {
    return kvResult;
  }

  const kv = kvResult.value;

  const getViewCount = async (slug: Slug): Promise<AppResult<number>> => {
    try {
      const key = ["views", slug];
      const result = await kv.get<number>(key);
      return ok(result.value ?? 0);
    } catch (error) {
      return err({
        kind: "IOError",
        message: `Failed to get view count for ${slug}`,
        cause: error,
      });
    }
  };

  const incrementViewCount = async (slug: Slug): Promise<AppResult<number>> => {
    try {
      const key = ["views", slug];

      // Use atomic operation to safely increment
      let newCount = 0;
      let success = false;

      while (!success) {
        const current = await kv.get<number>(key);
        const currentCount = current.value ?? 0;
        newCount = currentCount + 1;

        const atomic = kv.atomic();
        atomic.check(current);
        atomic.set(key, newCount);

        const result = await atomic.commit();
        success = result.ok;
      }

      return ok(newCount);
    } catch (error) {
      return err({
        kind: "IOError",
        message: `Failed to increment view count for ${slug}`,
        cause: error,
      });
    }
  };

  const getAllViewCounts = async (): Promise<AppResult<ViewsData>> => {
    try {
      const viewsData: ViewsData = {};
      const entries = kv.list<number>({ prefix: ["views"] });

      for await (const entry of entries) {
        // Extract slug from key: ["views", slug]
        const slug = entry.key[1] as string;
        viewsData[slug] = entry.value;
      }

      return ok(viewsData);
    } catch (error) {
      return err({
        kind: "IOError",
        message: "Failed to get all view counts",
        cause: error,
      });
    }
  };

  const close = () => {
    kv.close();
  };

  return ok({
    getViewCount,
    incrementViewCount,
    getAllViewCounts,
    close,
  });
};
