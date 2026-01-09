import { err, ok, type Result } from "./result.ts";

export type Brand<T, K> = T & { readonly __brand: K };

export type Slug = Brand<string, "Slug">;
export type PostId = Brand<string, "PostId">;
export type TagName = Brand<string, "TagName">;
export type UrlPath = Brand<string, "UrlPath">;

export const createSlug = (value: string): Slug => {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(
    /-+/g,
    "-",
  ) as Slug;
};

export const createPostId = (value: string): AppResult<PostId> => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err({
      kind: "ValidationError",
      message: "Post ID cannot be empty",
    });
  }
  return ok(trimmed as PostId);
};

export const createTagName = (value: string): AppResult<TagName> => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err({
      kind: "ValidationError",
      message: "Tag name cannot be empty",
    });
  }
  if (trimmed.length > 50) {
    return err({
      kind: "ValidationError",
      message: "Tag name too long (max 50 characters)",
    });
  }
  return ok(trimmed as TagName);
};

export const createUrlPath = (value: string): UrlPath => value as UrlPath;

export type PostMeta = {
  readonly title: string;
  readonly date: string;
  readonly slug: Slug;
  readonly excerpt?: string;
  readonly tags?: readonly TagName[];
  readonly modified?: string;
};

export type Post = PostMeta & {
  readonly content: string;
  readonly formattedDate?: string;
  readonly viewCount?: number | undefined;
};

export type TagInfo = {
  readonly name: TagName;
  readonly count: number;
  readonly posts: readonly Post[];
};

export type RenderContext = {
  readonly title: string;
  readonly posts?: readonly Post[];
  readonly post?: Post;
  readonly tags?: readonly TagInfo[];
  readonly activeTag?: TagName;
  readonly path: UrlPath;
};

export type LayoutProps = {
  readonly title: string;
  readonly description?: string;
  readonly path?: UrlPath;
  readonly children: unknown; // JSX element - using unknown to avoid type conflicts
  readonly image?: string;
  readonly author?: string;
  readonly publishedTime?: string;
  readonly modifiedTime?: string;
  readonly tags?: readonly TagName[];
  readonly type?: "website" | "article";
  readonly origin?: string; // Site origin URL
  readonly canonicalPath?: string;
  readonly robots?: string;
  readonly structuredData?: readonly unknown[] | Record<string, unknown>;
};

export type AppErrorKind =
  | "NotFound"
  | "ParseError"
  | "IOError"
  | "ValidationError"
  | "CacheError"
  | "NetworkError"
  | "RenderError";

export type AppError = {
  readonly kind: AppErrorKind;
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp?: number;
  readonly path?: string;
  readonly retryable?: boolean;
};

export type AppResult<T> = Result<T, AppError>;
