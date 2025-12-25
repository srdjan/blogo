---
title: HTTP 402 Wakes Up After 30 Years
date: 20245-12-14
tags: [Payments, APIs, AI Agents, Protocols]
excerpt: The "Payment Required" status code sat dormant since 1995, waiting for the right payment rails. Stablecoins and autonomous agents finally made it practical.
---

HTTP status code 402 has been "reserved for future use" since 1995.

Back in 2012 when I was preparing a talk for the [Asbury Agile Conference](https://vimeo.com/57902054), ([Deck](https://www.slideshare.net/slideshow/modern-webapp-v2b/14691978])) I wanted to include a slide on HTTP 402, as a joke, next to 418 "I'm a teapot."

I chickened out at the last minute. :)

Thirty years sitting in the spec, waiting for the internet to figure out how money should move. We built ad networks, subscription walls, API keys tied to billing systems, Stripe integrations, elaborate invoicing workflows - all because the web never had a native answer to "this costs something." Specially, when that something was a very small amount.

The [x402 protocol](https://github.com/coinbase/x402) is that answer finally arriving.

## How It Works

At its simplest: server returns `402 Payment Required`, client pays, request completes. No billing integration. No API key provisioning. No invoicing reconciliation. Value moves alongside the HTTP request that triggered it.

Since launching in May 2025, x402 processed over 100 million payments. Not theoretical or testnet. Production traffic across APIs, applications, and - here's the part worth paying attention to - autonomous AI agents buying compute and data on demand (! be warned).

## x402 V2 is here: Built for Agents

This week's V2 release makes the trajectory clearer.

The headline features matter for anyone building paid APIs: dynamic payment routing so marketplaces can split payouts per request. A plugin architecture that lets you add new chains or payment schemes without touching core protocol code.

But the feature that signals where this is actually headed: **wallet-based identity** with reusable sessions.

An agent paying for an API call doesn't want, or need, to execute an on-chain transaction every single time. V2 introduces the foundation for proving wallet control once, then accessing resources repeatedly - subscription like patterns without the subscription infrastructure. Lower latency, fewer round-trips, viable economics for high-frequency workloads like LLM inference or multi-step agent orchestration. But also, anything else you can imagine.

## New Age Commerce

HTTP 402 sat dormant because the payment rails weren't ready. Credit cards don't work for micropayments. Bank transfers don't settle in seconds. Neither works when both parties are software.

Stablecoins and programmable money changed that equation. x402 is the protocol layer that makes it practical.

Thirty years is a long nap. But sometimes being early just means waiting for the rest of the stack to catch up. The internet is finally getting a native payment layer. The agents are already using it. Strange things will happen.
