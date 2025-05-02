# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Build & Development Commands

- `deno task start` - Run blog (--allow-net --allow-read --allow-env)
- `deno task dev` - Run with file watching
- `deno task setup` - Create directories and download dependencies
- `deno lint` - Run linter on src/ and main.ts
- `deno fmt` - Format code according to rules in deno.json

## Code Style Guidelines

- **Formatting**: 2-space indent, 80 char line width, double quotes
- **Imports**: Group by functionality, use `import type` for type imports,
  include .ts extension
- **Types**: Strong TypeScript typing with interfaces, use Result<T, E> pattern
- **Naming**: PascalCase for types/interfaces, camelCase for variables/functions
- **Error Handling**: Functional approach with Result type and pattern matching
- **Documentation**: Document pure functions, include JSDoc comments for complex
  functions
- **Architecture**: Follow modular approach with separate files for distinct
  functionality
- **Testing**: TBD - No test commands found in current configuration

When making changes, follow existing patterns and maintain the functional
programming style with explicit error handling using the Result type pattern.
