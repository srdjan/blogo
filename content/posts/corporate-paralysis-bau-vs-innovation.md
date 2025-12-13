---
title: "Why (some) Big Companies Can't Ship New Things"
date: 2024-08-15
tags: [Architecture, Enterprise, Product, Agile]
excerpt: Large companies claim they want innovation while their structure guarantees it will fail. Here's why the BAU vs. innovation split creates an immune system that rejects change.
---

There's this corporate saying about being able to "walk and chew gum at the same
time." Sounds simple, right? For most big companies, it's practically
impossible. Not because people are incompetent — they're often brilliant. The
problem is fundamental, built into how the organization splits work between
"business as usual" and "strategic initiatives."

## The Two Worlds

Picture your typical large tech company. On one side, you have the BAU teams—the
people keeping the lights on. They maintain the monolith(s), serve customers,
hit quarterly numbers. Their metrics are clear: uptime, response time, tickets
closed, incidents resolved. They work in sprints, follow processes, and optimize
for stability.

These teams are measured on efficiency and risk mitigation. When you're
responsible for the system that generates revenue right now, you don't take
chances. Your job depends of not breaking things.

Then the company realises that it needs to "innovate." Here comes Digital
transformation. New market entry. AI integration. Whatever the latest strategic
priority is. Now, we come to the first critical point:

1. some companies attempt to innovate within the existing structure. They add
   "digital transformation" to the BAU team's backlog. They ask the same people
   to build new things while keeping the old ones running.

2. The other option is to create a dedicated team(s) for the new work. This
   creates a different universe. New team(s) are created. They talk about MVPs,
   agility, disruption. They want to experiment, move fast, try new tech stacks.
   They need resources—engineers, budget, time.

Here's where it gets interesting. First, option (1) will fail, the only question
is how badly. Option (2) will also fail, but in a different way.

This failure mode is harder to spot than innovation theater because everyone
looks busy. But you're running a race in two different directions
simultaneously. You go nowhere fast.

You end up with two failure modes:

**Over-separation:** Dedicated teams that can't cooperate

- BAU can't execute flawlessly because they're constantly interrupted for
  "strategic alignment"
- Innovation can't move fast because they're stuck in BAU processes
- Neither team trusts the other
- Both feel under-resourced

**No separation:** Same team doing everything

- BAU suffers because attention is split between maintenance and transformation
- Innovation crawls because it's always deprioritized for production fires
- Engineers burn out from context switching and impossible expectations
- Technical debt compounds because there's never time to pay it down

## The Immune System Response

The BAU team sees this new initiative not as opportunity, but as threat. And
they're not wrong to think this way. The new project demands their best
engineers for "innovation sprints." It distracts from their metrics. It
introduces volatility into finely-tuned systems.

The BAU manager's incentives are crystal clear: keep the ship sailing smoothly.
Not: help build a new, untested vessel that might never launch.

So what happens? The innovation team finds themselves begging for resources from
managers who have zero stake in their success. They face approval processes
designed for stable operations, not rapid experimentation. They need a server
provisioned—that's a three-week process with five approval gates. They want to
try a new database—security review takes two months.

This is what I call "innovation theater." Big launch announcement, executive
sponsorship, fancy slide decks. Six months later, the project is stuck in
committees, starved of resources, quietly shelved.

The organization's immune system rejected the foreign body.

## The Structural Problem

To me is interesting that the problem isn't separation itself—it's the missing
bridges. Leadership champions the new thing without recalibrating goals for the
BAU teams. The budgeting process still favors known, short-term needs over
speculative bets.

But here's the flip side that's equally destructive: some companies never
separate at all. They can't or won't create dedicated innovation teams, so they
just pile "digital transformation" on top of the BAU workload.

## So... What Actually Works?

The rare companies that figure this out don't abandon specialization. They build
explicit bridges.

**Protected pathways:** Strategic initiatives get dedicated funding that doesn't
compete with BAU budgets. Not "we'll find money somewhere," but actual line
items with executive ownership.

**Cross-functional integration:** Instead of pure separation, create teams that
blend BAU expertise with innovation mandate. The infrastructure team that
maintains the platform also owns the next-gen architecture exploration. They
have skin in both games.

**Aligned incentives:** This is the tricky bit. BAU teams need clear, measurable
rewards for enabling innovation. Not vague "company success" metrics, but
specific bonuses tied to strategic initiative outcomes. Make supporting the
future as valuable as maintaining the present.

**Process bifurcation:** Different work needs different processes. Let
innovation teams move fast with appropriate guardrails, while BAU keeps their
stability-focused approach. Don't force everyone through the same approval
pipeline.

---

The hard truth: most "strategic initiatives" probably shouldn't exist. Companies
launch them because everyone else is doing AI or blockchain or whatever, not
because they have a real problem to solve. In those cases, the immune system
rejection is actually working correctly.

But when you have genuine need for innovation or/and technical debt that's
crushing you, architecture that won't account for the BAU vs. innovation split
is lethal. The organization can do each task perfectly in isolation. Asked to do
both? Paralysis.

After years of trying, companies eventually gave up and hired consultants to
build a parallel system. Twice the cost, twice the complexity, years of delay.

## The Systems Perspective

Here's what I learned after watching this pattern repeat: you can't fix it with
process documents or motivational speeches. You need to change the actual
incentive structure and resource allocation at a core level.

Companies that figure this out treat innovation teams like internal startups
with proper isolation boundaries, clear resource commitments, and executives who
understand they're playing a different game. Not "move fast and break things"
chaos, but explicit acknowledgment that optimizing for exploration requires
different rules than optimizing for exploitation.

Most companies never get there. I was lucky to be part of two that did. They
both went full out, and created a new, fully owned, commercial entity. Created a
boundary and the contract with BAU and allowed time to evolve...

But also I have experienced the other side. They stay stuck in the uncomfortable
middle—not stable enough to execute BAU cleanly, not flexible enough to innovate
effectively. Walking is hard, chewing gum is hard, doing both means stumbling
around looking confused.
