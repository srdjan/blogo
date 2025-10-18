// Topic-tag mapping and utilities for hierarchical tags
// Light FP style: data as types, pure functions, no side effects
import type { TagInfo } from "../lib/types.ts";

export type Topic = string & { readonly __brand: "Topic" };

// High-level topics (5–8) covering all existing tags
export const TOPICS: Readonly<Record<Topic, readonly string[]>> = {
  ["Languages & Runtimes" as Topic]: [
    "TypeScript",
    "Typescript", // legacy capitalization in some posts
    "Deno",
    "Gleam",
  ],
  ["Web Development" as Topic]: [
    "WebDev",
    "HTMX",
    "Frontend",
    "SSR",
    "Signals",
    "HATEOAS",
    "HAL",
    "design", // ad-hoc from pattern-test
    "test", // ad-hoc from pattern-test
  ],
  ["Architecture & Design" as Topic]: [
    "Architecture",
    "Patterns",
    "Legacy",
  ],
  ["Functional & Concurrency" as Topic]: [
    "Functional",
    "Concurrency",
    "Effection",
    "Parsing",
  ],
  ["Product & Teams" as Topic]: [
    "Product",
    "Agile",
    "Teams",
    "Hiring",
    "Organization",
    "Leadership",
    "Culture",
    "Incentives",
    "Compensation",
    "Equity",
    "Finance",
    "Workplace",
  ],
  ["Enterprise & Legacy" as Topic]: [
    "Enterprise",
  ],
  ["Identity & Privacy" as Topic]: [
    "VCs",
    "DIDs",
    "ZKPs",
  ],
  ["Music & Culture" as Topic]: [
    "music",
    "yugoslavia",
    "punk",
    "new-wave",
  ],
} as const;

// Case-insensitive helpers
const normalize = (s: string): string => s.trim().toLowerCase();

const tagToTopicsIndexCI: Readonly<Record<string, readonly Topic[]>> = (() => {
  const idx = new Map<string, Topic[]>();
  for (const [topic, tags] of Object.entries(TOPICS)) {
    for (const tag of tags) {
      const key = normalize(tag);
      const arr = idx.get(key) ?? [];
      arr.push(topic as Topic);
      idx.set(key, arr);
    }
  }
  return Object.fromEntries([...idx.entries()]);
})();

export const deriveTopicsFromTags = (
  tags: readonly string[] | undefined,
): readonly Topic[] => {
  if (!tags || tags.length === 0) return [] as const;
  const set = new Map<Topic, true>();
  for (const t of tags) {
    const ts = tagToTopicsIndexCI[normalize(t)] ?? [];
    for (const topic of ts) set.set(topic, true);
  }
  return [...set.keys()];
};

export const ALL_TOPICS = Object.keys(TOPICS) as readonly Topic[];

export const topicToSlug = (
  topic: Topic,
): string => (String(topic).toLowerCase()
  .replace(/&/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, ""));

export const slugToTopic = (slug: string): Topic | null => {
  const found = (Object.keys(TOPICS) as Topic[]).find((t) =>
    topicToSlug(t) === slug
  );
  return found ?? null;
};

export type TagsByTopic = ReadonlyArray<{
  readonly topic: Topic;
  readonly tags: readonly TagInfo[];
}>;

export const groupTagsByTopic = (
  tags: readonly TagInfo[],
): TagsByTopic => {
  const buckets = new Map<Topic, TagInfo[]>();
  for (const tag of tags) {
    const topics = tagToTopicsIndexCI[normalize(tag.name as string)] ?? [];
    // Deduplicate topics to avoid double-inserting the same tag when TOPICS lists synonyms
    const uniqueTargets = [...new Set(topics)];
    // Put into each matching topic; if none match, bucket under "Web Development" as a sensible default
    const targets = uniqueTargets.length > 0
      ? uniqueTargets
      : ["Web Development" as Topic];
    for (const topic of targets) {
      const arr = buckets.get(topic) ?? [];
      arr.push(tag);
      buckets.set(topic, arr);
    }
  }

  // Stable order of topics as declared above
  const orderedTopics = Object.keys(TOPICS) as Topic[];
  return orderedTopics
    .filter((t) => buckets.has(t))
    .map((t) => ({
      topic: t,
      tags: [...(buckets.get(t) ?? [])].sort((a, b) => b.count - a.count),
    }));
};
