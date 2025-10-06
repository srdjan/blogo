---
title: Type-Safe Infrastructure as Code: A Practical Guide to Typed Bicep
date: 2025-10-06
tags: [Azure, Bicep, Infrastructure as Code, DevOps, Type Safety]
excerpt: How we use Bicep's type system to prevent configuration errors at compile time and create maintainable infrastructure templates through discriminated unions and type imports.
---

Infrastructure as Code (IaC) tooling has evolved significantly, yet many teams still encounter runtime deployment failures that could have been caught earlier. We believe infrastructure definitions should leverage type systems the same way application code does—catching errors before deployment, not after.

This tutorial demonstrates our approach to typed Bicep, showing how type safety transforms infrastructure development from error-prone scripting into predictable, maintainable engineering.

## Our Philosophy: Types as Infrastructure Contracts

When teams write infrastructure code, they're defining contracts—agreements about what resources exist, how they connect, and which configurations are valid. Traditional IaC approaches leave these contracts implicit, documented only in comments or external wikis. We take a different approach: **encode contracts directly in the type system**.

This philosophy emerged from observing common infrastructure deployment failures. Configuration mismatches, invalid property combinations, and missing required parameters—these issues share a root cause. The infrastructure definition language didn't prevent invalid states from being expressed. By making illegal states unrepresentable through types, we push validation from deployment time to development time.

The result: faster feedback loops, clearer module interfaces, and infrastructure definitions that serve as their own documentation.

This guide is organized around three core areas: understanding the type system foundations, building typed modules, and composing them into complete deployments. We'll progress from basic type definitions through discriminated unions to practical module composition patterns.

## Foundation: Bicep's Type System

Modern Bicep (0.30+) provides user-defined types with experimental features that enable sophisticated type safety. These features include `@export/@import` for sharing types across files, discriminated unions for polymorphic configurations, and comprehensive parameter validation decorators.

### Enabling Type Features

Type safety begins with configuration. The `bicepconfig.json` file enables experimental features:

```json
{
  "experimentalFeaturesEnabled": {
    "userDefinedTypes": true,
    "imports": true
  }
}
```

These settings unlock the full type system: user-defined types, type imports/exports, and function definitions—the building blocks of type-safe infrastructure.

### Creating a Type Library

We organize types in a central library (`types/common.bicep`) rather than duplicating definitions across modules. This single-source-of-truth approach ensures consistency and simplifies refactoring.

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

The `@export()` decorator makes these types importable. Literal unions (`'dev' | 'test' | 'prod'`) create enumerations that provide autocomplete and prevent invalid values.

### Type Imports in Modules

Modules import only the types they need, creating explicit dependencies:

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

This import mechanism creates clear contracts between modules and eliminates type drift across the codebase.

## Building Typed Modules: Discriminated Unions

Discriminated unions represent one of our most powerful type safety patterns. They model configurations where different options require different properties—a common scenario in infrastructure.

### The Problem: Polymorphic Configuration

Consider application ingress configuration. An app might use:
- Public IP access (requires DNS label, SKU selection)
- Private endpoint access (requires VNet ID, subnet name)
- Application Gateway integration (requires gateway ID, listener name)

Each option has distinct required properties. Traditional approaches use optional parameters and runtime validation:

```bicep
// Traditional approach - error-prone
param ingressType string
param dnsLabel string?        // Only for publicIp
param vnetId string?          // Only for privateLink
param subnetName string?      // Only for privateLink
param appGatewayId string?    // Only for appGateway
```

This design allows invalid combinations: `ingressType='publicIp'` with `vnetId` set but no `dnsLabel`. The type system doesn't prevent this; validation happens at deployment.

### The Solution: Discriminated Unions

We encode valid configurations as type variants:

```bicep
@export()
@description('Discriminated union for ingress configuration options')
@discriminator('kind')
type Ingress =
  | { kind: 'publicIp', sku: 'Basic' | 'Standard', dnsLabel: string? }
  | { kind: 'privateLink', vnetId: string, subnetName: string }
  | { kind: 'appGateway', appGatewayId: string, listenerName: string }
```

The `@discriminator('kind')` decorator designates `kind` as the distinguishing field. Each variant defines its own required and optional properties. Invalid combinations become unrepresentable.

### Using Discriminated Unions in Modules

Modules pattern-match on the discriminator to implement variant-specific logic:

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

Type safety ensures `ingress.vnetId` and `ingress.subnetName` are only accessed when `ingress.kind == 'privateLink'`. The compiler prevents variant-specific property access in wrong contexts.

## Structural Types: Composing Complex Configurations

Beyond unions, we use structural types to compose complex configurations from simpler building blocks.

### Nested Type Composition

Consider a complete application configuration:

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

`AppConfig` composes multiple type levels: primitive types (`name`, `location`), enumerations (`tier`), discriminated unions (`ingress`), and nested structural types (`diagnostics`, `autoScale`). Each level adds validation—parameter decorators enforce constraints, optional properties (`?`) handle nullable fields.

### Parameter Validation Decorators

Decorators like `@minLength`, `@maxLength`, `@minValue`, `@maxValue` encode business rules directly in types:

- `@minLength(3) @maxLength(60)` on `name` enforces Azure naming constraints
- `@minValue(1) @maxValue(30)` on capacity prevents invalid instance counts
- `@minValue(1) @maxValue(365)` on retention days matches Log Analytics limits

These validations happen at parse time, not deployment time. Invalid configurations are caught in the editor.

## Reusable Functions: The Helper Library

Alongside types, we define reusable functions that encapsulate common logic. The helper library (`lib/helpers.bicep`) provides utilities for naming, tagging, SKU mapping, and environment-specific defaults.

### Function Definitions with @export

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

These functions encapsulate organizational conventions. `buildTags()` ensures consistent tagging. `getSkuForTier()` abstracts Azure SKU details behind simple tier names. `getCapacityForEnv()` applies environment-specific sizing defaults.

### Using Helper Functions in Modules

Modules import functions the same way they import types:

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

This pattern centralizes logic, reducing duplication and inconsistency across modules.

## Module Composition: Building Complete Deployments

Individual typed modules compose into complete deployments through the main orchestrator template.

### Root Template Structure

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

The root template imports types and functions, defines typed parameters, composes module calls, and exposes typed outputs. All contracts are explicit through the type system.

### Parameter Files

Environment-specific configurations use `.bicepparam` files:

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

The `using` directive creates a typed relationship between parameter file and template. IntelliSense provides autocomplete and validation based on imported types. Invalid configurations are highlighted before deployment.

## Deployment Workflow

Our deployment process leverages type safety at each stage:

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
# Validate checks Azure API compatibility
az deployment group validate \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

### 3. What-If Analysis

```bash
# Preview changes without deployment
az deployment group what-if \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

### 4. Production Deployment

```bash
# Deploy with confidence after type validation
az deployment group create \
  --resource-group prod-rg \
  --template-file main.bicep \
  --parameters env/prod.bicepparam
```

Type validation at build time catches most errors. What-if analysis catches resource-specific issues. By deployment time, confidence is high.

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

Type system ensures:
- `ingress.kind = 'publicIp'` allows `dnsLabel` and `sku`
- Required `tier` and `location` are present
- Auto-scale capacities are within valid range (1-30)
- Environment is valid enumeration value

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

Type system ensures:
- `ingress.kind = 'privateLink'` requires both `vnetId` and `subnetName`
- Cannot specify `dnsLabel` (not valid for this variant)
- `enableDeleteLock` creates production safeguards
- `diagnostics` is optional—retention days defaults when omitted

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

Type system ensures:
- Minimal valid configuration works (no required optional fields)
- Cost-optimized tier ('basic') appropriate for dev
- Simple ingress without advanced features

## Common Patterns and Best Practices

Through implementing typed Bicep across multiple projects, we've identified patterns that improve maintainability and reduce errors.

### Pattern 1: Central Type Library

**Principle**: Define types once, import everywhere.

Maintain a single `types/common.bicep` file with all shared types. Module-specific types can live in module files, but cross-module types belong in the central library. This prevents type drift and simplifies refactoring.

### Pattern 2: Use Discriminated Unions for Polymorphism

**Principle**: When configuration has distinct variants, model them explicitly.

Instead of multiple optional parameters with runtime validation, use discriminated unions. Each variant declares its own requirements. The type system prevents invalid combinations.

### Pattern 3: Compose Types Hierarchically

**Principle**: Build complex types from simpler building blocks.

Start with primitives and enumerations. Compose them into structural types. Compose structural types into higher-level configurations. This hierarchy makes types easier to understand and maintain.

### Pattern 4: Validate at Type Level

**Principle**: Encode constraints in parameter decorators, not comments.

Use `@minLength`, `@maxLength`, `@minValue`, `@maxValue` instead of documenting constraints. The type system enforces them automatically.

### Pattern 5: Extract Common Logic to Functions

**Principle**: Centralize organizational conventions in helper functions.

Naming conventions, tagging policies, SKU mappings, environment-specific defaults—encode these as functions. Modules import and use them, ensuring consistency.

### Pattern 6: Conditional Resources via Discriminators

**Principle**: Use discriminator checks for conditional resource deployment.

```bicep
resource privateEndpoint '...' = if (ingress.kind == 'privateLink') {
  // Deploy only for private link variant
}
```

This pattern keeps deployment logic close to type definitions and makes conditions explicit.

## Error Prevention in Practice

Type safety transforms common infrastructure errors from runtime failures to compile-time catches:

### Configuration Mismatches

**Before**: Deploy fails because `publicNetworkAccess` is `Enabled` but VNet integration expects it `Disabled`.

**After**: Discriminated union prevents this combination. `ingress.kind = 'privateLink'` automatically sets correct `publicNetworkAccess` value.

### Missing Required Parameters

**Before**: Deployment fails with "Parameter 'vnetId' is required".

**After**: Type system shows error in editor when `kind = 'privateLink'` but `vnetId` is missing.

### Invalid Parameter Values

**Before**: Deployment fails because retention days is 400 (exceeds Log Analytics limit of 365).

**After**: `@maxValue(365)` decorator prevents invalid values from being specified.

### Type Mismatches Across Modules

**Before**: Module expects `Region` but receives arbitrary string. Deployment succeeds with unsupported region, fails during resource creation.

**After**: Type import ensures module receives valid `Region` value. Invalid regions are rejected at build time.

## Evolution and Continuous Improvement

Our typed Bicep approach continues to evolve as we learn from practical use and as Bicep itself develops.

### Current State

We've adopted typed Bicep for all new infrastructure definitions and are incrementally migrating existing templates. The approach has proven valuable for:

- **Onboarding**: New team members understand infrastructure contracts through types
- **Refactoring**: Changing a type definition updates all consumers, with compile-time verification
- **Review**: Pull requests focus on logic, not parameter validation correctness
- **Reliability**: Fewer deployment failures, faster feedback loops

### Areas of Active Development

We're expanding our typed approach in several directions:

**Type libraries for additional Azure services**: We've built typed modules for App Service, networking, storage, and databases. We're continuing to expand coverage to additional services like Container Apps, Service Bus, and Cosmos DB.

**Policy-as-code integration**: Combining type safety with PSRule validation for comprehensive infrastructure testing—types catch structural errors, PSRule catches policy violations.

**Template composition patterns**: Exploring patterns for composing modules into reusable stacks (e.g., "web application stack" = Front Door + App Gateway + App Service + Storage).

**Deployment automation**: Integrating typed templates with CI/CD pipelines, ensuring type validation occurs at build time in automation workflows.

### Commitment to Type Safety

We believe infrastructure deserves the same engineering rigor as application code. Type systems have proven their value in software development—catching errors early, enabling confident refactoring, serving as living documentation. These benefits apply equally to infrastructure.

As Bicep's type system matures and our understanding deepens, we'll continue refining our approach. The core principle remains: **make invalid infrastructure unrepresentable**. When illegal states cannot be expressed, the entire deployment lifecycle becomes more reliable.

---

## Getting Started with Typed Bicep

For teams new to typed Bicep, we recommend this progression:

### Phase 1: Enable Type Features

1. Update Bicep CLI to 0.30 or later
2. Create `bicepconfig.json` with experimental features enabled
3. Validate setup: `az bicep version`

### Phase 2: Create Type Library

1. Create `types/common.bicep` with basic enumerations (`Env`, `Region`)
2. Add validation decorators to existing parameters
3. Test type imports in a simple module

### Phase 3: Introduce Discriminated Unions

1. Identify polymorphic configurations in existing templates
2. Model them as discriminated unions
3. Refactor modules to use typed variants

### Phase 4: Build Helper Library

1. Extract repeated logic into functions (`lib/helpers.bicep`)
2. Start with tagging and naming conventions
3. Expand to SKU mapping and environment-specific defaults

### Phase 5: Compose Complete Deployments

1. Create typed parameter files for each environment
2. Migrate existing templates to use type imports
3. Establish type-safe deployment workflow

Each phase builds on previous foundations, allowing incremental adoption without wholesale rewrites.

---

## Resources

### Project Repository

The complete bicep-typed-starter template demonstrates these patterns:

- **Type definitions**: `types/common.bicep` with comprehensive type library
- **Helper functions**: `lib/helpers.bicep` for reusable utilities
- **Module catalog**: Production-ready modules for common Azure services
- **Examples**: Complete deployment examples showing pattern usage
- **Documentation**: `CLAUDE.md` for development guide, `README.md` for features overview

### Key Documentation

- **[Bicep User-Defined Types](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/user-defined-data-types)**: Official Microsoft documentation
- **[Discriminated Unions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/data-types#discriminated-unions)**: Type variant patterns
- **[BICEP_BEST_PRACTICES.md](docs/BICEP_BEST_PRACTICES.md)**: Deep dive on type system usage
- **[README.md](README.md)**: Complete feature list and quick start guide

### Community Resources

The Bicep community actively develops type system patterns and best practices. Engaging with the community through GitHub issues, discussions, and contributions helps advance the entire ecosystem.

---

**Written for DevOps engineers beginning their journey with typed infrastructure as code. The patterns and principles presented here reflect our current approach and will continue evolving as we learn from practical application.**
