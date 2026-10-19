import type { Slug } from "../lib/types.ts";
import type { AppResult } from "../lib/types.ts";
import { err, ok } from "../lib/result.ts";
import type { ViewCountStore } from "../ports/kv.ts";

type ViewsData = Record<string, number>;

export type AnalyticsService = {
  readonly getViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly incrementViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly getAllViewCounts: () => Promise<AppResult<ViewsData>>;
  readonly close: () => void;
};

const MAX_INCREMENT_ATTEMPTS = 10;

export const createAnalyticsService = (
  store: ViewCountStore,
): AnalyticsService => {
  const getViewCount = async (slug: Slug): Promise<AppResult<number>> => {
    try {
      const current = await store.get(slug);
      return ok(current.value ?? 0);
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
      // Compare-and-set loop: retry when another writer changed the value
      for (let attempt = 0; attempt < MAX_INCREMENT_ATTEMPTS; attempt++) {
        const current = await store.get(slug);
        const newCount = (current.value ?? 0) + 1;
        const committed = await store.compareAndSet(
          slug,
          current.versionstamp,
          newCount,
        );
        if (committed) return ok(newCount);
      }

      return err({
        kind: "IOError",
        message:
          `Failed to increment view count for ${slug}: too many conflicts`,
      });
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
      for (const entry of await store.list()) {
        viewsData[entry.slug] = entry.value;
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

  return {
    getViewCount,
    incrementViewCount,
    getAllViewCounts,
    close: () => store.close(),
  };
};
