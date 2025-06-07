# Functional Minimal Blog

A lightweight, type-safe, functional blog implementation built with Deno,
TypeScript, HTMX, and Markdown, using the Mixon library for HTTP server
functionality.

## Core Principles

This blog system is built around several key architectural principles:

1. **Functional Programming**: Pure functions, immutability, and type-safe data
   transformations
2. **Minimal Dependencies**: Leveraging Deno's standard library with minimal
   external dependencies
3. **Progressive Enhancement**: Core functionality works without JavaScript,
   enhanced with HTMX
4. **Type Safety**: Comprehensive type system for robust error handling
5. **Semantic HTML**: Clean, accessible markup following modern best practices
6. **Pure CSS**: Minimal, responsive styling without frameworks
7. **Mixon Integration**: Using the
   [Mixon library](https://github.com/srdjan/mixon) for HTTP server
   functionality

## Features

- **Markdown Content**: Posts written in markdown with YAML frontmatter
- **Tag System**: Posts can be tagged and filtered by tag
- **Full-text Search**: Client-side search implementation
- **Pagination**: Efficient post listing with pagination
- **RSS Feed**: Automatic RSS feed generation
- **SEO Optimization**: Structured data, OpenGraph and Twitter Card metadata
- **Error Handling**: Robust error handling with Result monad pattern
- **Responsive Design**: Mobile-first styling that works on all devices

## Architecture

The project follows a functional architecture with clean separation of concerns:

### Core Modules

- `types.ts`: Type definitions with discriminated unions for error handling
- `config.ts`: Typed configuration management
- `parser.ts`: Markdown parsing with frontmatter extraction
- `render.ts`: Pure HTML rendering functions
- `routes.ts`: Route handlers using Mixon
- `middleware.ts`: Middleware functions for request processing
- `error.ts`: Functional error handling with Result monad pattern
- `search.ts`: Text search implementation
- `pagination.ts`: Type-safe pagination utilities
- `metadata.ts`: SEO metadata generation
- `rss.ts`: RSS feed generation

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) v2.2 or higher

### Installation

1. Clone the repository
2. Run the setup task to create the required directories and download HTMX:

```bash
deno task setup
```
