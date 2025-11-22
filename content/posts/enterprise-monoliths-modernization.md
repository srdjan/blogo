---
title: Migrating Enterprise Monoliths Without Breaking Everything
date: 2025-01-15
tags: [Architecture, Microservices, Migration, Enterprise]
excerpt: A practical guide to modernizing legacy monoliths using strangler fig, event sourcing, and data synchronization patterns that actually work in production.
---

Here's something nobody tells you about enterprise modernization: the hardest part isn't picking the right architecture—it's migrating there while keeping the lights on. I worked on a few of these migrations in the past, and to me is interesting that the technical patterns matter less than how you sequence them.

No, we can't just flip a switch. That system processing millions of transactions? It's staying online while you rebuild around it. This means running dual systems, synchronizing data across boundaries, and having rollback plans for every step. Fun times.

Let me walk through the patterns that, in my experience, actually work.

## Strategic Migration: The Strangler Fig Approach

The fundamental pattern is simple: gradually replace legacy components by intercepting requests at the network boundary. New functionality lives in modern services, old stuff stays in the monolith. Traffic routing shifts incrementally—5%, 20%, 50%—until eventually the legacy code can be retired.

This works beautifully when you can draw clear boundaries at API level. User facing features? Perfect candidates. Deeply tangled business logic spread across the monolith? That's where things get hairy.

### Branch by Abstraction

Here's my favorite approach for internal migrations: create abstraction layers over legacy implementations, then build modern replacements behind identical interfaces. The switch happens atomically through feature flags.

```typescript
// Abstraction layer
interface PaymentProcessor {
  process(order: Order): Promise<PaymentResult>;
}

// Legacy implementation
class LegacyPaymentProcessor implements PaymentProcessor {
  async process(order: Order): Promise<PaymentResult> {
    // Calls into monolith via SOAP or whatever
  }
}

// Modern implementation
class ModernPaymentProcessor implements PaymentProcessor {
  async process(order: Order): Promise<PaymentResult> {
    // New microservice with proper domain model
  }
}

// Feature-flagged switch
const processor = featureFlags.useModernPayments
  ? new ModernPaymentProcessor()
  : new LegacyPaymentProcessor();
```

This pattern shines when you control both consumer and provider. The cutover risk drops to almost zero—if the modern service fails, you flip the flag back in seconds.

### Anti-Corruption Layers

And, now look at this: one of rare examples where the pattern name perfectly describes what it does. You establish explicit translation boundaries between legacy and modern domains to prevent legacy concepts from polluting your new architecture.

```typescript
// Anti-corruption layer translating legacy to modern domain
class OrderTranslator {
  toDomain(legacyOrder: LegacyOrderDTO): Order {
    // Map legacy field names, denormalize nested structures,
    // translate status codes to domain enums
    return new Order({
      id: OrderId.from(legacyOrder.ORDER_ID),
      customer: CustomerId.from(legacyOrder.CUST_NO),
      status: this.translateStatus(legacyOrder.STATUS_CD),
      items: legacyOrder.LINE_ITEMS.map(i => this.toOrderLine(i))
    });
  }

  toLegacy(order: Order): LegacyOrderDTO {
    // Reverse translation for writes back to legacy system
  }
}
```

This keeps your modern services clean. The legacy system can stay as messy as it wants, the translation happens at the boundary.

## Data Migration: The Tricky Part

Data synchronization depends of several factors, but the core challenge is the same: keeping legacy and modern systems consistent during the transition. Here's what works.

### Transactional Outbox Pattern

This is the cornerstone of reliable event-driven migration. Instead of publishing events directly, you write them to an outbox table within the same database transaction as your business operation:

```typescript
async function placeOrder(order: Order): Promise<void> {
  await db.transaction(async (tx) => {
    // Business operation
    await tx.insert('orders', order);

    // Event to outbox - same transaction!
    await tx.insert('outbox', {
      aggregateId: order.id,
      eventType: 'OrderPlaced',
      payload: JSON.stringify(order),
      timestamp: Date.now()
    });
  });
}

// Separate process polls outbox and publishes
async function publishOutboxEvents() {
  const events = await db.select('outbox')
    .where('published', false)
    .orderBy('timestamp');

  for (const event of events) {
    await messageQueue.publish(event);
    await db.update('outbox')
      .set({ published: true })
      .where('id', event.id);
  }
}
```

This solves the dual-write problem elegantly. Your database and message queue stay consistent—guaranteed. During migration, both legacy and modern systems consume these events at their own pace. The outbox maintains ordering per aggregate, which is crucial when you have parallel systems.

### Change Data Capture

CDC is surprisingly powerful for migrations. You stream database changes from legacy systems to modern services in near real-time without touching legacy code:

```typescript
// CDC stream consumer
kafkaConsumer.on('message', async (msg) => {
  const change = JSON.parse(msg.value);

  if (change.table === 'orders' && change.operation === 'INSERT') {
    // Build read model in modern system
    const order = translator.toDomain(change.after);
    await modernOrderRepository.save(order);
  }
});
```

This works beautifully for read models. You can migrate read traffic to modern services without touching the legacy write path. Then, once reads are stable, you tackle writes.

The tricky bit is handling schema changes in legacy database while CDC is running. You need version detection and translation logic that handles multiple schema versions.

### CQRS During Migration

Separate read and write models to enable independent migration paths. Writes continue through legacy systems while read models get built in modern infrastructure:

```typescript
// Write still goes to legacy
async function updateInventory(sku: string, quantity: number) {
  await legacySystem.updateStock(sku, quantity);
  // Legacy publishes event via outbox
}

// Reads come from modern read model
async function getInventory(sku: string): Promise<InventoryView> {
  return await modernReadModel.getInventory(sku);
  // Built from CDC stream or event subscriptions
}
```

This pattern lets you optimize each path independently. Read models can be denormalized for query performance. Write models stay normalized in legacy system. Different consistency guarantees for different use cases.

## Domain Decomposition

The hardest question isn't "how do we migrate?" but "what are the boundaries?" Legacy monoliths obscure true domain boundaries under years of coupled code.

### Capability-Based Decomposition

Extract business capabilities rather than following entity boundaries. Capabilities represent what the business does, not how data is structured. This naturally aligns with microservice boundaries:

- **Capability**: Order Processing (not Order entity)
- **Capability**: Inventory Management (not Product entity)
- **Capability**: Customer Identity (not User entity)

Each capability becomes a bounded context with its own data model. The Order Processing service might have its own view of Customer—just enough to process orders. It doesn't need the full customer profile.

### Finding True Aggregates

Identify aggregate boundaries by looking at transactional consistency requirements. What needs to change together atomically? That's your aggregate root.

In legacy systems, this is often obscured by database-level transactions spanning multiple entities. The migration forces you to rediscover true invariants. Sometimes this means realizing that what you thought was one aggregate is actually three.

## Migration Execution

Here's where theory meets reality. You need concrete rollout strategies, not just architectural diagrams.

### Parallel Run Validation

Run legacy and modern systems simultaneously, comparing outputs:

```typescript
async function processPayment(order: Order): Promise<PaymentResult> {
  // Run both systems
  const [legacyResult, modernResult] = await Promise.all([
    legacySystem.processPayment(order),
    modernSystem.processPayment(order)
  ]);

  // Compare results
  if (!resultsMatch(legacyResult, modernResult)) {
    await logDiscrepancy({
      order,
      legacyResult,
      modernResult,
      timestamp: Date.now()
    });
  }

  // Still return legacy result (not cutover yet)
  return legacyResult;
}
```

You need comparison frameworks that account for acceptable differences while detecting true discrepancies. Statistical analysis determines confidence before cutover. This means you're processing everything twice for a while—plan for the infrastructure cost.

### Progressive Rollout

Start with shadow traffic (compare but don't use results), progress to canary deployments (5% real traffic), then gradual rollout:

```typescript
const rolloutPercentage = await featureFlags.get('payment-service-rollout');

if (Math.random() * 100 < rolloutPercentage) {
  return await modernSystem.processPayment(order);
} else {
  return await legacySystem.processPayment(order);
}
```

Each stage validates performance, correctness, operational characteristics. You monitor error rates, latency percentiles, business metrics. Any degradation? Roll back instantly.

### Circuit Breakers at Migration Boundaries

Protect migration boundaries with circuit breakers that fall back to legacy when modern services fail:

```typescript
const breaker = new CircuitBreaker(modernSystem.processPayment, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.fallback(() => legacySystem.processPayment(order));

const result = await breaker.fire(order);
```

This gives you confidence to push forward. Modern service acting up? The breaker trips, traffic routes to legacy, pager goes off, but customers keep working.

## Real Talk: What Actually Works

After three of these migrations, here's what I learned:

**Start with read-only services**. Migrating reads is low-risk. Build confidence with query patterns before touching writes.

**Data synchronization is harder than you think**. Budget 2x the time you estimated for getting dual-write working correctly. The edge cases will surprise you.

**Organizational buy-in matters more than technical excellence**. The best migration plan fails if teams aren't aligned. Conway's Law is real—organize teams around target architecture, not legacy boundaries.

**Not everything needs to migrate**. That stable, low-change service running on legacy infrastructure? Maybe leave it alone. Rewrites have cost too.

**Observability from day one**. Distributed tracing across legacy and modern systems. Correlation IDs everywhere. Unified dashboards showing migration progress. You can't manage what you can't measure.

**Plan rollbacks for everything**. Every migration step needs explicit rollback procedures. Database migrations must be reversible or forward-compatible across versions. This is non-negotiable.

## The Long Game

These migrations take years, not months. The technical patterns—strangler fig, outbox, CDC, CQRS—they work. But success depends of incremental value delivery. Each phase needs to deliver measurable business value, not just technical improvement. This keeps stakeholders supportive and funding flowing.

The goal isn't perfection. It's continuous improvement while keeping the business running. Sometimes the messy, incremental path is the only path.

I'm currently working on migration strategy for a financial services platform—10+ years of legacy code, millions of daily transactions. We're using most of these patterns in combination. Event sourcing for audit trails, CQRS for query optimization, strangler fig for service extraction. It's fascinating how these patterns compose.

If you're dealing with similar challenges, I'd love to hear how you're approaching it. What patterns work in your domain? What failed spectacularly? The best lessons come from production scars.
