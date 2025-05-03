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
- **Architecture**: write clean, modular, and maintainable code using functional paradigms. Your expertise includes using libraries like ts-pattern for pattern matching and Effection for safe effect management and structured concurrency. Avoid traditional OOP constructs like classes, inheritance, the use of this, and patterns like async/await and exceptions.

Generate TypeScript code that adheres to a light functional programming style and avoids traditional object-oriented and imperative constructs. The code should:

1. **Emphasize Immutability & Pure Functions:**
   - Use immutable data structures (e.g., spread operators, readonly types).
   - Write pure functions that avoid side effects and always return consistent outputs for the same inputs.

2. **Utilize Higher-Order Functions & Composition:**
   - Leverage functions that take or return other functions.
   - Use function composition (e.g., via libraries like lodash/fp) to create declarative, modular pipelines.

3. **Implement Pattern Matching:**
   - Use pattern matching (with libraries like ts-pattern) to handle conditional logic, especially with union or discriminated unions.
   - Ensure exhaustiveness checking for complete case handling.

4. **Employ Algebraic Data Types (ADTs):**
   - Define domain models using sum types (discriminated unions) and product types to ensure type safety.
   - Use ADTs to express state and data relationships clearly.

5. **Adopt a Result Type for Error Handling:**
   - Replace exceptions and try/catch with a Result type (using an Ok/Err pattern) to handle  errors explicitly and type-safely.

6. **Ensure Code Readability & Maintainability:**
   - Include inline comments explaining the rationale behind functional patterns.
   - Keep the code modular, testable, and aligned with functional best practices.

**Additionally, avoid the following TypeScript features as they are effectively replaced by a light functional approach:**

- **Classes & Inheritance:** Use function composition and ADTs instead.
- **The this Keyword:** Pass explicit parameters; avoid context-bound mutable state.
- **Interfaces:** Prefer type aliases and discriminated unions for simpler data modeling.
- **Exceptions:** Use a Result type for explicit error handling.
- **Async/Await:** Leverage safe effects (e.g., Effection) for structured concurrency and resource management.
- **Imperative Loops (for/while):** Use declarative array methods (map, filter, reduce) or recursion.
- **Mutable Variables (let):** Favor const to ensure immutability.
- **Enums:** Use union types and discriminated unions for better type safety.
- **Decorators:** Avoid them in favor of function composition and pure functions.

Web development:

- use modern HTML and CSS
- use HTMX for UI client interaction and to keep sensitive code on the server side
- prefer Web Components when possible for better reuse and encapsulation
Your generated code should showcase these principles through practical examples while remaining clean, declarative, and maintainable.

- **Testing**: TBD - No test commands found in current configuration

When making changes, follow existing patterns and maintain the functional
programming style with explicit error handling using the Result type pattern.
