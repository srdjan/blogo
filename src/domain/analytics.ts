import type { Slug } from "../lib/types.ts";
import type { AppResult } from "../lib/types.ts";
import type { Cache } from "../ports/cache.ts";
import { err, ok } from "../lib/result.ts";

type ViewsData = Record<string, number>;

export type ViewTrackingContext = {
  readonly viewedPosts: readonly string[];
  readonly clientIP: string;
};

export type ViewCountResult = {
  readonly count: number;
  readonly incremented: boolean;
};

export type AnalyticsService = {
  readonly getViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly incrementViewCount: (slug: Slug, context?: ViewTrackingContext) => Promise<AppResult<ViewCountResult>>;
  readonly getAllViewCounts: () => Promise<AppResult<ViewsData>>;
  readonly close: () => void;
};

export type AnalyticsDependencies = {
  readonly viewCountsCache?: Cache<ViewsData>;
};

export const createAnalyticsService = async (
  deps?: AnalyticsDependencies,
): Promise<AnalyticsService> => {
  let kv: Deno.Kv;

  try {
    kv = await Deno.openKv();
  } catch (error) {
    throw new Error(`Failed to open Deno KV: ${error}`);
  }

  const { viewCountsCache } = deps || {};

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

  const shouldIncrementView = async (
    slug: Slug,
    context?: ViewTrackingContext,
  ): Promise<boolean> => {
    // If no context provided, allow increment (backward compatibility)
    if (!context) {
      return true;
    }

    // Check session tracking: if post already viewed in this session, skip
    if (context.viewedPosts.includes(slug)) {
      return false;
    }

    // Rate limiting fallback: check if this IP viewed this post recently (30 min window)
    try {
      const rateLimitKey = ["view_rate_limit", context.clientIP, slug];
      const rateLimitEntry = await kv.get<number>(rateLimitKey);

      if (rateLimitEntry.value) {
        const lastViewTime = rateLimitEntry.value;
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);

        // If viewed within last 30 minutes, skip increment
        if (lastViewTime > thirtyMinutesAgo) {
          return false;
        }
      }

      // Set rate limit entry with 30-minute expiration
      await kv.set(rateLimitKey, Date.now(), { expireIn: 30 * 60 * 1000 });
      return true;
    } catch (error) {
      // If rate limiting fails, allow increment (fail open)
      console.error(`Rate limiting check failed for ${slug}:`, error);
      return true;
    }
  };

  const incrementViewCount = async (slug: Slug, context?: ViewTrackingContext): Promise<AppResult<ViewCountResult>> => {
    try {
      const key = ["views", slug];

      // Check if we should increment based on session and rate limiting
      const shouldIncrement = await shouldIncrementView(slug, context);

      if (!shouldIncrement) {
        // Don't increment, just return current count
        const current = await kv.get<number>(key);
        const currentCount = current.value ?? 0;
        return ok({ count: currentCount, incremented: false });
      }

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

      return ok({ count: newCount, incremented: true });
    } catch (error) {
      return err({
        kind: "IOError",
        message: `Failed to increment view count for ${slug}`,
        cause: error,
      });
    }
  };

  const getAllViewCounts = async (): Promise<AppResult<ViewsData>> => {
    // Check cache first if available
    if (viewCountsCache) {
      const cached = viewCountsCache.get("all_view_counts");
      if (cached.ok && cached.value) {
        return ok(cached.value);
      }
    }

    try {
      const viewsData: ViewsData = {};
      const entries = kv.list<number>({ prefix: ["views"] });

      for await (const entry of entries) {
        // Extract slug from key: ["views", slug]
        const slug = entry.key[1] as string;
        viewsData[slug] = entry.value;
      }

      // Cache the result for 1 minute if cache is available
      if (viewCountsCache) {
        viewCountsCache.set("all_view_counts", viewsData, 60 * 1000); // 1 minute TTL
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

  return {
    getViewCount,
    incrementViewCount,
    getAllViewCounts,
    close,
  };
};
