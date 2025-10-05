# Blog Writing Style Guide

## Who We Are

A technologist who bridges code and culture. We write for people who care about the _why_ behind the _how_ - the folks who understand that good software is as much about people and context as it is about algorithms and architecture.

## Voice & Tone

### The Core Feel
- **Conversational, not corporate**: Write like you're explaining something to a sharp colleague over coffee
- **Opinionated with humility**: Have a point of view, but acknowledge when things are complex or situational
- **Technical depth meets human context**: Code matters, but so does culture, incentives, and real-world messiness
- **Skeptical optimism**: We believe in better ways, but we've seen enough projects to know nothing is a silver bullet

### What This Sounds Like

**✅ Do this:**
> "Here's the thing about microservices - everyone talks about the technical benefits, but nobody warns you about the organizational chaos. You're not just splitting your codebase; you're splitting your teams, your deployment pipelines, and your late-night debugging sessions."

**❌ Not this:**
> "Microservices architecture offers several advantages including improved scalability and deployment flexibility. However, organizations should carefully consider the operational complexity."

### Language Patterns

- **Use "you" and "we"** - We're in this together
- **Ask questions** - "Ever wondered why...?" "What if we..."
- **Share war stories** - "I've seen teams struggle with..." "In my experience..."
- **Admit uncertainty** - "I could be wrong, but..." "This worked for us, YMMV..."
- **Use metaphors from real life** - Not just technical analogies

## Structure & Flow

### Standard Post Structure

1. **Hook (1-2 paragraphs)**
   - Start with a problem, observation, or contrarian take
   - Make it concrete and relatable
   - Example: "The last three teams I worked with all made the same mistake..."

2. **Context & Stakes (2-3 paragraphs)**
   - Why does this matter?
   - What's the business/human impact?
   - Who's affected and how?

3. **The Meat (varies)**
   - Your actual insights, patterns, or solutions
   - Mix technical details with human/organizational implications
   - Break into clear sections with descriptive headings

4. **Examples & Evidence**
   - Code snippets that actually teach something
   - Real scenarios (anonymized if needed)
   - Data or research when available, experience when not

5. **Synthesis (2-3 paragraphs)**
   - What should readers take away?
   - What are the trade-offs?
   - When does this apply vs. when doesn't it?

### Pacing

- **Vary paragraph length** - Mix 1-liners with 4-liners
- **One idea per paragraph** - Each paragraph should make one clear point
- **Break up text** - Use headings, lists, code blocks, quotes
- **Rhythm matters** - Short sentences for impact. Longer ones for nuance and explanation.

## Writing Rules

### Clarity

- **Explain jargon once** - First use: "Domain-Driven Design (DDD)". After: "DDD"
- **No buzzword soup** - "Leverage synergies" → "Work together better"
- **Active voice default** - "The team shipped" not "The feature was shipped"
- **Concrete over abstract** - Examples > Theory

### Personality

- **Inject personal experience**:
  - "I spent three months debugging this, so you don't have to"
  - "This sounds great in theory. In practice, it's messier"

- **Show your thinking**:
  - "At first I thought X, but then Y happened..."
  - "This bothered me for weeks until I realized..."

- **Acknowledge complexity**:
  - "It depends" is a valid answer
  - "For certain contexts..." not "Always do this..."

### Technical Content

- **Code examples should**:
  - Actually run
  - Show the problem AND solution
  - Include comments for the tricky bits
  - Use realistic variable names (not `foo`, `bar`)

- **Technical depth**:
  - Assume smart readers who might not know this specific thing
  - Don't skip steps in logic
  - Link to deeper resources for the curious

### Business & Culture Insights

- **Connect tech to outcomes**:
  - "This architecture doesn't just make deploys faster - it changes who can deploy"
  - "The real cost isn't the database license, it's the three meetings per schema change"

- **Talk about people**:
  - "Developers will route around this if it's painful"
  - "Management cares about different metrics than engineers"

- **Acknowledge politics**:
  - "Getting buy-in for this means..."
  - "The org chart is the architecture"

## Formatting Guidelines

### Headings
- **H1**: Post title only
- **H2**: Major sections
- **H3**: Sub-sections
- **Keep them descriptive**: "Why Your Tests Are Lying to You" not "Testing Issues"

### Lists
- Use when you have 3+ related items
- Start each item with a verb when possible
- Keep parallel structure
- Bold the key term if it helps scanning

### Code Blocks
- Always specify the language: ` ```typescript`
- Include context comments
- Show before/after when teaching a transformation
- Keep examples short enough to grasp quickly

### Emphasis
- **Bold** for key terms and important points
- _Italics_ for subtle emphasis or introducing a concept
- `Code` for technical terms, commands, file names
- Don't overdo it - emphasis loses power if everything is emphasized

### Quotes
- Use blockquotes for important external sources
- Use them sparingly - your voice should dominate
- Always attribute

## Content Principles

### Mix Tactical and Strategic
Every post should offer:
- Something you can use Monday morning (tactical)
- Something that changes how you think (strategic)

### Embrace Nuance
- "It depends" is fine if you explain what it depends on
- Trade-offs are more interesting than "best practices"
- Context matters more than rules

### Be Useful, Not Just Right
- Better to help someone solve their problem than prove your point
- Practical beats theoretically pure
- Reader's time is precious

### Show Your Work
- How did you learn this?
- What mistakes did you make?
- What would you do differently?

## Things to Avoid

### ❌ Don't Do This

**Preachy tone**:
- "You should always..." → "Consider..." or "I've found..."
- "Best practices dictate..." → "This pattern works when..."

**Explaining the obvious**:
- Skip the "What is TypeScript?" intro for a post about advanced TS patterns
- Trust your audience's intelligence

**Pure theory without application**:
- Every concept needs a "so what?" and a "for example"

**Hedging everything**:
- Some opinions are worth stating directly
- "Maybe, possibly, perhaps, might, could be, potentially" - pick one, not all

**Corporate speak**:
- "Facilitate" → "Help"
- "Utilize" → "Use"
- "Leverage" → "Use" (usually)

## Post Length Guidelines

- **Short form (800-1200 words)**: Single insight, pattern, or technique
- **Standard (1500-2500 words)**: Most posts - enough to explore, not so much you lose readers
- **Long form (3000+ words)**: Comprehensive guides - split into clear sections

## Checklist Before Publishing

- [ ] Does the title make a promise the post keeps?
- [ ] Can someone use this information within a week?
- [ ] Did I explain _why_ not just _what_?
- [ ] Are there concrete examples?
- [ ] Did I share something from experience, not just research?
- [ ] Would I send this to a colleague I respect?
- [ ] Is every technical term either explained or linked?
- [ ] Does it sound like a human wrote it?

## Examples of the Right Tone

### Opening Hooks That Work

> "The most expensive line of code I ever wrote was a comment. Not because it was wrong - it was perfectly accurate. The problem was it made everyone feel safe ignoring a terrible design decision for two more years."

> "Team topologies sound great until you realize you're reorganizing people like microservices, hoping human relationships will behave like APIs. Spoiler: they don't."

> "I used to think code review was about finding bugs. Then I watched a senior engineer approve terrible code because fighting about it wasn't worth the political capital. That's when I learned code review is actually about trust and power."

### Technical Explanation That Breathes

> "Type systems are like compiler-enforced documentation. They won't catch every bug, but they force you to think about edge cases before they wake you up at 3 AM. And unlike comments, they can't lie to you - okay, they can if you use `any` everywhere, but that's on you."

### Business Context That Lands

> "Here's what the architecture diagram won't tell you: every service boundary is also a team boundary. Which means every API design discussion is actually a negotiation about who owns what, who's on call when it breaks, and who gets blamed when customers complain."

## Final Notes

This guide isn't a rulebook - it's a north star. The goal is posts that are:
- **Honest** - Say what you think, show your reasoning
- **Useful** - People should learn something they can apply
- **Human** - Sound like a person, not a documentation generator
- **Respectful** - Of the reader's time and intelligence

Write the posts you wish you'd read three years ago.
