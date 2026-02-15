import type { AppResult } from "../lib/types.ts";
import { err, ok, tryCatch } from "../lib/result.ts";
import { createError } from "../lib/error.ts";
import type { AtProtoConfig } from "../config/atproto.ts";
import type {
  GetRecordResponse,
  ListRecordsResponse,
  PutRecordResponse,
} from "../atproto/types.ts";

export interface AtProtoClient {
  readonly putRecord: (params: {
    readonly collection: string;
    readonly rkey: string;
    readonly record: Record<string, unknown>;
  }) => Promise<AppResult<PutRecordResponse>>;

  readonly getRecord: <T>(params: {
    readonly collection: string;
    readonly rkey: string;
  }) => Promise<AppResult<GetRecordResponse<T>>>;

  readonly listRecords: <T>(params: {
    readonly collection: string;
    readonly limit?: number;
    readonly cursor?: string;
  }) => Promise<AppResult<ListRecordsResponse<T>>>;

  readonly deleteRecord: (params: {
    readonly collection: string;
    readonly rkey: string;
  }) => Promise<AppResult<void>>;

  readonly getDid: () => string;
}

type Session = {
  readonly accessJwt: string;
  readonly did: string;
};

export const createAtProtoClient = async (
  config: AtProtoConfig,
): Promise<AppResult<AtProtoClient>> => {
  // Authenticate via createSession
  const sessionResult = await tryCatch(
    async () => {
      const res = await fetch(
        `${config.service}/xrpc/com.atproto.server.createSession`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: config.handle,
            password: config.appPassword,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Authentication failed (${res.status}): ${body}`,
        );
      }

      return (await res.json()) as Session;
    },
    (e) =>
      createError("NetworkError", "Failed to authenticate with PDS", e, {
        retryable: true,
      }),
  );

  if (!sessionResult.ok) return sessionResult;

  const session = sessionResult.value;

  const xrpc = async <T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
  ): Promise<AppResult<T>> => {
    return tryCatch(
      async () => {
        const url = new URL(`${config.service}/xrpc/${endpoint}`);
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
          }
        }

        const res = await fetch(url.toString(), {
          method,
          headers: {
            "Authorization": `Bearer ${session.accessJwt}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `XRPC ${endpoint} failed (${res.status}): ${text}`,
          );
        }

        if (res.headers.get("content-length") === "0") {
          return undefined as unknown as T;
        }

        return (await res.json()) as T;
      },
      (e) =>
        createError("NetworkError", `XRPC call failed: ${endpoint}`, e, {
          retryable: true,
        }),
    );
  };

  const client: AtProtoClient = {
    putRecord: (params) =>
      xrpc<PutRecordResponse>("POST", "com.atproto.repo.putRecord", {
        repo: session.did,
        collection: params.collection,
        rkey: params.rkey,
        record: params.record,
      }),

    getRecord: <T>(params: {
      readonly collection: string;
      readonly rkey: string;
    }) =>
      xrpc<GetRecordResponse<T>>(
        "GET",
        "com.atproto.repo.getRecord",
        undefined,
        {
          repo: session.did,
          collection: params.collection,
          rkey: params.rkey,
        },
      ),

    listRecords: <T>(params: {
      readonly collection: string;
      readonly limit?: number;
      readonly cursor?: string;
    }) => {
      const queryParams: Record<string, string> = {
        repo: session.did,
        collection: params.collection,
      };
      if (params.limit !== undefined) {
        queryParams["limit"] = String(params.limit);
      }
      if (params.cursor) queryParams["cursor"] = params.cursor;

      return xrpc<ListRecordsResponse<T>>(
        "GET",
        "com.atproto.repo.listRecords",
        undefined,
        queryParams,
      );
    },

    deleteRecord: (params) =>
      xrpc<void>("POST", "com.atproto.repo.deleteRecord", {
        repo: session.did,
        collection: params.collection,
        rkey: params.rkey,
      }),

    getDid: () => session.did,
  };

  return ok(client);
};
