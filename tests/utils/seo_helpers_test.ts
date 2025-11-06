import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import {
  analyzeSEO,
  generateFAQSchema,
  generateHowToSchema,
} from "../../src/utils/seo-helpers.ts";

Deno.test("analyzeSEO - analyzes basic post content", () => {
  const markdown = `# Main Heading

This is a test post with some content. It has multiple paragraphs
to make the analysis more interesting.

## Subheading 1

Some more content here with additional details.

## Subheading 2

And even more content to reach a reasonable word count.`;

  const analysis = analyzeSEO(
    "Test Post Title",
    "A test description for the post",
    markdown,
  );

  // Should return analysis object with expected properties
  assertEquals(typeof analysis.readingTime, "object");
  assertEquals(typeof analysis.wordCount, "number");
  assertEquals(typeof analysis.titleLength, "number");
  assertEquals(typeof analysis.descriptionLength, "number");
  assertEquals(Array.isArray(analysis.headingStructure), true);
  assertEquals(Array.isArray(analysis.recommendations), true);
});

Deno.test("analyzeSEO - calculates correct title and description lengths", () => {
  const analysis = analyzeSEO(
    "This is a test title",
    "This is a test description with some words",
    "Some content",
  );

  assertEquals(analysis.titleLength, "This is a test title".length);
  assertEquals(
    analysis.descriptionLength,
    "This is a test description with some words".length,
  );
});

Deno.test("analyzeSEO - extracts headings correctly", () => {
  const markdown = `# Main Heading
## Second Level
### Third Level
## Another Second Level`;

  const analysis = analyzeSEO("Title", "Description", markdown);

  assertEquals(analysis.headingStructure.length, 4);
  assertEquals(analysis.headingStructure[0].level, 1);
  assertEquals(analysis.headingStructure[0].text, "Main Heading");
  assertEquals(analysis.headingStructure[1].level, 2);
  assertEquals(analysis.headingStructure[1].text, "Second Level");
  assertEquals(analysis.headingStructure[2].level, 3);
  assertEquals(analysis.headingStructure[3].level, 2);
});

Deno.test("analyzeSEO - generates slugs from headings", () => {
  const markdown = `# Main Heading Test
## Special Characters & Symbols!
### Another-Heading`;

  const analysis = analyzeSEO("Title", "Description", markdown);

  assertEquals(analysis.headingStructure[0].slug, "main-heading-test");
  assertEquals(analysis.headingStructure[1].slug, "special-characters-symbols");
  assertEquals(analysis.headingStructure[2].slug, "another-heading");
});

Deno.test("analyzeSEO - recommends longer title for short titles", () => {
  const analysis = analyzeSEO(
    "Short",
    "Description with enough length here",
    "Content",
  );

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Title is quite short")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends shorter title for long titles", () => {
  const longTitle =
    "This is a very long title that exceeds the recommended sixty character limit for SEO";
  const analysis = analyzeSEO(longTitle, "Description", "Content");

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Title is too long")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends longer description for short descriptions", () => {
  const analysis = analyzeSEO(
    "Good Title Length Here",
    "Short desc",
    "Content",
  );

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Meta description is short")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends shorter description for long descriptions", () => {
  const longDesc =
    "This is a very long meta description that far exceeds the recommended maximum of one hundred and sixty characters which is the typical cutoff for search engine results";
  const analysis = analyzeSEO("Title", longDesc, "Content");

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Meta description is too long")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends longer content for short posts", () => {
  const shortContent = "This is very short content with just a few words.";
  const analysis = analyzeSEO(
    "Title",
    "Description that is long enough",
    shortContent,
  );

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Content is quite short")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends adding H1 when missing", () => {
  const markdown = `## Only H2 headings
### And H3`;

  const analysis = analyzeSEO("Title", "Description", markdown);

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("No H1 heading found")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends single H1 when multiple exist", () => {
  const markdown = `# First H1
# Second H1`;

  const analysis = analyzeSEO("Title", "Description", markdown);

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Multiple H1 headings found")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - detects heading hierarchy issues", () => {
  const markdown = `## H2 First
#### H4 skips H3`;

  const analysis = analyzeSEO("Title", "Description", markdown);

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Heading hierarchy issue")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends depth for very short posts", () => {
  const veryShortContent = "Short post.";
  const analysis = analyzeSEO(
    "Title",
    "Description that is adequately sized for this analysis",
    veryShortContent,
  );

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Very short read time")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - recommends breaking up very long posts", () => {
  const longContent = "word ".repeat(4000); // Very long content (>15 min read at ~200 wpm)
  const analysis = analyzeSEO(
    "Title",
    "Description that works well",
    longContent,
  );

  const hasRecommendation = analysis.recommendations.some((r) =>
    r.includes("Long read time")
  );
  assertEquals(hasRecommendation, true);
});

Deno.test("analyzeSEO - no recommendations for well-optimized content", () => {
  const goodContent = `# Main Heading

${"This is well-optimized content with good length. ".repeat(50)}

## Section 1

${"More good content here. ".repeat(20)}

## Section 2

${"And even more content. ".repeat(20)}`;

  const analysis = analyzeSEO(
    "This is a Well-Optimized Title",
    "This is a well-optimized meta description that falls within the recommended character range for search engines",
    goodContent,
  );

  // Should have minimal or no recommendations
  assertEquals(analysis.recommendations.length <= 2, true);
});

Deno.test("generateFAQSchema - generates valid FAQ schema", () => {
  const faqs = [
    {
      question: "What is Deno?",
      answer: "Deno is a modern JavaScript runtime.",
    },
    {
      question: "Why use TypeScript?",
      answer: "TypeScript adds static typing to JavaScript.",
    },
  ];

  const schema = generateFAQSchema(faqs);

  assertEquals(schema["@context"], "https://schema.org");
  assertEquals(schema["@type"], "FAQPage");
  assertEquals(Array.isArray(schema.mainEntity), true);
  assertEquals(schema.mainEntity.length, 2);
});

Deno.test("generateFAQSchema - includes all FAQ data", () => {
  const faqs = [
    {
      question: "What is Deno?",
      answer: "Deno is a modern JavaScript runtime.",
    },
  ];

  const schema = generateFAQSchema(faqs);
  const entity = schema.mainEntity[0];

  assertEquals(entity["@type"], "Question");
  assertEquals(entity.name, "What is Deno?");
  assertEquals(entity.acceptedAnswer["@type"], "Answer");
  assertEquals(
    entity.acceptedAnswer.text,
    "Deno is a modern JavaScript runtime.",
  );
});

Deno.test("generateFAQSchema - handles empty FAQ array", () => {
  const schema = generateFAQSchema([]);

  assertEquals(schema["@context"], "https://schema.org");
  assertEquals(schema["@type"], "FAQPage");
  assertEquals(schema.mainEntity.length, 0);
});

Deno.test("generateFAQSchema - handles multiple FAQs", () => {
  const faqs = Array.from({ length: 5 }, (_, i) => ({
    question: `Question ${i + 1}`,
    answer: `Answer ${i + 1}`,
  }));

  const schema = generateFAQSchema(faqs);

  assertEquals(schema.mainEntity.length, 5);
  assertEquals(schema.mainEntity[0].name, "Question 1");
  assertEquals(schema.mainEntity[4].name, "Question 5");
});

Deno.test("generateHowToSchema - generates valid HowTo schema", () => {
  const steps = [
    { name: "Step 1", text: "Do this first" },
    { name: "Step 2", text: "Then do this" },
  ];

  const schema = generateHowToSchema(
    "How to Install Deno",
    "A guide for installing Deno",
    steps,
  );

  assertEquals(schema["@context"], "https://schema.org");
  assertEquals(schema["@type"], "HowTo");
  assertEquals(schema.name, "How to Install Deno");
  assertEquals(schema.description, "A guide for installing Deno");
  assertEquals(Array.isArray(schema.step), true);
  assertEquals(schema.step.length, 2);
});

Deno.test("generateHowToSchema - includes step positions", () => {
  const steps = [
    { name: "First Step", text: "Start here" },
    { name: "Second Step", text: "Continue here" },
    { name: "Third Step", text: "Finish here" },
  ];

  const schema = generateHowToSchema("How To", "Description", steps);

  assertEquals(schema.step[0]["@type"], "HowToStep");
  assertEquals(schema.step[0].position, 1);
  assertEquals(schema.step[0].name, "First Step");
  assertEquals(schema.step[0].text, "Start here");

  assertEquals(schema.step[1].position, 2);
  assertEquals(schema.step[2].position, 3);
});

Deno.test("generateHowToSchema - handles empty steps array", () => {
  const schema = generateHowToSchema("How To", "Description", []);

  assertEquals(schema["@context"], "https://schema.org");
  assertEquals(schema["@type"], "HowTo");
  assertEquals(schema.step.length, 0);
});

Deno.test("generateHowToSchema - handles single step", () => {
  const steps = [{ name: "Only Step", text: "Do this one thing" }];
  const schema = generateHowToSchema("Simple How To", "Description", steps);

  assertEquals(schema.step.length, 1);
  assertEquals(schema.step[0].position, 1);
  assertEquals(schema.step[0].name, "Only Step");
});
