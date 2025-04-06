// src/types.ts - Type definitions for our application
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  excerpt?: string;
  tags?: string[];
  modified?: string;
}

export interface Post extends PostMeta {
  content: string;
}

export interface TagInfo {
  name: string;
  count: number;
  posts: Post[];
}

export interface RenderContext {
  title: string;
  posts?: Post[];
  post?: Post;
  tags?: TagInfo[];
  activeTag?: string;
  path: string;
}