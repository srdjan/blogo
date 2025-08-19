import { assertEquals } from "@std/assert";
import { calculateReadingTime, getReadingTimeMeta } from "../../src/utils/reading-time.ts";

Deno.test("calculateReadingTime - calculates correct reading time for short text", () => {
  const shortText = "This is a short text with exactly ten words here.";
  const result = calculateReadingTime(shortText);
  
  assertEquals(result.words, 10);
  assertEquals(result.minutes, 1); // Minimum 1 minute
  assertEquals(result.text, "1 min read");
});

Deno.test("calculateReadingTime - calculates correct reading time for longer text", () => {
  // Create text with approximately 450 words (should be 2 minutes at 225 wpm)
  const words = Array.from({ length: 450 }, (_, i) => `word${i}`);
  const longText = words.join(" ");
  
  const result = calculateReadingTime(longText);
  
  assertEquals(result.words, 450);
  assertEquals(result.minutes, 2);
  assertEquals(result.text, "2 min read");
});

Deno.test("calculateReadingTime - removes frontmatter from calculation", () => {
  const textWithFrontmatter = `---
title: Test Post
date: 2025-01-15
tags:
  - Testing
  - Blog
---

This is the actual content that should be counted for reading time calculation.`;

  const result = calculateReadingTime(textWithFrontmatter);
  
  // Should only count the content after frontmatter
  assertEquals(result.words, 13);
  assertEquals(result.minutes, 1);
});

Deno.test("calculateReadingTime - removes code blocks from calculation", () => {
  const textWithCodeBlocks = `# Test Post

This is regular text that should be counted.

\`\`\`javascript
// This code block should not be counted
const test = "hello world";
console.log(test);
function example() {
  return "lots of code here";
}
\`\`\`

More regular text that should be counted.`;

  const result = calculateReadingTime(textWithCodeBlocks);
  
  // Should only count the regular text, not the code block
  assertEquals(result.words, 13); // "This is regular text..." + "More regular text..."
  assertEquals(result.minutes, 1);
});

Deno.test("calculateReadingTime - removes inline code from calculation", () => {
  const textWithInlineCode = `# Test Post

This text has \`inline code\` and \`more code\` that should not be counted.

Regular words should be counted though.`;

  const result = calculateReadingTime(textWithInlineCode);
  
  // Should count "This text has and that should not be counted Regular words should be counted though"
  assertEquals(result.words, 16);
  assertEquals(result.minutes, 1);
});

Deno.test("calculateReadingTime - removes markdown formatting", () => {
  const textWithMarkdown = `# Heading

This is **bold text** and *italic text* and [link text](http://example.com).

## Another Heading

- List item one
- List item two
- List item three

> This is a blockquote with some text.`;

  const result = calculateReadingTime(textWithMarkdown);
  
  // Should count all the text content without markdown syntax
  assertEquals(result.words, 24);
  assertEquals(result.minutes, 1);
});

Deno.test("calculateReadingTime - handles empty content", () => {
  const emptyText = "";
  const result = calculateReadingTime(emptyText);
  
  assertEquals(result.words, 0);
  assertEquals(result.minutes, 1); // Minimum 1 minute
  assertEquals(result.text, "1 min read");
});

Deno.test("calculateReadingTime - handles whitespace-only content", () => {
  const whitespaceText = "   \n\n\t  \n  ";
  const result = calculateReadingTime(whitespaceText);
  
  assertEquals(result.words, 0);
  assertEquals(result.minutes, 1); // Minimum 1 minute
});

Deno.test("calculateReadingTime - handles content with only frontmatter", () => {
  const onlyFrontmatter = `---
title: Test Post
date: 2025-01-15
tags:
  - Testing
---`;

  const result = calculateReadingTime(onlyFrontmatter);
  
  assertEquals(result.words, 0);
  assertEquals(result.minutes, 1); // Minimum 1 minute
});

Deno.test("calculateReadingTime - handles content with only code blocks", () => {
  const onlyCodeBlocks = `\`\`\`javascript
const test = "hello";
console.log(test);
\`\`\`

\`\`\`python
print("hello world")
\`\`\``;

  const result = calculateReadingTime(onlyCodeBlocks);
  
  assertEquals(result.words, 0);
  assertEquals(result.minutes, 1); // Minimum 1 minute
});

Deno.test("calculateReadingTime - counts words correctly with punctuation", () => {
  const textWithPunctuation = "Hello, world! This is a test. How are you? I'm fine, thanks.";
  const result = calculateReadingTime(textWithPunctuation);
  
  assertEquals(result.words, 12);
  assertEquals(result.minutes, 1);
});

Deno.test("calculateReadingTime - handles mixed content types", () => {
  const mixedContent = `---
title: Complex Post
date: 2025-01-15
---

# Introduction

This is a complex post with **bold text**, *italic text*, and \`inline code\`.

\`\`\`javascript
// This code should not be counted
const example = "hello world";
console.log(example);
\`\`\`

## Main Content

Here's the main content with [a link](http://example.com) and more text.

- List item one
- List item two  
- List item three

> A blockquote with some important information.

### Conclusion

Final thoughts and \`more inline code\` to wrap up.`;

  const result = calculateReadingTime(mixedContent);
  
  // Should count only the readable text content
  assertEquals(result.words, 35);
  assertEquals(result.minutes, 1);
});

Deno.test("getReadingTimeMeta - formats time correctly", () => {
  const readingTime1 = { minutes: 1, words: 100, text: "1 min read" };
  const readingTime5 = { minutes: 5, words: 1000, text: "5 min read" };
  const readingTime15 = { minutes: 15, words: 3000, text: "15 min read" };
  
  assertEquals(getReadingTimeMeta(readingTime1), "PT1M");
  assertEquals(getReadingTimeMeta(readingTime5), "PT5M");
  assertEquals(getReadingTimeMeta(readingTime15), "PT15M");
});

Deno.test("calculateReadingTime - realistic blog post", () => {
  // Simulate a realistic blog post with ~500 words
  const realisticPost = `---
title: Understanding JavaScript Closures
date: 2025-01-15
tags:
  - JavaScript
  - Programming
---

# Understanding JavaScript Closures

JavaScript closures are one of the most powerful and often misunderstood features of the language. In this comprehensive guide, we'll explore what closures are, how they work, and why they're so important for JavaScript developers.

## What is a Closure?

A closure is a function that has access to variables in its outer (enclosing) scope even after the outer function has returned. This is a fundamental concept that enables many advanced JavaScript patterns.

\`\`\`javascript
function outerFunction(x) {
  // This is the outer function's scope
  
  function innerFunction(y) {
    // This inner function has access to x
    console.log(x + y);
  }
  
  return innerFunction;
}

const myClosure = outerFunction(10);
myClosure(5); // Outputs: 15
\`\`\`

## How Closures Work

When a function is created in JavaScript, it maintains a reference to its lexical environment. This environment consists of any local variables that were in-scope at the time the closure was created.

### Practical Examples

Closures are commonly used in several scenarios:

1. **Data Privacy**: Creating private variables
2. **Function Factories**: Generating specialized functions
3. **Event Handlers**: Maintaining state in callbacks
4. **Module Patterns**: Encapsulating functionality

Let's look at a practical example of data privacy:

\`\`\`javascript
function createCounter() {
  let count = 0;
  
  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count
  };
}

const counter = createCounter();
console.log(counter.getCount()); // 0
counter.increment();
console.log(counter.getCount()); // 1
\`\`\`

## Common Pitfalls

While closures are powerful, they can also lead to some common mistakes:

- **Memory Leaks**: Closures can prevent garbage collection
- **Loop Variables**: Classic issue with event handlers in loops
- **Performance**: Unnecessary closure creation can impact performance

## Best Practices

To use closures effectively:

1. Understand when closures are created
2. Be mindful of memory usage
3. Use closures for encapsulation
4. Avoid unnecessary closure creation in loops

## Conclusion

Closures are a fundamental part of JavaScript that enable powerful programming patterns. By understanding how they work and when to use them, you can write more effective and maintainable JavaScript code.

Remember that closures are created every time a function is created, and they maintain access to their outer scope throughout their lifetime. This makes them incredibly useful for creating private variables, function factories, and maintaining state in asynchronous operations.`;

  const result = calculateReadingTime(realisticPost);
  
  // Should be approximately 2-3 minutes for ~500 words of readable content
  assertEquals(result.minutes >= 2 && result.minutes <= 3, true);
  assertEquals(result.words >= 400 && result.words <= 600, true);
});
