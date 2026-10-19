import type { HealthService } from "../../src/domain/health.ts";
import { err, ok } from "../../src/lib/result.ts";
import { createError } from "../../src/lib/error.ts";

export type HealthDoubleOptions = {
  readonly status?: "healthy" | "degraded" | "unhealthy";
  readonly failWith?: string;
};

export type MetricsCall = {
  readonly responseTime: number;
  readonly isError: boolean;
};

const TIMESTAMP = "2025-01-15T00:00:00.000Z";

const METRICS = {
  memory: { used: 1, total: 2, percentage: 50 },
  cache: {},
  requests: { total: 0, errors: 0, averageResponseTime: 0 },
};

/** In-memory HealthService that records every updateMetrics call. */
export const createMemoryHealthService = (
  options: HealthDoubleOptions = {},
): HealthService & { readonly metricCalls: readonly MetricsCall[] } => {
  const metricCalls: MetricsCall[] = [];
  return {
    metricCalls,
    checkHealth: () =>
      Promise.resolve(
        options.failWith !== undefined
          ? err(createError("IOError", options.failWith))
          : ok({
            status: options.status ?? "healthy",
            timestamp: TIMESTAMP,
            version: "test",
            uptime: 1,
            checks: [],
            metrics: METRICS,
          }),
      ),
    checkFileSystem: () =>
      Promise.resolve({
        name: "filesystem",
        status: "healthy" as const,
        timestamp: TIMESTAMP,
      }),
    checkCache: () =>
      Promise.resolve({
        name: "cache",
        status: "healthy" as const,
        timestamp: TIMESTAMP,
      }),
    getMetrics: () => METRICS,
    updateMetrics: (responseTime, isError) => {
      metricCalls.push({ responseTime, isError });
    },
  };
};
