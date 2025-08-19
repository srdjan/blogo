import type { AppResult } from "../lib/types.ts";
import { err, ok } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { FileSystem } from "../ports/file-system.ts";
import type { Cache } from "../ports/cache.ts";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheck = {
  readonly name: string;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly duration?: number;
  readonly timestamp: string;
};

export type SystemHealth = {
  readonly status: HealthStatus;
  readonly timestamp: string;
  readonly version: string;
  readonly uptime: number;
  readonly checks: readonly HealthCheck[];
  readonly metrics: SystemMetrics;
};

export type SystemMetrics = {
  readonly memory: {
    readonly used: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly cache: {
    readonly hitRate?: number;
    readonly size?: number;
  };
  readonly requests: {
    readonly total: number;
    readonly errors: number;
    readonly averageResponseTime: number;
  };
};

export interface HealthService {
  readonly checkHealth: () => Promise<AppResult<SystemHealth>>;
  readonly checkFileSystem: () => Promise<HealthCheck>;
  readonly checkCache: () => Promise<HealthCheck>;
  readonly getMetrics: () => SystemMetrics;
}

export type HealthDependencies = {
  readonly fileSystem: FileSystem;
  readonly cache: Cache<unknown>;
  readonly postsDir: string;
  readonly startTime: number;
};

// Simple metrics store (in production, use proper metrics collection)
let requestMetrics = {
  total: 0,
  errors: 0,
  totalResponseTime: 0,
};

export const updateRequestMetrics = (
  responseTime: number,
  isError: boolean,
) => {
  requestMetrics.total++;
  requestMetrics.totalResponseTime += responseTime;
  if (isError) {
    requestMetrics.errors++;
  }
};

export const createHealthService = (
  deps: HealthDependencies,
): HealthService => {
  const { fileSystem, cache, postsDir, startTime } = deps;

  const checkFileSystem = async (): Promise<HealthCheck> => {
    const start = performance.now();

    try {
      // Check if posts directory exists and is readable
      const exists = await fileSystem.exists(postsDir);
      if (!exists) {
        return {
          name: "filesystem",
          status: "unhealthy",
          message: `Posts directory not found: ${postsDir}`,
          duration: performance.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      // Try to read the directory
      await fileSystem.readDir(postsDir);

      return {
        name: "filesystem",
        status: "healthy",
        message: "File system accessible",
        duration: performance.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: "filesystem",
        status: "unhealthy",
        message: `File system error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: performance.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  };

  const checkCache = async (): Promise<HealthCheck> => {
    const start = performance.now();

    try {
      // Test cache operations
      const testKey = "__health_check__";
      const testValue = "test";

      const setResult = cache.set(testKey, testValue, 1000);
      if (!setResult.ok) {
        return {
          name: "cache",
          status: "unhealthy",
          message: "Cache set operation failed",
          duration: performance.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      const getResult = cache.get(testKey);
      if (!getResult.ok) {
        return {
          name: "cache",
          status: "unhealthy",
          message: "Cache get operation failed",
          duration: performance.now() - start,
          timestamp: new Date().toISOString(),
        };
      }

      // Clean up test key
      cache.delete(testKey);

      return {
        name: "cache",
        status: "healthy",
        message: "Cache operations working",
        duration: performance.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: "cache",
        status: "unhealthy",
        message: `Cache error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        duration: performance.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  };

  const getMemoryMetrics = () => {
    const memoryUsage =
      (performance as unknown as {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
      }).memory;

    if (memoryUsage) {
      return {
        used: memoryUsage.usedJSHeapSize,
        total: memoryUsage.totalJSHeapSize,
        percentage: (memoryUsage.usedJSHeapSize / memoryUsage.totalJSHeapSize) *
          100,
      };
    }

    // Fallback for environments without memory API
    return {
      used: 0,
      total: 0,
      percentage: 0,
    };
  };

  const getMetrics = (): SystemMetrics => {
    return {
      memory: getMemoryMetrics(),
      cache: {
        // Would need cache hit/miss tracking and size tracking
      },
      requests: {
        total: requestMetrics.total,
        errors: requestMetrics.errors,
        averageResponseTime: requestMetrics.total > 0
          ? requestMetrics.totalResponseTime / requestMetrics.total
          : 0,
      },
    };
  };

  const checkHealth = async (): Promise<AppResult<SystemHealth>> => {
    try {
      const checks = await Promise.all([
        checkFileSystem(),
        checkCache(),
      ]);

      // Determine overall status
      const hasUnhealthy = checks.some((check) => check.status === "unhealthy");
      const hasDegraded = checks.some((check) => check.status === "degraded");

      const overallStatus: HealthStatus = hasUnhealthy
        ? "unhealthy"
        : hasDegraded
        ? "degraded"
        : "healthy";

      const health: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: "1.0.0", // Could be read from package.json or environment
        uptime: Date.now() - startTime,
        checks,
        metrics: getMetrics(),
      };

      return ok(health);
    } catch (error) {
      return err(createError(
        "IOError",
        "Failed to check system health",
        error,
        { retryable: true },
      ));
    }
  };

  return {
    checkHealth,
    checkFileSystem,
    checkCache,
    getMetrics,
  };
};
