import type { Slug } from "../lib/types.ts";
import type { AppResult } from "../lib/types.ts";
import { ok, err } from "../lib/result.ts";

const VIEWS_FILE = "data/views.json";

type ViewsData = Record<string, number>;

export type AnalyticsService = {
  readonly getViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly incrementViewCount: (slug: Slug) => Promise<AppResult<number>>;
  readonly getAllViewCounts: () => Promise<AppResult<ViewsData>>;
};

const readViewsData = async (): Promise<AppResult<ViewsData>> => {
  try {
    const content = await Deno.readTextFile(VIEWS_FILE);
    const data = JSON.parse(content) as ViewsData;
    return ok(data);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // If file doesn't exist, return empty object
      return ok({});
    }
    return err({
      kind: "IOError",
      message: "Failed to read views data",
      cause: error,
    });
  }
};

const writeViewsData = async (data: ViewsData): Promise<AppResult<void>> => {
  try {
    // Ensure data directory exists
    await Deno.mkdir("data", { recursive: true });
    await Deno.writeTextFile(VIEWS_FILE, JSON.stringify(data, null, 2));
    return ok(undefined);
  } catch (error) {
    return err({
      kind: "IOError",
      message: "Failed to write views data",
      cause: error,
    });
  }
};

export const createAnalyticsService = (): AnalyticsService => {
  const getViewCount = async (slug: Slug): Promise<AppResult<number>> => {
    const dataResult = await readViewsData();
    if (!dataResult.ok) {
      return dataResult;
    }
    const count = dataResult.value[slug] || 0;
    return ok(count);
  };

  const incrementViewCount = async (slug: Slug): Promise<AppResult<number>> => {
    const dataResult = await readViewsData();
    if (!dataResult.ok) {
      return dataResult;
    }

    const data = dataResult.value;
    const currentCount = data[slug] || 0;
    const newCount = currentCount + 1;
    data[slug] = newCount;

    const writeResult = await writeViewsData(data);
    if (!writeResult.ok) {
      return writeResult;
    }

    return ok(newCount);
  };

  const getAllViewCounts = async (): Promise<AppResult<ViewsData>> => {
    return await readViewsData();
  };

  return {
    getViewCount,
    incrementViewCount,
    getAllViewCounts,
  };
};
