# Blog Writing Style Guide

*Personal technical blog with a relaxed, thoughtful tone*

## Core Voice Characteristics

This blog writes from a place of **curiosity, clarity, and hands-on experience**. The tone is:

- **Conversational and approachable** - Like explaining something interesting to a friend
- **Technically grounded** - Focus on concrete examples and real code/patterns
- **Balanced perspective** - Show different angles without being overly careful or formal
- **Natural and unpretentious** - Write like a person, not an academic paper
- **Practice-oriented** - What actually works, what doesn't, and why

## Language Patterns

### Sentence Structure
- **Direct and clear** - Get to the point without ceremony
- **Mix it up** - Some short sentences. Some longer ones with nuance.
- **Active voice mostly** - But passive is fine when it reads better
- **Natural flow** - Write how you'd actually explain it

### Word Choice
- **Plain language** - "simple," "works well," "tricky part"
- **Specific when it matters** - Concrete examples over abstract concepts
- **Technical terms naturally** - Use them when needed, explain when helpful
- **Avoid pretense** - No "one might consider" or "it is worth noting"

### Framing
- **Sparse first-person** - Minimize "I found," "I noticed," "I discovered"
- **State things directly** - "This works because..." not "I found this works because..."
- **Focus on the topic** - Not on your journey through it
- **Show, don't narrate** - Code and examples over exploration stories

## Structure & Organization

### Opening
Start with **what this is about** and **why it's interesting**:
> "HTMX lets you build interactive UIs without writing JavaScript. Sounds too good to be true, but here's what makes it work..."

Get to the point in 1-2 paragraphs.

### Body
**Logical flow based on the topic**:
1. Start with the core concept or problem
2. Show how it works (code examples)
3. Cover the important details
4. Mention tradeoffs or limitations

Organize for clarity, not for ceremony.

### Closing
End with **takeaways or implications**:
> "This approach won't replace React everywhere, but for server-rendered apps with some interactivity, it's surprisingly capable."

No grand conclusions about journeys or commitments needed.

## Content Principles

### Show, Don't Narrate
- Lead with examples and code, not with "I was exploring..."
- Let the topic be interesting, not your journey to it
- Skip the exploration narrative - just explain the thing

### Be Direct About Tradeoffs
- "This works great for X, but falls apart with Y"
- No need to say "one might consider" - just state it
- Acknowledge limitations without hedging everything

### Minimal Personal Commentary
- Cut most "I noticed," "I found," "I think"
- Just state the observation: "This has an interesting property..."
- Occasional personal note is fine, but don't narrate the whole journey

### Natural Technical Writing
- Use "you" when walking through something: "You can configure this..."
- State facts directly: "This approach has two benefits..."
- Ask rhetorical questions if they help: "Why does this work?"

## Formatting Guidelines

### Headings
- **Clear, descriptive** - "'Team Autonomy' is the first top-level credo"
- **Quoted concepts** for emphasis - 'Production Ready', 'Team Autonomy'
- Use headings to create hierarchy and structure

### Visual Elements
- **Diagrams and visual breakdowns** where they clarify concepts
- **Italicized terms** for concepts being defined - *engineering philosophy*
- **Structured lists** for stages, phases, or components

### Paragraph Length
- **2-4 sentences typically**
- Each paragraph develops one complete thought
- Use white space to create breathing room

## Examples of the Style

### Opening (Get to the point):
> "Deno's built-in testing is surprisingly capable. No dependencies, no configuration, just write tests. Here's what makes it work."

### Explaining Something:
> "The key is how HTMX handles partial updates. Instead of replacing the whole page, it swaps just the piece that changed. This means you can keep your server-side rendering but add interactivity where you need it."

### Showing Tradeoffs:
> "This works well for CRUD apps and content-driven sites. It breaks down when you need complex client-side state or real-time collaboration. Pick the right tool for the job."

### Code Example Lead-in:
> "Here's the basic pattern. The server returns HTML fragments, and HTMX swaps them in:"

### Closing:
> "The best part? You're writing plain HTML on the server. No build step, no hydration, no bundle size to worry about."

## Avoid

❌ **Exploration narratives** - "I've been investigating..." "I discovered..." "I explored..."
❌ **Excessive "I" statements** - "I found that..." "I think..." "I noticed..."
❌ **Formal hedging** - "One might consider..." "It is worth noting..." "This suggests that..."
❌ **Research speak** - "investigating," "exploring," "examining," "worth exploring"
❌ **Process descriptions** - Skip how you learned it; just explain it
❌ **War stories** - Production incidents, debugging sagas

## Do

✅ **State things directly** - "This works because..." not "I found this works..."
✅ **Show with code** - Examples over abstract descriptions
✅ **Be practical** - "This approach has two benefits..."
✅ **Natural tone** - Write like you're explaining to a friend
✅ **Acknowledge limits** - "This breaks down when..."
✅ **Focus on the topic** - Not your journey through it

## Post Structure Template

1. **Opening (1-2 paragraphs)**
   - What this is about
   - Why it's interesting or useful

2. **Core Explanation**
   - How it works (with code examples)
   - Key concepts or patterns
   - Concrete details

3. **Important Bits**
   - Things that matter in practice
   - Common patterns or gotchas
   - More examples if needed

4. **Tradeoffs or Limitations**
   - Where this works well
   - Where it doesn't
   - Honest assessment

5. **Closing (1 paragraph)**
   - Practical takeaway
   - When to consider this approach

## Checklist Before Publishing

- [ ] Gets to the point quickly (no long exploration intro)?
- [ ] Minimal "I found/noticed/discovered" statements?
- [ ] Shows concrete examples and code?
- [ ] States things directly without formal hedging?
- [ ] Acknowledges tradeoffs honestly?
- [ ] Avoids "investigating/exploring/examining" language?
- [ ] Feels like explaining to a friend, not writing a research paper?
- [ ] Technical concepts explained clearly?
- [ ] No unnecessary process descriptions?

## Summary: The Core Pattern

**State what it is** → **Show how it works** → **Explain the interesting parts** → **Acknowledge limits** → **Practical takeaway**

Write like a person sharing something useful they learned. Be direct, clear, and unpretentious. Focus on the topic, not your journey to understanding it. Show with code and examples.
