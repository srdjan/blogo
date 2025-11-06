---
title: "Emplyment Background Checking Wthout Exposing Sensitive Details"
date: 2025-05-06
tags: [VCs, DIDs, ZKPs]
excerpt: W3C Verifiable Credentials with BBS+ signatures let you prove employment without revealing salary or position. Here's how the standard works, and how multi-party attestations could make it even stronger.
---

Current verification systems force a binary choice: reveal everything or prove
nothing. Want to verify employment? Hand over your salary details, position,
start date, performance reviews—the whole package. Need to prove you're over 21?
Show your complete driver's license with home address and organ donor status.

Here's what bugs me about this: the W3C solved this problem. Verifiable
Credentials with BBS+ signatures let you prove statements without revealing
underlying data. You can mathematically demonstrate employment status without
exposing any sensitive details. The standards exist, the cryptography works—but
adoption stays minimal.

What if we actually built this? And what if we extended it with multi-party
attestations for even stronger security?

## The Core Problem: All-or-Nothing Verification

Traditional credentials are atomic—you show the whole thing or nothing at all.
Your employer verification letter contains your salary, position, team, manager,
start date, and more. Most verifiers only need to know "is this person currently
employed?" but they get access to everything.

This creates real problems:

**Privacy violations** - Salary information leaks to landlords, loan officers,
background check companies

**Data minimization failures** - GDPR requires collecting only necessary data,
but credentials bundle everything together

**Unnecessary exposure** - Performance reviews and internal details become
visible to external parties

To me is interesting how BBS+ signatures solve this elegantly. You can prove
employment status while revealing nothing else—not through obscurity or trust,
but through mathematics.

## How W3C Verifiable Credentials Actually Work

The W3C Verifiable Credentials Data Model 2.0 is the standard. Here's what it
looks like in practice.

### Standard Credential Issuance

Your employer issues a verifiable credential using the BBS+ cryptographic suite.
This enables selective disclosure—you can later prove claims without revealing
others.

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://www.w3.org/ns/credentials/examples/v2"
  ],
  "type": ["VerifiableCredential", "EmploymentCredential"],
  "issuer": "did:example:megacorp-789",
  "validFrom": "2025-01-15T00:00:00Z",
  "validUntil": "2026-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:example:alice-456",
    "employmentStatus": "active",
    "employer": "MegaCorp Inc.",
    "position": "Senior Software Engineer",
    "salary": 125000,
    "startDate": "2023-01-01",
    "department": "Engineering"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "bbs-2023",
    "created": "2025-01-15T00:00:00Z",
    "verificationMethod": "did:example:megacorp-789#bbs-key-1",
    "proofValue": "u2V0BhVhBKb...CnQL0A9A" // BBS+ signature
  }
}
```

Here's the cool part: the BBS+ signature covers all fields, but you can later
derive proofs revealing only selected claims. The cryptography makes this
possible without the issuer doing anything special.

### Selective Disclosure in Action

When someone needs to verify your employment, you don't hand over the full
credential. Instead, you derive a proof showing only what's necessary:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://www.w3.org/ns/credentials/examples/v2"
  ],
  "type": ["VerifiableCredential", "EmploymentCredential"],
  "issuer": "did:example:megacorp-789",
  "validFrom": "2025-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:example:alice-456",
    "employmentStatus": "active",
    "employer": "MegaCorp Inc."
    // salary, position, startDate, department NOT revealed
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "bbs-2023",
    "created": "2025-01-15T10:30:00Z",
    "verificationMethod": "did:example:megacorp-789#bbs-key-1",
    "proofValue": "u2V0BhVhBKc...XnZL9B8C" // Different proof, unlinkable
  }
}
```

Look at what happened: the derived credential shows only employment status and
employer name. No salary. No position. No start date. But the verifier can still
check the BBS+ proof and confirm the issuer signed these specific claims.

The beautiful part: each derived proof is cryptographically unlinkable. Generate
ten proofs for ten different verifiers, and they can't correlate them. Your
privacy persists across verifications.

## How BBS+ Signatures Enable This

BBS+ (Boneh-Boyen-Shacham) signatures have special mathematical properties:

**Selective Disclosure** - The signature covers all claims, but you can prove a
subset without revealing others

**Unlinkability** - Each derived proof looks completely different, preventing
tracking across verifiers

**Zero-Knowledge** - The verifier learns only what you choose to reveal, nothing
more

This means the issuer signs once. You derive as many proofs as needed. Each
proof is unlinkable, privacy-preserving, and mathematically verifiable.

### The Standard Flow

**1. Issuance**: Employer signs credential with BBS+ signature covering all
claims

**2. Storage**: You store the credential in your digital wallet (could be local,
cloud, or decentralized)

**3. Presentation**: When verification is needed, you derive a proof with only
required claims

**4. Verification**: Verifier checks the BBS+ proof against issuer's public key

No blockchain. No centralized registry. Just cryptographic proofs and W3C
standards.

## Beyond the Standard: Multi-Party Attestations

The W3C standard works well, but there's an interesting extension: what if
verification required attestations from multiple parties?

**This is a proposed extension, not part of W3C VCDM 2.0.** But it's compatible
with the standard and adds meaningful security properties.

### The Problem with Single-Party Issuance

Standard VCs rely entirely on the issuer's signature. If an issuer's key is
compromised, attackers can forge credentials. If an issuer goes rogue, they can
issue fraudulent credentials.

For high-stakes verification like employment, financial credentials, or
professional licenses, single-party trust creates risks.

### Multi-Party Attestation Architecture

Here's how it could work: require both a credential issuer AND the actual
employer to sign attestations.

**Credential from Verification Service**:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://example.com/employment/v1"
  ],
  "type": ["VerifiableCredential", "EmploymentCredential"],
  "issuer": "did:example:verification-service-123",
  "validFrom": "2025-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:example:alice-456",
    "employmentStatus": "active",
    "employer": "did:example:megacorp-789",
    "verifiedAt": "2025-01-15T00:00:00Z"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "bbs-2023",
    "created": "2025-01-15T00:00:00Z",
    "verificationMethod": "did:example:verification-service-123#key-1",
    "proofValue": "u2V0BhVhBKb..."
  }
}
```

**Direct Employer Attestation**:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2"
  ],
  "type": ["VerifiableCredential", "EmployerAttestation"],
  "issuer": "did:example:megacorp-789",
  "validFrom": "2025-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:example:alice-456",
    "employmentStatus": "active",
    "attestationType": "employment-confirmation"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-jcs-2022",
    "created": "2025-01-15T00:00:00Z",
    "verificationMethod": "did:example:megacorp-789#attestation-key",
    "proofValue": "z3MvGcF7..."
  }
}
```

Both are standard W3C Verifiable Credentials. The extension is requiring both to
be present for verification to succeed.

### Security Properties of Multi-Party Attestations

**Defense against compromised issuers** - Forging credentials requires
compromising both the verification service AND the employer

**Fraud detection** - Employers can audit which attestations they've signed,
detecting unauthorized activity

**Decoupled trust** - The verification service verifies employment, the employer
attests to it directly

**Standard-compliant** - Uses only W3C VC primitives, no custom cryptography

This means you maintain all the benefits of standard VCs—selective disclosure,
unlinkability, privacy—while adding multi-party security.

### When Multi-Party Attestations Make Sense

**High-stakes credentials** where forgery has serious consequences:

- Professional licenses (medical, legal, engineering)
- Financial credentials (credit scores, asset ownership)
- Government-issued credentials (citizenship, security clearances)

**Not needed for**:

- Low-risk credentials (newsletter subscriptions, forum memberships)
- Credentials where issuer compromise is unlikely
- Use cases where simplicity matters more than maximum security

The tradeoff: added complexity and coordination cost in exchange for stronger
security guarantees.

## Technology Stack (Standard + Extensions)

**W3C Standards** (what actually exists today):

- Verifiable Credentials Data Model 2.0
- Decentralized Identifiers (DIDs) Core 1.0
- Data Integrity BBS Cryptosuites v1.0
- VC JSON Schema for credential validation

**Storage Options** (implementation choice, not standardized):

- Local digital wallets (mobile apps, browser extensions)
- Cloud-based credential stores
- Decentralized storage (AT Protocol, IPFS, etc.)
- Any combination of the above

**Proposed Extensions** (compatible but not standardized):

- Multi-party attestation requirements
- Coordinated revocation across multiple issuers
- Reputation signals from attestation patterns

Look at what this avoids: no blockchain requirements, no consensus mechanisms,
no cryptocurrency, no centralized credential repositories.

## Revocation: How It Actually Works

The W3C standard supports multiple revocation mechanisms. Here's the practical
one:

### Status List 2021

Issuers maintain a bitstring where each bit represents a credential's status:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://www.w3.org/ns/credentials/status/v1"
  ],
  "type": ["VerifiableCredential", "EmploymentCredential"],
  "issuer": "did:example:megacorp-789",
  "credentialSubject": {
    "id": "did:example:alice-456",
    "employmentStatus": "active"
  },
  "credentialStatus": {
    "id": "https://megacorp.example/status/3732",
    "type": "BitstringStatusListEntry",
    "statusPurpose": "revocation",
    "statusListIndex": "3732",
    "statusListCredential": "https://megacorp.example/status-list/1"
  },
  "proof": {/* ... */}
}
```

When you present a credential, the verifier checks the status list. If bit 3732
is set, the credential is revoked.

This means revocation works without revealing which credential was checked—the
verifier sees a status list with thousands of entries, not which specific one
matters.

## Real Talk: What Works Today vs. What Could Work

**Available Now** (W3C standards ready for production):

✅ BBS+ selective disclosure ✅ Unlinkable derived proofs ✅ Standard revocation
mechanisms ✅ DID-based identity ✅ Interoperable credentials across wallets

**Works But Needs Adoption**:

⚠️ Wallet software exists but isn't mainstream ⚠️ Issuer infrastructure requires
setup ⚠️ Verifier integration needs standardized APIs ⚠️ User experience needs
refinement

**Proposed Extensions** (compatible but not standardized):

🔧 Multi-party attestation requirements 🔧 Cross-issuer revocation coordination
🔧 Reputation metrics from attestation patterns 🔧 Automated attestation
verification workflows

The core standards work. The cryptography is solid. What's missing is ecosystem
adoption and tooling maturity.

## Where This Shines and Where It Doesn't

Standard W3C VCs with BBS+ excel at:

**Privacy-sensitive verification** - Healthcare, financial services, employment,
education credentials

**Regulatory compliance** - GDPR data minimization, HIPAA privacy requirements

**Cross-border credentials** - International education, employment, professional
licenses

**User-controlled identity** - People managing credentials without centralized
services

They fall short for:

**High-frequency authentication** - BBS+ proof generation takes milliseconds,
not microseconds

**Complex queries** - "Find all engineers in Seattle earning over $100k" can't
work with selective disclosure

**Real-time coordination** - Revocation has latency; instant propagation is hard

**Simple use cases** - When privacy doesn't matter, simpler auth mechanisms work
fine

This means VCs trade query flexibility for privacy. For many use cases, that's
exactly the right trade.

## Why This Matters

The W3C standardized verifiable credentials five years ago. The BBS+ cryptosuite
became a recommendation in 2024. The pieces exist.

What's missing is adoption. Building these systems requires thinking differently
about verification—treating privacy as a requirement, not a feature. It requires
trusting mathematics over centralized authorities.

The payoff is real: verification systems where users control their data, prove
only what's necessary, and maintain privacy without sacrificing security.
Employment verification that doesn't leak salary details. Age verification that
doesn't expose birth dates. Educational credentials that don't reveal grades.

Multi-party attestations could extend this further—adding defense against
compromised issuers while staying compatible with W3C standards. The
architecture is there. The cryptography works.

I've been exploring this space because the current all-or-nothing model feels
broken. The standards exist. The technology works. What remains is building
practical implementations and getting them adopted.

That's the interesting problem.

---

## References

- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
  (May 2025)
- [W3C Decentralized Identifiers (DIDs) Core 1.0](https://www.w3.org/TR/did-core/)
  (July 2022)
- [Data Integrity BBS Cryptosuites v1.0](https://www.w3.org/TR/vc-di-bbs/)
  (2024)
- [VC Status List 2021](https://www.w3.org/TR/vc-status-list/) for revocation
  mechanisms
