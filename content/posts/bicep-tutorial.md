---
title: "Type-Safe Infrastructure with Bicep"
date: 2025-10-06
tags: [Azure, Bicep, IaaC, DevOps]
excerpt: "Bicep's type system brings compile-time safety to infrastructure code. Here's how discriminated unions, user-defined types, and helper functions turn error-prone YAML wrangling into predictable, maintainable infrastructure engineering."
---

Infrastructure as Code moved us from clicking through Azure Portal to automated, repeatable deployments. Good progress. But here's what caught my attention: Bicep's type system can catch configuration errors *before* deployment, the same way TypeScript catches bugs before runtime.

At work we use Azure and Bicep heavily. Catching a missing required parameter in your editor beats discovering it 10 minutes into a failed deployment. This got me thinking - what if infrastructure code could be as type-safe as application code? Turns out, with modern Bicep (0.30+), it absolutely can be.

> **Reference Implementation**: All patterns and practices described in this guide are implemented in the [bicep-typed-starter](https://github.com/srdjan/bicep-typed-starter) repository. The repo provides a complete, production-ready template with typed modules, helper functions, and deployment examples that you can use as a starting point for your own infrastructure projects.

## Types as Infrastructure Contracts

Here's the core idea: infrastructure code defines contracts between components. What resources exist, how they connect, which configurations are valid. Traditional IaC leaves these contracts implicit - buried in comments or wikis that drift from reality. Bicep's type system makes them explicit and compiler-verified.

Think about deployment failures you've seen. Configuration mismatches, invalid property combinations, missing required parameters. These all share a root cause: the language allowed you to express invalid states. When type systems make illegal states unrepresentable, validation happens in your editor instead of during deployment.

The benefits compound surprisingly fast. Faster feedback during development. Clearer interfaces between modules. Infrastructure that documents itself through types. Less time fixing broken deployments, more time building features.

This guide covers three areas: Bicep's type system foundations, building typed modules with discriminated unions, and composing everything into complete deployments. Let's start with the basics.

## Bicep's Type System Foundation

Modern Bicep (0.30+) includes user-defined types as an experimental feature. These unlock serious type safety: `@export/@import` for sharing types across files, discriminated unions for polymorphic configs, and parameter validation decorators. All the good stuff.

### Enabling Type Features

Type safety starts with configuration. Create a `bicepconfig.json` file:

```json
{
  "experimentalFeaturesEnabled": {
    "userDefinedTypes": true,
    "imports": true
  }
}
```

These settings unlock everything: user-defined types, imports/exports, function definitions. The building blocks of type-safe infrastructure.

### Creating a Type Library

Organize types in a central library (`types/common.bicep`) instead of duplicating them across modules. Single source of truth makes refactoring painless.

```bicep
// types/common.bicep
@export()
@description('Environment identifier')
type Env = 'dev' | 'test' | 'prod'

@export()
@description('Azure region for resource deployment')
type Region = 'eastus' | 'westeurope' | 'westus'

@export()
@description('Application tier selection')
type AppTier = 'basic' | 'standard' | 'premium'
```

The `@export()` decorator makes types importable. Literal unions (`'dev' | 'test' | 'prod'`) create enumerations - you get autocomplete and can't use invalid values. Simple, effective.

### Type Imports in Modules

Modules import only what they need. Explicit dependencies, no surprises:

```bicep
// modules/app/appservice.bicep
import {
  Env
  Region
  AppTier
  AppConfig
} from '../../types/common.bicep'

param config AppConfig
```

This creates clear contracts between modules and eliminates type drift. Love it.

## Discriminated Unions: The Cool Part

Here's where it gets interesting. Different deployment scenarios need different parameters. Public-facing apps need DNS labels. Private apps need VNet IDs. App Gateway integration needs listener names.

Discriminated unions solve this beautifully. The type system enforces that each variant provides exactly what it needs - no more, no less.

### The Problem: Polymorphic Configuration

Application ingress shows the challenge clearly. Apps connect to networks through different mechanisms:

- Public IP access requires DNS labels and SKU selection
- Private endpoint access requires VNet IDs and subnet names
- Application Gateway integration requires gateway IDs and listener names

Traditional approach? Optional parameters everywhere, validated at runtime:

```bicep
// Traditional approach - error-prone
param ingressType string
param dnsLabel string?        // Only for publicIp
param vnetId string?          // Only for privateLink
param subnetName string?      // Only for privateLink
param appGatewayId string?    // Only for appGateway
```

This allows invalid combinations. `ingressType='publicIp'` with `vnetId` but no `dnsLabel`? Sure, why not. You'll find out during deployment. 10 minutes later.

### The Solution: Discriminated Unions

Discriminated unions encode each valid configuration as an explicit type variant:

```bicep
@export()
@description('Discriminated union for ingress configuration options')
@discriminator('kind')
type Ingress =
  | { kind: 'publicIp', sku: 'Basic' | 'Standard', dnsLabel: string? }
  | { kind: 'privateLink', vnetId: string, subnetName: string }
  | { kind: 'appGateway', appGatewayId: string, listenerName: string }
```

Look at this. The `@discriminator('kind')` decorator marks `kind` as the distinguishing field. Each variant defines its own properties. Invalid combinations? Unrepresentable. The compiler simply won't let you express them.

### Using It in Modules

Pattern-match on the discriminator:

```bicep
param ingress Ingress

// Pattern matching on discriminator
var publicNetworkAccess = ingress.kind == 'privateLink' ? 'Disabled' : 'Enabled'

// Conditional resource deployment based on variant
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = if (ingress.kind == 'privateLink') {
  name: '${appName}-pe'
  properties: {
    subnet: {
      id: '${ingress.vnetId}/subnets/${ingress.subnetName}'
    }
    privateLinkServiceConnections: [...]
  }
}
```

Type safety ensures you can only access `ingress.vnetId` and `ingress.subnetName` when `ingress.kind == 'privateLink'`. Try accessing them in the wrong context? Compiler error. This is beautiful.

## Structural Types: Building Complex Configs

Beyond unions, structural types compose complex configurations from simpler pieces.

### Nested Composition

Here's a complete application configuration:

```bicep
@export()
@description('Diagnostic settings configuration')
type Diagnostics = {
  workspaceId: string?
  @minValue(1)
  @maxValue(365)
  retentionDays: int?
}

@export()
@description('Auto-scaling configuration for App Service Plans')
type AutoScaleSettings = {
  @minValue(1)
  @maxValue(30)
  minCapacity: int
  @minValue(1)
  @maxValue(30)
  maxCapacity: int
  @minValue(1)
  @maxValue(30)
  defaultCapacity: int
  @minValue(1)
  @maxValue(100)
  scaleOutCpuThreshold: int?
  @minValue(1)
  @maxValue(100)
  scaleInCpuThreshold: int?
}

@export()
@description('Application Service configuration')
type AppConfig = {
  @minLength(3)
  @maxLength(60)
  name: string
  location: Region
  tier: AppTier
  @minValue(1)
  @maxValue(30)
  capacity: int?
  ingress: Ingress
  diagnostics: Diagnostics?
  autoScale: AutoScaleSettings?
  enableDeleteLock: bool?
}
```

`AppConfig` composes multiple levels: primitives (`name`, `location`), enumerations (`tier`), discriminated unions (`ingress`), nested structures (`diagnostics`, `autoScale`). Each level adds validation. Parameter decorators enforce constraints. Optional properties (`?`) handle nullables.

### Parameter Validation

Decorators encode business rules in types:

- `@minLength(3) @maxLength(60)` on `name` enforces Azure naming rules
- `@minValue(1) @maxValue(30)` on capacity prevents invalid instance counts
- `@minValue(1) @maxValue(365)` on retention matches Log Analytics limits

These validate at parse time, not deployment time. Errors appear in your editor immediately.

## Helper Functions: Reusable Logic

Besides types, we need reusable functions. The helper library (`lib/helpers.bicep`) handles naming, tagging, SKU mapping, and environment-specific defaults.

### Defining Functions

```bicep
// lib/helpers.bicep
import {Env, Region, AppTier} from '../types/common.bicep'

@export()
@description('Build a complete tag set by merging required tags with optional custom tags')
func buildTags(env Env, owner string, project string, costCenter string?, customTags object?) object => {
  env: env
  owner: owner
  project: project
  ...((costCenter != null) ? {costCenter: costCenter} : {})
  ...((customTags != null) ? customTags : {})
}

@export()
@description('Map abstract application tier to Azure SKU configuration')
func getSkuForTier(tier AppTier) object =>
  tier == 'basic'
    ? {name: 'B1', tier: 'Basic'}
    : tier == 'standard'
      ? {name: 'S1', tier: 'Standard'}
      : {name: 'P1v3', tier: 'PremiumV3'}

@export()
@description('Get recommended capacity based on environment and tier')
func getCapacityForEnv(env Env, tier AppTier) int =>
  env == 'prod' && tier == 'premium'
    ? 3
    : env == 'prod'
      ? 2
      : 1
```

These encapsulate organizational conventions. `buildTags()` ensures consistent tagging. `getSkuForTier()` abstracts Azure SKU details. `getCapacityForEnv()` applies environment-specific defaults. One place to change, everywhere updated.

### Using Helpers

Import functions like types:

```bicep
import {buildTags, getSkuForTier} from '../../lib/helpers.bicep'
import {AppConfig} from '../../types/common.bicep'

param config AppConfig
param tags object

// Use helper functions
var skuConfig = getSkuForTier(config.tier)
var resourceTags = buildTags('prod', 'platform-team', 'myapp', null, tags)

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${config.name}-plan'
  location: config.location
  sku: skuConfig
  tags: resourceTags
}
```

Centralized logic. No duplication. Consistency across modules. Clean.

## Composing Complete Deployments

Individual modules compose into complete deployments through a main orchestrator template.

### Root Template

```bicep
// main.bicep
import {
  Env
  Region
  TagPolicy
  AppConfig
  VnetInput
} from './types/common.bicep'

import {buildTags} from './lib/helpers.bicep'

@description('Environment identifier')
param env Env

@description('Project name used for resource naming and tagging')
@minLength(3)
@maxLength(24)
param project string

@description('Required tags policy for all resources')
param tags TagPolicy

@description('Application Service configuration')
param app AppConfig

@description('Virtual Network configuration')
param vnet VnetInput

// Tag composition via helper function
var commonTags = buildTags(env, tags.owner, project, tags.costCenter, null)

// Module deployments
module net './modules/network/vnet.bicep' = {
  name: 'net'
  params: { input: vnet }
}

module web './modules/app/appservice.bicep' = {
  name: 'web'
  params: {
    config: app
    tags: commonTags
  }
}

// Outputs
@description('Resource ID of the App Service')
output appId string = web.outputs.appId

@description('Principal ID of the App Service managed identity')
output appPrincipalId string = web.outputs.principalId
```

The root template imports types and functions, defines typed parameters, composes modules, exposes outputs. All contracts explicit and compiler-verified.

### Parameter Files

Environment-specific configs use `.bicepparam` files:

```bicep
// env/prod.bicepparam
using 'main.bicep'

param env = 'prod'
param project = 'myapp'

param tags = {
  env: 'prod'
  owner: 'platform-team'
  costCenter: 'engineering'
}

param app = {
  name: 'myapp-prod'
  location: 'eastus'
  tier: 'premium'
  capacity: 3
  ingress: {
    kind: 'privateLink'
    vnetId: '/subscriptions/.../virtualNetworks/vnet-hub'
    subnetName: 'private-endpoints'
  }
  diagnostics: {
    workspaceId: '/subscriptions/.../workspaces/prod-logs'
    retentionDays: 90
  }
  autoScale: {
    minCapacity: 3
    maxCapacity: 10
    defaultCapacity: 3
    scaleOutCpuThreshold: 75
    scaleInCpuThreshold: 25
  }
  enableDeleteLock: true
}

param vnet = {
  name: 'vnet-myapp-prod'
  location: 'eastus'
  addressSpaces: ['10.0.0.0/16']
  subnets: [
    {
      name: 'app'
      prefix: '10.0.1.0/24'
    }
  ]
}
```

The `using` directive creates a typed relationship between parameter file and template. IntelliSense gives you autocomplete and validation. Invalid configs get highlighted before you even try to deploy.

## Deployment Workflow

Type safety at every stage:

### 1. Local Validation

```bash
# Build compiles templates and validates types
az bicep build --file main.bicep

# Type errors appear immediately:
# Error: Property 'vnetId' is required when kind is 'privateLink'
# Error: Value 'invalid-env' is not assignable to type 'dev' | 'test' | 'prod'
```

### 2. Pre-Deployment Validation

```bash
az deployment group validate \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

### 3. What-If Analysis

```bash
az deployment group what-if \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

### 4. Production Deployment

```bash
az deployment group create \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

Type validation catches most errors at build time. What-if catches resource-specific issues. By deployment, you're confident it'll work.

## Practical Examples

### Example 1: Public-Facing Web Application

```bicep
// env/web-public.bicepparam
using 'main.bicep'

param env = 'prod'
param project = 'customer-portal'

param app = {
  name: 'portal-prod'
  location: 'eastus'
  tier: 'premium'
  ingress: {
    kind: 'publicIp'
    sku: 'Standard'
    dnsLabel: 'customer-portal'
  }
  diagnostics: {
    workspaceId: '/subscriptions/.../workspaces/prod-logs'
    retentionDays: 90
  }
  autoScale: {
    minCapacity: 3
    maxCapacity: 10
    defaultCapacity: 3
  }
}
```

Type system ensures `ingress.kind = 'publicIp'` allows `dnsLabel` and `sku`. Required fields present. Auto-scale capacities valid (1-30). Environment value valid. Compiler checks everything.

### Example 2: Private Internal Service

```bicep
// env/internal-service.bicepparam
using 'main.bicep'

param env = 'prod'
param project = 'internal-api'

param app = {
  name: 'api-internal-prod'
  location: 'eastus'
  tier: 'premium'
  ingress: {
    kind: 'privateLink'
    vnetId: '/subscriptions/.../virtualNetworks/vnet-hub'
    subnetName: 'private-endpoints'
  }
  diagnostics: {
    workspaceId: '/subscriptions/.../workspaces/prod-logs'
  }
  enableDeleteLock: true
}
```

Type system ensures `ingress.kind = 'privateLink'` requires `vnetId` and `subnetName`. Can't specify `dnsLabel` (wrong variant). `enableDeleteLock` for production safety. `diagnostics` optional - defaults when omitted.

### Example 3: Development Environment

```bicep
// env/dev.bicepparam
using 'main.bicep'

param env = 'dev'
param project = 'myapp'

param app = {
  name: 'myapp-dev'
  location: 'eastus'
  tier: 'basic'
  ingress: {
    kind: 'publicIp'
    sku: 'Basic'
  }
  // No diagnostics, auto-scale, or locks in dev
}
```

Minimal valid config works. Cost-optimized tier for dev. Simple ingress. Clean.

## Patterns and Practices

Some patterns from real projects that work well:

### Pattern 1: Central Type Library

Define types once, import everywhere. Single `types/common.bicep` file for shared types. Module-specific types stay in modules. This prevents type drift and makes refactoring easy.

### Pattern 2: Discriminated Unions for Polymorphism

When config has distinct variants, model them explicitly. No optional parameters with runtime validation. Each variant declares its requirements. Type system prevents invalid combinations.

### Pattern 3: Hierarchical Type Composition

Build complex types from simple building blocks. Start with primitives and enums. Compose into structural types. Compose those into higher-level configs. Makes everything easier to understand.

### Pattern 4: Validate at Type Level

Encode constraints in decorators, not comments. Use `@minLength`, `@maxLength`, `@minValue`, `@maxValue`. Type system enforces automatically.

### Pattern 5: Extract Common Logic

Centralize conventions in helper functions. Naming, tagging, SKU mappings, environment defaults. Modules import and use them. Consistency everywhere.

### Pattern 6: Conditional Resources

```bicep
resource privateEndpoint '...' = if (ingress.kind == 'privateLink') {
  // Deploy only for private link variant
}
```

Deployment logic stays close to type definitions. Conditions explicit.

## Error Prevention

Type safety shifts errors from deployment to development. Common config mistakes that used to fail during deployment now show up in your editor.

### Configuration Mismatches

Discriminated unions prevent incompatible properties. `ingress.kind = 'privateLink'` ensures correct `publicNetworkAccess` automatically. Invalid combinations? Unrepresentable.

### Missing Required Parameters

Required parameters surface immediately. Select `kind = 'privateLink'` without `vnetId`? Type error before deployment. No runtime surprises.

### Invalid Parameter Values

Decorators enforce Azure limits during development. Retention over 365 days? Editor error. Instance count out of range? Editor error. Not deployment failures.

### Type Consistency

Type imports create contracts between modules. Module declares parameter as `Region` type? Arbitrary strings rejected at build time. No surprise deployment failures.

## Real-World Impact

Type-safe infrastructure keeps evolving. Here's what it means in practice:

**Onboarding**: New team members understand infrastructure contracts through types, not documentation. Types serve as always-current specs.

**Refactoring**: Change type definitions, compiler finds every location needing updates. Confidence through compile-time verification.

**Code Review**: Focus on architecture and logic, not parameter validation. Types enforce correctness automatically.

**Deployment Reliability**: Early error detection means fewer deployment failures. Faster feedback, shorter cycle time.

### Where This Goes Next

Several directions to expand typed infrastructure:

**Service Coverage**: Start with App Service, networking, storage, databases. Expand to Container Apps, Service Bus, Cosmos DB as needed.

**Policy Integration**: Combine type safety with policy-as-code. Types catch structural errors, PSRule verifies policy compliance. Comprehensive testing.

**Composition Patterns**: Reusable stacks. "Web application stack" (Front Door + App Gateway + App Service + Storage) as typed modules. Teams instantiate, not rebuild.

**CI/CD Integration**: Type validation in pipelines. All changes pass type checking before deployment.

## Real Talk: Tradeoffs

This approach isn't free. Initial setup takes time. Learning curve for discriminated unions. More upfront thinking about type design.

Worth it? Absolutely. The payoff comes fast - fewer failed deployments, faster development, better collaboration. To me is interesting that this investment pays dividends every single day after.

## The Core Idea

Infrastructure deserves same engineering discipline as application code. Type systems provide early error detection, confident refactoring, self-documenting code. These benefits work equally well for infrastructure.

The principle: **make invalid infrastructure unrepresentable**. When illegal states can't be expressed, the entire deployment lifecycle becomes more reliable and predictable.

---

## Getting Started

Start small, build up:

### Phase 1: Enable Features

1. Update Bicep CLI to 0.30+
2. Create `bicepconfig.json` with experimental features
3. Validate: `az bicep version`

### Phase 2: Type Library

1. Create `types/common.bicep` with basic enums (`Env`, `Region`)
2. Add validation decorators to existing parameters
3. Test imports in a simple module

### Phase 3: Discriminated Unions

1. Identify polymorphic configs in existing templates
2. Model as discriminated unions
3. Refactor modules to use typed variants

### Phase 4: Helper Library

1. Extract repeated logic to `lib/helpers.bicep`
2. Start with tagging and naming
3. Expand to SKU mapping and environment defaults

### Phase 5: Complete Deployments

1. Create typed parameter files for each environment
2. Migrate templates to use type imports
3. Establish type-safe workflow

Each phase builds on previous. Incremental adoption, no rewrites.

---

## Resources

### Project Repository

The [bicep-typed-starter](https://github.com/srdjan/bicep-typed-starter) template has everything:

- Type definitions in `types/common.bicep`
- Helper functions in `lib/helpers.bicep`
- Production-ready modules for common Azure services
- Complete deployment examples
- Documentation for development and features

### Key Documentation

- [Bicep User-Defined Types](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/user-defined-data-types) - Official docs
- [Discriminated Unions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/data-types#discriminated-unions) - Type variant patterns
- Project docs in repo for best practices and guides

### Community

Bicep community actively develops type system patterns. GitHub issues and discussions share knowledge. Contribute, learn, build together.

---

These patterns represent current state of typed infrastructure - evolving as experience grows and Bicep capabilities expand. Infrastructure deserves same engineering rigor as application code. Type safety makes that possible.

