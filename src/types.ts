export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type PostMeta = {
  readonly title: string;
  readonly date: string;
  readonly slug: string;
  readonly excerpt?: string;
  readonly tags?: string[];
  readonly modified?: string;
};

export type Post = PostMeta & {
  readonly content: string; // HTML content as string (for backward compatibility)
  readonly contentJsx?: JSX.Element; // JSX element content for mono-jsx rendering
  readonly formattedDate?: string; // Pre-formatted date string
};

export type TagInfo = {
  readonly name: string;
  readonly count: number;
  readonly posts: Post[];
};

export type RenderContext = {
  readonly title: string;
  readonly posts?: Post[];
  readonly post?: Post;
  readonly tags?: TagInfo[];
  readonly activeTag?: string;
  readonly path: string;
};
