import type { Result } from "./result.ts";

export type Brand<T, K> = T & { readonly __brand: K };

export type Slug = Brand<string, "Slug">;
export type PostId = Brand<string, "PostId">;
export type TagName = Brand<string, "TagName">;
export type UrlPath = Brand<string, "UrlPath">;

export const createSlug = (value: string): Slug => {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") as Slug;
};

export const createPostId = (value: string): PostId => value as PostId;
export const createTagName = (value: string): TagName => value as TagName;
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
  readonly children: JSX.Element; // JSX element
  readonly image?: string;
  readonly author?: string;
  readonly publishedTime?: string;
  readonly modifiedTime?: string;
  readonly tags?: readonly TagName[];
  readonly type?: "website" | "article";
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