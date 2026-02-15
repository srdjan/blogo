export type AtProtoConfig = {
  readonly did: string;
  readonly handle: string;
  readonly service: string;
  readonly appPassword: string;
};

export const createAtProtoConfig = (): AtProtoConfig | null => {
  const did = Deno.env.get("ATPROTO_DID");
  if (!did) return null;

  const handle = Deno.env.get("ATPROTO_HANDLE");
  if (!handle) return null;

  const appPassword = Deno.env.get("ATPROTO_APP_PASSWORD");
  if (!appPassword) return null;

  return {
    did,
    handle,
    service: Deno.env.get("ATPROTO_SERVICE") || "https://bsky.social",
    appPassword,
  };
};
