---
title: "Eliminating DNS Single Points of Failure: Dual-Authoritative DNS Setup"
date: 2025-11-03
tags: [Cloud, Reliability]
excerpt: "The recent Azure DNS outage was a wake-up call. Here's how to build truly redundant DNS across AWS Route 53 and Azure DNS using octoDNS, so no single provider outage takes you down again."
---

Your multi-cloud setup worked perfectly. Your CDN failover kicked in. Your
monitoring showed green across both AWS and Azure. But users couldn't reach you
because Azure DNS was down.

This happened to many teams during the recent Azure DNS incident, and it was a
brutal reminder: DNS is the foundation everything else sits on. You can
architect the most resilient infrastructure in the world, but if your DNS
provider goes dark, you're offline.

To me is interesting that we spend so much effort on application redundancy—load
balancers, multi-region databases, CDN failover—but often leave DNS as a single
point of failure. After that Azure incident, I decided to fix this. Here's the
setup I built: dual-authoritative DNS across AWS Route 53 and Azure DNS,
synchronized through GitOps with octoDNS.

## The Problem: Multi-Cloud Isn't Enough

Running workloads on both AWS and Azure doesn't automatically make your DNS
redundant. You're probably doing one of these:

1. **All DNS on Route 53** - Fast, reliable, great integration with AWS
   services... until AWS has a bad day
2. **All DNS on Azure DNS** - Works beautifully with Azure Front Door... until
   that Azure incident happens
3. **Split by domain** - Some domains on Route 53, some on Azure DNS - still
   leaves individual domains vulnerable

The Azure DNS outage showed the problem clearly: even if your infrastructure
spans multiple clouds, a single DNS provider creates a bottleneck. When Azure
DNS resolution failed, it didn't matter that your Azure Front Door could fail
over to CloudFront. Users couldn't resolve your domain in the first place.

## The Solution: Dual-Authoritative DNS

Here's the core idea: run your DNS on **both** providers simultaneously, with
identical records. At the registrar level, delegate to nameservers from both
Route 53 and Azure DNS. When resolvers query your domain, they'll get NS records
pointing to both providers. If one provider fails, resolvers automatically try
the other.

The conceptual architecture looks like this:

```typescript
type DNSArchitecture = {
  delegation: "mixed-ns"; // Both providers at registrar
  sync: "octodns-gitops"; // Single source of truth
  steering: "edge-first"; // CDN handles most routing
  dns_policy: "simple-with-escape"; // Basic records + selective smart routing
};
```

This means:

- **RTO/RPO depends only on TTL** - When a provider fails, recovery is immediate
  (limited only by your TTL values, not provider recovery time)
- **Leverages existing multi-cloud** - You're already paying for both providers;
  now you're using them for redundancy
- **GitOps-native** - Single source of truth in git, automated sync to both
  providers
- **Simple by default** - DNS stays straightforward; CDN handles complex routing

## Implementation: Phase 1 - The Foundation

Goal: Eliminate DNS SPOF without changing routing behavior.

### Zone Configuration

Create your zone file as code. This is your single source of truth:

```yaml
# dns-config/zones/example.com.yaml
---
$ORIGIN: example.com.
$TTL: 300 # 5min for non-critical records

# Apex - keep simple
@:
  - type: A
    values: [203.0.113.10, 203.0.113.11] # CDN anycast IPs
  - type: AAAA
    values: [2001:db8::1, 2001:db8::2]

# App endpoints - CNAME to CDN
app:
  - type: CNAME
    value: app.cloudfront.net.

api:
  - type: CNAME
    value: api-fd.azurefd.net.

# Email/MX - stable, high TTL
@:
  - type: MX
    ttl: 3600
    values:
      - priority: 10
        value: mail.example.com.
```

Notice the TTL strategy here: application endpoints get 5-minute TTLs (fast
failover), while stable infrastructure like MX records get 1-hour TTLs (reduced
resolver load).

### octoDNS Configuration

octoDNS is built for exactly this pattern - synchronizing DNS records across
multiple providers from a single config:

```yaml
# config/production.yaml
providers:
  route53:
    class: octodns_route53.Route53Provider
    access_key_id: env/AWS_ACCESS_KEY_ID
    secret_access_key: env/AWS_SECRET_ACCESS_KEY

  azure:
    class: octodns_azuredns.AzureProvider
    client_id: env/AZURE_CLIENT_ID
    key: env/AZURE_CLIENT_SECRET
    tenant_id: env/AZURE_TENANT_ID
    subscription_id: env/AZURE_SUBSCRIPTION_ID
    resource_group: dns-prod-rg

zones:
  example.com.:
    sources:
      - config
    targets:
      - route53
      - azure

manager:
  max_workers: 2
  update_pcent_threshold: 0.1 # Safety: reject >10% change
```

That `update_pcent_threshold` is critical—it prevents you from accidentally
pushing a bad change that wipes out more than 10% of your records to **both**
providers. Ask me how I know this is important.

### GitHub Actions: The Sync Pipeline

Here's the cool part: every DNS change goes through a pull request with a plan,
just like Terraform:

```yaml
# .github/workflows/dns-sync.yml
name: DNS Sync
on:
  push:
    branches: [main]
    paths: ["dns-config/**"]
  pull_request:
    paths: ["dns-config/**"]

jobs:
  dns-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup octoDNS
        run: pip install octodns octodns-route53 octodns-azure

      - name: Validate
        run: octodns-validate --config config/production.yaml

      - name: Plan (dry-run)
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
        run: |
          octodns-sync \
            --config-file config/production.yaml \
            --doit false \
            --debug

  dns-apply:
    if: github.ref == 'refs/heads/main'
    needs: dns-plan
    runs-on: ubuntu-latest
    environment: production # Manual approval gate
    steps:
      - uses: actions/checkout@v4
      - name: Setup octoDNS
        run: pip install octodns octodns-route53 octodns-azure

      - name: Apply
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
        run: |
          octodns-sync \
            --config-file config/production.yaml \
            --doit
```

Notice the `environment: production` on the apply job. This gives you a manual
approval gate in GitHub—no DNS changes hit production without human review.
During an incident, you can approve quickly, but you can't accidentally merge
and deploy at 2 AM while half-asleep.

## Implementation: Phase 2 - Drift Detection

Once your zones are synchronized, you need to **keep** them synchronized. Drift
happens—someone makes a manual change in the Azure portal, an API call bypasses
your GitOps flow, or a sync partially fails.

Add continuous verification:

```yaml
# .github/workflows/dns-drift.yml
name: DNS Drift Detection
on:
  schedule:
    - cron: "*/15 * * * *" # Every 15min

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for drift
        run: |
          octodns-sync \
            --config-file config/production.yaml \
            --doit false > drift-report.txt

          if grep -q "Update" drift-report.txt; then
            echo "❌ DNS drift detected!"
            cat drift-report.txt
            exit 1
          fi
```

This runs every 15 minutes and checks whether your actual DNS records match your
git config. If drift is detected, the job fails and alerts fire. You catch
divergence within 15 minutes instead of discovering it during the next DNS
change (or worse, during an incident).

## Implementation: Phase 3 - Selective Smart Routing (Optional)

Here's where many teams overcomplicate things. You probably **don't need**
DNS-level routing policies if your CDN already handles failover.

Add DNS-level routing only when:

- **Health-sensitive internal services** - CDN can't detect backend failures for
  internal APIs
- **Geographic compliance** - Data residency requirements force region-specific
  routing
- **Cost optimization** - Egress costs matter enough to warrant DNS-based
  traffic steering

For everything else, keep DNS simple and let your CDN do the work.

When you do need smart routing, configure it per-provider for critical services:

```yaml
# For critical services only
api-internal:
  # Route 53 side (for AWS-sourced queries)
  route53:
    type: A
    values: [10.0.1.10]
    health_check:
      type: HTTPS
      resource_path: /health
      failure_threshold: 3

  # Azure side (for Azure-sourced queries)
  azure:
    type: A
    values: [10.1.1.10]
    # Azure Traffic Manager profile via separate CNAME
```

But again: most services don't need this. Start simple.

## Operational Patterns That Matter

### Rollback Strategy

Emergency rollback is just a git revert:

```bash
# Emergency rollback via git revert
git revert HEAD
git push origin main  # Triggers sync to both providers
```

This rolls back changes on **both** providers atomically (well, as atomically as
DNS can be). Immutable git history means you always know what changed and can go
back.

### Change Safety

Beyond the `update_pcent_threshold`, add explicit confirmation for dangerous
record types:

```yaml
# config/production.yaml (add)
manager:
  max_workers: 2
  update_pcent_threshold: 0.1 # Reject >10% change

  # Require explicit confirmation for dangerous changes
  always_ask: true
  for: [MX, NS, SOA]
```

MX, NS, and SOA records are high-impact. Making them require explicit
confirmation prevents "oops" moments.

### TTL Strategy

This depends of your RTO requirements:

- **Volatile records** (feature flags, canary): `60s`
- **Application endpoints**: `300s` (5 minutes)
- **Infrastructure** (MX, TXT): `3600s` (1 hour)
- **Apex NS delegation**: `86400s` (24 hours)

Low TTL on application endpoints enables fast DNS-based failover. High TTL on
stable records reduces resolver load and API costs. During the Azure DNS
incident, teams with 5-minute TTLs on app endpoints could have recovered in 5
minutes by failing over to Route 53. Teams with 1-hour TTLs had to wait out the
resolver caches.

## Validation Before Going Live

Before you update NS records at your registrar, validate thoroughly:

```bash
# 1. Verify zones are synchronized
dig @ns-123.awsdns-12.com example.com
dig @ns1-01.azure-dns.com example.com
# Answers must be identical

# 2. Check all record types
dig A example.com @ns-123.awsdns-12.com
dig MX example.com @ns-123.awsdns-12.com
dig TXT example.com @ns-123.awsdns-12.com
# Repeat for Azure NS

# 3. Once registrar is updated, verify delegation
dig +short NS example.com
# Should show both Route 53 and Azure NS

# 4. Check global propagation
dig +trace example.com @8.8.8.8
dig +trace example.com @1.1.1.1

# 5. Test failover (carefully!)
# Temporarily remove one provider's NS from registrar
# Verify resolution still works
```

That last test is crucial. Simulate a provider failure **before** you depend on
this in production. Remove Azure NS records from your registrar, wait for TTL
expiry, and verify that queries still resolve via Route 53. Then reverse the
test.

## Real Talk: Tradeoffs

This setup shines in the exact scenario we started with: provider outages.
During the Azure DNS incident, this architecture would have meant 5 minutes of
degraded DNS resolution (as resolvers failed over to Route 53) instead of
complete unavailability. Your RTO becomes your TTL value, not Azure's incident
resolution time.

It also fits naturally if you're already multi-cloud with mature GitOps. The
operational overhead of "two DNS providers" is sunk cost—you're just
synchronizing what you already maintain separately.

But let's be honest about the complexity this adds:

**Operational overhead:**

- Credential management for both providers (rotate API keys, monitor
  permissions)
- Drift detection and alerting (what happens when sync fails?)
- Slightly more complex troubleshooting (which provider is authoritative for
  this query?)

**Risk of synchronized failure:**

- Bad change pushed to both providers simultaneously (mitigated by PR review +
  manual approval + threshold checks)
- octoDNS credentials compromised (mitigated by CI secrets + audit logs)
- Human error in zone file (mitigated by immutable git history + rollback via
  revert)

**What I would NOT do:**

❌ **Mirrored provider-specific policies** - You already have CDN-layer routing.
Maintaining parallel Route 53 policies + Azure Traffic Manager profiles is
operational overhead that doesn't buy you much. Exception: Add DNS-level routing
only for services where CDN can't handle failover.

❌ **Complex SOA tuning** - Modern anycast DNS is resilient by design. Default
SOA values (refresh: 7200, retry: 900, expire: 1209600) are fine.
Over-optimization here is premature.

❌ **DNSSEC initially** - Adds complexity to the sync process and key rotation.
Add later once dual-authoritative pattern is stable.

The honest assessment: this adds operational overhead, but it's worth it if DNS
availability matters to your business. For hobby projects or internal tools,
stick with a single provider. For customer-facing production services, this
eliminates a major SPOF.

## Timeline and Next Steps

Here's the realistic timeline:

- **Week 1**: Dual-authoritative foundation + basic sync (Phase 1)
- **Week 2**: Drift detection + runbook testing (Phase 2)
- **Week 3+**: Evaluate need for provider-specific policies (Phase 3, optional)

I implemented this over two weeks after the Azure DNS incident. The first week
was setting up octoDNS, migrating zone configs to YAML, and testing the sync
pipeline in a staging domain. The second week was drift detection, validation
testing, and updating NS records at the registrar for production domains.

The pattern is well-understood, the tooling (octoDNS) is mature, and if you
already have GitOps foundations, this fits naturally into your workflow. Next
time Azure DNS goes down (or Route 53, or any DNS provider), you won't even
notice.

I wish I had done this before the incident. But as they say, the second-best
time to plant a tree is today. Your DNS is too critical to depend on a single
provider.

Now if you'll excuse me, I have esspresso to make and some TTL values to tune.
