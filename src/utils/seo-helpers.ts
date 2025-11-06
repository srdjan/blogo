/**
 * SEO utilities for analyzing and optimizing blog content
 */

import {
  calculateReadingTime,
  type ReadingTimeResult,
} from "./reading-time.ts";

export type SEOAnalysis = {
  readonly readingTime: ReadingTimeResult;
  readonly wordCount: number;
  readonly titleLength: number;
  readonly descriptionLength: number;
  readonly headingStructure: HeadingInfo[];
  readonly recommendations: string[];
};

export type HeadingInfo = {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
};

/**
 * Extract headings from markdown content
 */
function extractHeadings(markdown: string): HeadingInfo[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: HeadingInfo[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    headings.push({ level, text, slug });
  }

  return headings;
}

/**
 * Generate SEO recommendations based on content analysis
 */
function generateRecommendations(
  title: string,
  description: string,
  content: string,
  headings: HeadingInfo[],
): string[] {
  const recommendations: string[] = [];

  // Title analysis
  if (title.length < 30) {
    recommendations.push(
      "Title is quite short - consider adding more descriptive keywords",
    );
  } else if (title.length > 60) {
    recommendations.push(
      "Title is too long - may be truncated in search results (keep under 60 characters)",
    );
  }

  // Description analysis
  if (description.length < 120) {
    recommendations.push(
      "Meta description is short - consider expanding to 150-160 characters",
    );
  } else if (description.length > 160) {
    recommendations.push(
      "Meta description is too long - may be truncated in search results",
    );
  }

  // Content length analysis
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 300) {
    recommendations.push(
      "Content is quite short - longer content often performs better in search",
    );
  }

  // Heading structure analysis
  const h1Count = headings.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    recommendations.push(
      "No H1 heading found - add a main heading for better SEO",
    );
  } else if (h1Count > 1) {
    recommendations.push(
      "Multiple H1 headings found - use only one H1 per page",
    );
  }

  // Check for heading hierarchy
  for (let i = 1; i < headings.length; i++) {
    const current = headings[i];
    const previous = headings[i - 1];

    if (current.level > previous.level + 1) {
      recommendations.push(
        `Heading hierarchy issue: H${current.level} follows H${previous.level} - avoid skipping heading levels`,
      );
    }
  }

  // Reading time analysis
  const readingTime = calculateReadingTime(content);
  if (readingTime.minutes < 2) {
    recommendations.push(
      "Very short read time - consider adding more depth or examples",
    );
  } else if (readingTime.minutes > 15) {
    recommendations.push(
      "Long read time - consider breaking into multiple posts or adding a table of contents",
    );
  }

  return recommendations;
}

/**
 * Perform comprehensive SEO analysis of blog post content
 */
export function analyzeSEO(
  title: string,
  description: string,
  markdown: string,
): SEOAnalysis {
  const readingTime = calculateReadingTime(markdown);
  const headings = extractHeadings(markdown);
  const recommendations = generateRecommendations(
    title,
    description,
    markdown,
    headings,
  );

  return {
    readingTime,
    wordCount: readingTime.words,
    titleLength: title.length,
    descriptionLength: description.length,
    headingStructure: headings,
    recommendations,
  };
}

/**
 * Generate FAQ schema from content
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}

/**
 * Generate HowTo schema for tutorial content
 */
export function generateHowToSchema(
  name: string,
  description: string,
  steps: Array<{ name: string; text: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
    })),
  };
}
