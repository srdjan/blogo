#!/usr/bin/env -S deno run --allow-read

import { expandGlob } from "jsr:@std/fs/expand-glob";
import { parse } from "@std/yaml";
import { validateFrontmatter } from "../src/domain/validation.ts";

type ValidationFailure = {
  readonly path: string;
  readonly message: string;
};

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

async function collectMarkdownFiles() {
  const files: string[] = [];
  for await (const entry of expandGlob("content/posts/**/*.md")) {
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  return files.sort();
}

async function validateFile(path: string): Promise<ValidationFailure | null> {
  const source = await Deno.readTextFile(path);
  const match = source.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      path,
      message: "Missing or malformed frontmatter block at file start.",
    };
  }

  const frontmatterBlock = match[1];

  let parsed: unknown;
  try {
    parsed = parse(frontmatterBlock);
  } catch (error) {
    return {
      path,
      message: `YAML parse error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const result = validateFrontmatter(parsed);
  if (!result.ok) {
    const { message, cause } = result.error;
    const suffix = cause instanceof Error
      ? ` (${cause.name}: ${cause.message})`
      : cause !== undefined
      ? ` (${String(cause)})`
      : "";

    return {
      path,
      message: `${message}${suffix}`,
    };
  }

  return null;
}

const files = await collectMarkdownFiles();
const failures: ValidationFailure[] = [];

for (const path of files) {
  const failure = await validateFile(path);
  if (failure) {
    failures.push(failure);
  }
}

if (failures.length > 0) {
  console.error("\nFrontmatter validation failed:");
  for (const failure of failures) {
    console.error(` - ${failure.path}: ${failure.message}`);
  }
  console.error("");
  Deno.exit(1);
}

console.log("Frontmatter validation passed for all blog posts.");
