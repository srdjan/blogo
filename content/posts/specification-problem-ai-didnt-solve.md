---
title: "Treating Prompts as an Engineering Problem, Not a Free Form Jazz"
date: 2025-12-14
tags: [AI, DSPy, TypeScript, Engineering]
excerpt: Everyone talks about AI writing code. Fewer ask who writes the spec. Turns out there's a way to treat specification as an engineering problem, not a prompting art.
---

Everyone talks about AI writing code. Fewer ask who writes the spec.

I watched this for a while now. Teams build sophisticated tooling that can generate functions, refactor modules, scaffold entire services. Then they feed these tools the same vague user stories they always wrote - and wonder why the output misses the point.

The bottleneck was never code generation. It was always specification.

Take a user story like "As a customer, I want to reset my password so I can regain access to my account." Seems clear enough, right? But it leaves everything important unstated. What authentication proves you own the email? How long does the reset link live? What happens when someone requests another reset mid-process? What do we log? What's the failure UX?

An experienced engineer fills these gaps intuitively. An LLM fills them arbitrarily - or worse, confidently wrong.

## The Problem with Prompts

Most teams try writing better prompts. Add more context. Be more specific. Include examples.

This works until it doesn't. Prompts are brittle. They don't compose well. When you need consistency across dozens of user stories, you end up maintaining a sprawling prompt library that drifts out of sync with your actual architecture.

What's needed isn't a better prompt. It's a system that reliably transforms ambiguous input into structured output - and can be tuned, tested, and improved like any other piece of engineering infrastructure.

There's a growing ecosystem attacking this problem. Prompt enhancers like [Augment's 🔗](https://www.augmentcode.com/blog/prompt-enhancer-live-in-augment-chat) automatically expand terse instructions into richer context - useful for day-to-day coding. So, for repeatable, structured transformations like spec generation, ther is  a different paradigm more compelling.

## DSPy and Ax: Treating LLMs as Optimizable Modules

DSPy takes a different approach. Instead of treating language models as text-completion engines you coax with clever prompting, it treats them as optimizable modules with typed signatures. You define what goes in and what comes out. The framework figures out how to make the model produce it reliably.

Ax brings this to TypeScript with full type safety. Look at this:

```typescript
import { ai, ax, f } from "@ax-llm/ax";

const specSignature = f()
  .input("userStory", f.string("The user story to transform"))
  .input("domainContext", f.string("Architecture and domain constraints"))
  .output("apiContracts", f.array(f.object({
    method: f.string(),
    path: f.string(),
    requestBody: f.string(),
    responseSchema: f.string()
  })))
  .output("dataModels", f.array(f.object({
    name: f.string(),
    fields: f.array(f.string()),
    constraints: f.array(f.string())
  })))
  .output("acceptanceCriteria", f.array(f.string()))
  .output("edgeCases", f.array(f.string()))
  .output("testScenarios", f.array(f.string()))
  .build();
```

The signature declares intent. Ax handles the machinery of getting there - including automatic prompt optimization against examples of good output.

Here's the cool part: specifications aren't creative writing. They're structured artifacts with predictable shapes. API contracts have methods, paths, request bodies, response schemas. Data models have fields, types, constraints. When you model this explicitly, you can build pipelines:

```typescript
const llm = ai({ name: "anthropic", model: "claude-sonnet-4-20250514" });

const analyze = ax("userStory:string -> requirements:string[], assumptions:string[]");
const specify = ax(specSignature);
const review = ax("spec:string, requirements:string[] -> gaps:string[], risks:string[]");

const generateSpec = async (userStory: string, domainContext: string) => {
  const { requirements, assumptions } = await analyze.forward(llm, { userStory });
  const spec = await specify.forward(llm, { userStory, domainContext });
  const { gaps, risks } = await review.forward(llm, {
    spec: JSON.stringify(spec),
    requirements
  });
  return { spec, gaps, risks };
};
```

Three stages: analyze intent, generate structured spec, review for gaps. Each optimizable independently. Full TypeScript inference throughout.

## Adversarial Collaboration

A single agent generating specifications is useful. But the real leverage comes when you introduce adversarial collaboration.

The generated spec shouldn't go directly to implementation. It should go to a second agent - one whose job is to find holes. What's underspecified? What assumptions are implicit? What failure modes aren't covered?

This isn't artificial friction. It mirrors how good engineering teams actually work: someone proposes, someone pokes at it, the artifact improves through the tension.

```typescript
const adversarialReview = f()
  .input("spec", f.string("The generated specification"))
  .input("originalStory", f.string("The source user story"))
  .output("missingRequirements", f.array(f.string()))
  .output("implicitAssumptions", f.array(f.string()))
  .output("underspecifiedBehaviors", f.array(f.string()))
  .output("securityConsiderations", f.array(f.string()))
  .build();

const critic = ax(adversarialReview);
```

The generator and critic don't need to be the same model. They don't even need to optimize for the same thing. You're building a system with productive internal disagreement - agents that make each other better through structured conflict.

To me is interesting how this mirrors code review culture. The best teams I worked with had this dynamic naturally: propose, critique, improve. Now you can encode it.

## Real Talk: Where This Falls Apart

None of this replaces engineering judgment. The human still decides what to build and why. A perfectly structured spec for the wrong feature is still the wrong feature.

The tricky bit is optimization data. DSPy and Ax shine when you have examples of good output to optimize against. If you're generating specs for a greenfield domain with no historical examples, you're back to crafting prompts manually until you build up that corpus.

There's also the question of drift. Your spec generator learns patterns from your architecture. Architecture evolves. If you're not regularly validating output against current reality, the generator produces specs for a codebase that no longer exists.

Teams that do this well treat these pipelines like infrastructure: version-controlled, tested against known-good outputs, monitored for drift. When the spec generator starts producing garbage, you don't rewrite the prompt. You add failing examples and re-optimize.

## The Shift

We spent years accepting that the path from story to code was a black box inside someone's head. The experienced engineer who "just knows" what a user story really means. The tech lead who catches underspecified edge cases by instinct.

Now we can make it a pipeline - inspectable, improvable, honest about its limitations.

The specification problem didn't get easier. We just finally have tools that treat it like the engineering challenge it always was.

I've been building pipelines like this for internal tooling. Not ready to share specifics yet, but the approach works. The spec quality improved noticeably once we stopped treating LLMs as magic and started treating them as modules to optimize.
