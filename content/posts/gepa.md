---
title: "This LLM Agent Has a Temperature Problem"
date: 2026-02-22
tags: [AI, Agentic Workflows, Optimization, TypeScript]
excerpt: LLM agent systems ship with hardcoded configs chosen by vibes. GEPA closes the loop - agents generate traces, traces get evaluated, and the next run uses what actually worked.
---
Sunday morning, threat of snow storm, cortado and another weekend learning project, a usual weekend "sports" activity for me and my friends Clody and Gipity. :)

The project is called [LosLess](https://github.com/srdjan/losless), and I caught myself staring at this line of code:

```typescript
chatConfig: { temperature: 0.2 },
```

Temperature 0.2. Why 0.2? I had no answer. It wasn't benchmarked. It wasn't derived from some ablation study. It was a number I'd seen in a blog post once, it felt reasonable, and it stuck. The step budgets were the same story: `maxSteps: 80`, `maxLlmCalls: 60`, pulled from environment variables nobody had validated since the day they were set.

The thing is, this system already knew how it was performing. Every run produced rich traces: pass/fail outcomes, latency breakdowns per phase, issue counts from both deterministic validation and semantic judging, retry counts. The data was sitting in JSON files on disk, complete and structured. And none of it flowed back into the configuration that shaped the next run.

This is the state of most LLM agent systems right now. We build sophisticated multi-step pipelines, instrument them carefully, log everything, and then configure them by intuition. The feedback loop is open. The traces go to disk and stay there.

## What If Your Agent Could Read Its Own Report Card?

Think about a restaurant that logs every order, tracks every plate that gets sent back to the kitchen, measures throughput per shift, records wait times per table. Detailed operational data, updated every night. And the chef never looks at any of it. The menu doesn't change. The prep schedule stays the same. The data exists, but it doesn't inform decisions.

That's what most agent systems do. They generate performance data as a side effect of running, and then the next run starts with the exact same configuration as the last one.

The first step toward fixing this is deciding what "performance" means. For this system, I settled on four metrics:

```typescript
type SessionMetrics = {
  sessionId: string;
  passRate: number;
  avgLatencyMs: number;
  totalIters: number;
  issueDensity: number;
  retries: number;
};
```

`passRate`: fraction of iterations where the output passed both hard validation and semantic judging. `avgLatencyMs`: mean wall-clock time across doc reading, reasoning, and judging phases. `issueDensity`: total issues (deterministic plus semantic) divided by iteration count, a quality signal independent of pass/fail. `retries`: how many times the loop had to go around before producing acceptable output.

These aren't arbitrary. Each captures a different dimension of "good." A config that passes every time but takes 40 seconds per iteration isn't necessarily better than one that occasionally retries but averages 12 seconds. That tension between dimensions is exactly what makes optimization interesting.

## GEPA: The Closed Loop

GEPA stands for Generalized Evolutionary Prompt Architecture. The name is fancier than the idea. The idea is: use the traces your agent already produces to evolve its configuration over time.

The cycle has four steps.

**Step 1: Run a session.** The agent processes a query against a document. Traces are written to disk with per-iteration metrics, phase timings, validation outcomes. If a GEPA variant is active, the traces are tagged with its ID. If no variant exists, they're untagged and become the baseline.

```bash
deno task demo -- --query "..." --doc docs/long.txt --out out
```

**Step 2: Optimize.** The evaluator reads all traces from the output directory, computes per-session metrics, groups them by variant ID, runs the Pareto front computation, and writes the winning variant to a config file.

```bash
deno task demo -- --optimize --out out
```

This produces stderr output that tells you what's happening:

```
[GEPA] Running optimization pipeline on traces in out...
[GEPA] Evaluated 3 sessions: avgPassRate=0.83, avgLatencyMs=14200, avgIssueDensity=1.40
[GEPA] Variant-segmented metrics: 2 variant(s) with real data.
[GEPA] Using real metrics for variant baseline-v0: passRate=0.83, latency=14200ms
[GEPA] No real data for variant baseline-v0-t0.15; using provisional projection.
[GEPA] Generated 4 candidates, 2 non-dominated on Pareto front.
[GEPA] Active variant set to: baseline-v0-t0.15
```

Notice the distinction: "Using real metrics" versus "provisional projection." Variants that have actually been run get evaluated on their real traces. Variants that are newly generated get heuristic projections until they accumulate real data. The system is honest about what it knows and what it's guessing.

**Step 3: Run again.** The next session automatically loads the active variant. Two lines in the entry point handle the entire integration:

```typescript
const activeVariant = await getActiveVariant(outDir);
if (activeVariant) {
  console.error(`[GEPA] Active variant: ${activeVariant.id}`);
} else {
  console.error(`[GEPA] No active variant; using defaults.`);
}
```

The variant flows into the agent factories, overriding the hardcoded defaults. New traces are tagged with this variant's ID.

**Step 4: Optimize again.** Now the system has real metrics for the variant that was only projected before. The projections get replaced with ground truth. The Pareto front is recomputed with actual data. Candidates evolve from the new best.

Each cycle makes the evaluation more grounded. Early runs are mostly projections. After a few cycles, the front is composed entirely of variants with real performance data.

## How Candidates Are Born

The mutation strategy is deliberately simple. Each optimization cycle generates four candidate variants from the current best:

```typescript
function generateCandidates(
  baseline: VariantConfig,
  count = 4,
): VariantConfig[] {
  const candidates: VariantConfig[] = [];
  const baseTemp = baseline.temperature ?? 0.2;
  const baseSteps = baseline.maxSteps ?? 80;
  const baseLlm = baseline.maxLlmCalls ?? 60;

  // Temperature variants
  for (const delta of [-0.05, 0.05]) {
    const temp = Math.max(0, Math.min(1, baseTemp + delta));
    if (temp !== baseTemp) {
      candidates.push({
        id: `${baseline.id}-t${temp.toFixed(2)}`,
        parentId: baseline.id,
        temperature: temp,
        maxSteps: baseSteps,
        maxLlmCalls: baseLlm,
        createdAt: now,
      });
    }
  }

  // Step budget variants
  for (const factor of [0.75, 1.5]) {
    const steps = Math.max(10, Math.round(baseSteps * factor));
    const llm = Math.max(5, Math.round(baseLlm * factor));
    candidates.push({
      id: `${baseline.id}-s${steps}`,
      parentId: baseline.id,
      temperature: baseTemp,
      maxSteps: steps,
      maxLlmCalls: Math.min(llm, steps - 1),
      createdAt: now,
    });
  }

  return candidates.slice(0, count);
}
```

Two temperature nudges: -0.05 and +0.05. Two step budget scalings: 0.75x and 1.5x. One parameter changes at a time. The rest stay fixed.

This is the A/B testing principle: isolate variables. If you changed temperature and step budget simultaneously and performance improved, you wouldn't know which change mattered. By mutating one dimension per candidate, the Pareto front tells you which dimension drove the improvement.

The `parentId` field tracks lineage. After several optimization cycles, you can trace a variant's ancestry back to the original baseline: `baseline-v0` became `baseline-v0-t0.15` became `baseline-v0-t0.15-s120`. Each step was selected because it was non-dominated.

The `promptVariant` field exists in the type but isn't used yet. That's the next frontier: evolving not just numerical parameters but the actual instructions the agent receives.

## Pareto: When Better Means Different Things

Here's where most optimization approaches fall flat: they assume a single metric. "Maximize accuracy." "Minimize latency." But agent performance isn't one-dimensional.

Consider buying a laptop. You want it to be fast, light, and cheap. No laptop is best on all three axes. The fast, light one is expensive. The cheap, fast one is heavy. The set of options where you can't improve one dimension without sacrificing another: that's the Pareto front.

GEPA applies this to agent variants:

```typescript
function dominates(a: SessionMetrics, b: SessionMetrics): boolean {
  const betterOrEqual = a.passRate >= b.passRate &&
    a.avgLatencyMs <= b.avgLatencyMs &&
    a.issueDensity <= b.issueDensity &&
    a.retries <= b.retries;

  const strictlyBetter = a.passRate > b.passRate ||
    a.avgLatencyMs < b.avgLatencyMs ||
    a.issueDensity < b.issueDensity ||
    a.retries < b.retries;

  return betterOrEqual && strictlyBetter;
}
```

Variant A dominates variant B if A is at least as good on every metric and strictly better on at least one. Variants that nobody dominates form the Pareto front: the set of non-dominated configurations.

In plain terms: if there's a variant that passes more often, runs faster, has fewer issues, and retries less, then the dominated variant is strictly worse and gets discarded. But if one variant passes more often while another is faster, both survive on the front. Neither is objectively better; they represent different trade-offs.

The active variant selection is opinionated: pick the non-dominated variant with the highest pass rate. This is a reasonable default for a system where correctness matters more than speed. But the architecture exposes the full Pareto front in the JSON output, so a different selection policy is a one-line change.

## Traces as Ground Truth

This is the part that differentiates GEPA from traditional hyperparameter tuning. There's no synthetic benchmark. There's no curated eval dataset. The evaluation data is production data: real queries, real documents, real agent behavior.

The evaluator groups traces by variant ID:

```typescript
async function evaluateByVariant(
  outDir: string,
): Promise<Map<string, SessionMetrics>> {
  const sessionIds = await loadSessionIds(outDir);
  const variantTraces = new Map<string, TaskIterTrace[]>();

  for (const sessionId of sessionIds) {
    const rawTraces = await querySessionTraces(sessionId, outDir);
    const taskTraces = rawTraces.filter(isTaskTrace);

    for (const trace of taskTraces) {
      const vid = trace.variantId ?? "baseline";
      const existing = variantTraces.get(vid);
      if (existing) existing.push(trace);
      else variantTraces.set(vid, [trace]);
    }
  }

  const result = new Map<string, SessionMetrics>();
  for (const [vid, traces] of variantTraces) {
    if (traces.length > 0) {
      result.set(vid, computeSessionMetrics(vid, traces));
    }
  }
  return result;
}
```

The `?? "baseline"` fallback is doing important work. Any trace that predates GEPA, any session run before optimization was ever invoked, automatically becomes baseline data. Your history doesn't go to waste. The system retroactively treats your prior runs as the control group.

This means the first optimization cycle already has something to work with. You don't need to run special evaluation sessions. You don't need to curate a test suite. You just keep using the system normally, and the traces accumulate.

The trade-off is obvious: production queries aren't controlled. If your early sessions were on easy documents and your post-optimization sessions are on harder ones, the variant comparison is confounded. The system doesn't account for task difficulty. It compares raw numbers across potentially different workloads.

For now, that's acceptable. The alternative is building an eval harness, which is exactly the kind of separate infrastructure GEPA is designed to avoid.

## The Agent Factory Override

The variant reaches the agent through a null coalescing chain in the factory function:

```typescript
function makeWorkerAgent(variant?: VariantConfig): WorkerAgent {
  const budgets = resolveWorkerBudgets();

  const config: LcmAgentConfig = {
    name: "claudeWorker",
    maxSteps: variant?.maxSteps ?? budgets.maxSteps,
    maxOperatorCalls: variant?.maxLlmCalls ?? budgets.maxLlmCalls,
    chatConfig: { temperature: variant?.temperature ?? 0.2 },
    // ...
  };
  // ...
}
```

Three levels of precedence: GEPA variant override, environment variable (via `resolveWorkerBudgets()`), hardcoded default. If a variant is active, it wins. If not, the env var applies. If neither exists, the original `0.2` and `80` that I never validated are used.

The same pattern appears in `makeDocReaderAgent` for task mode. Both factories accept an optional `VariantConfig`, and the rest of the system doesn't need to know whether it's running a baseline or an evolved configuration. The variant is injected at construction time, and the agent loop is identical regardless.

This is the part I like most about the design. The entire GEPA integration is two files of evaluation logic, one file of optimization logic, a config store, and two lines in the entry point. The agent code itself didn't change at all. The factories already accepted optional overrides. GEPA just provides a mechanism for computing what those overrides should be.

## Real Talk: Where This Falls Apart

Time to be honest about the gaps.

**Small sample sizes.** If you've run three sessions, your metrics have wide confidence intervals. The Pareto front computed from three data points isn't statistically robust. GEPA doesn't compute confidence intervals or significance tests. It compares point estimates. With enough sessions this is fine. With few sessions, you could select a variant that was lucky rather than genuinely better.

**Narrow mutation space.** Four candidates per cycle, each differing in one parameter. Temperature moves by 0.05. Step budgets scale by 0.75x or 1.5x. This is conservative by design, but it means the search space is explored slowly. If the optimal temperature is 0.7 and you start at 0.2, it takes ten optimization cycles just to get there. And the prompt itself doesn't change at all yet.

**No automatic rollback.** If the selected variant performs worse than the baseline in subsequent runs, the system doesn't detect this or revert. It will eventually be dominated by a better variant in a future optimization cycle, but there's no circuit breaker that says "this variant is clearly worse, go back to what was working."

**Projection quality.** When a variant has no real data, its metrics are projected by applying heuristic multipliers: lower temperature gets +5% pass rate, higher step budgets get +10% pass rate but +30% latency. These numbers were not themselves optimized. The projections are the weakest link in the system, and they're the thing that determines which variant gets run next. Bad projections mean you waste sessions on variants that were never going to be competitive.

**Model updates invalidate traces.** All traces assume a specific model version. When Anthropic updates the model behind the Claude API, past traces may no longer reflect how the system would behave today. A variant optimized for claude-sonnet-4-20250514 might perform differently on whatever comes next. GEPA doesn't track model versions, so it can't detect or account for this.

## Closing the Loop

The core insight isn't that evolutionary optimization works for LLM configs. It's that agent systems already produce the evaluation data they need. Every trace file sitting in your output directory is an observation about how a specific configuration performed on a specific task. The data was always there. We just weren't reading it.

GEPA is roughly 500 lines of TypeScript across three files. No separate eval infrastructure. No curated benchmarks. No training runs. It reads traces that already exist, computes metrics that are already defined in the types, and writes a config file that the existing factory pattern already supports.

The immediate next step, in this experiment, will be to expand the variant config to include the `promptVariant` field: evolving not just numerical parameters but the system prompt itself. Instead of "temperature 0.15 works better than 0.2," the system could discover that "keep evidence quotes under 120 characters" works better than "keep evidence quotes under 160 characters." Prompt mutations are harder to generate and harder to evaluate, but the infrastructure for doing it is already in place.

But, that will have to wait for the next weekend.


