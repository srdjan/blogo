---
title: Your Browser Is Already a Wallet
date: 2024-12-13
tags: [WebAuthn, Digital Identity, Verifiable Credentials, Passkeys]
excerpt: While the identity community debated wallet distribution strategies, Apple, Google, and Microsoft shipped the infrastructure. The wallet problem got solved sideways.
---

Something happened while the identity industry was arguing about wallets.

The Verifiable Credentials community spent years on the "wallet problem." Would
consumers download another app? Would they manage cryptographic keys? Would they
write down twelve-word recovery phrases? The friction seemed insurmountable.

Meanwhile, Apple, Google, and Microsoft shipped the infrastructure. WebAuthn.
Passkeys. Face ID and fingerprint authentication backed by secure enclaves. The
same cryptographic primitives that Verifiable Credentials require - private keys
that never leave the device, biometric-gated signing - now come standard in
every modern browser and smartphone.

No extension. No seed phrase. No twelve-word recovery ritual.

## What Passkeys Actually Provide

Here's the technical part that makes this work. A passkey is:

- A private key stored in a secure enclave (hardware-protected, never exported)
- Authentication via biometrics (Face ID, fingerprint, Windows Hello)
- Asymmetric cryptography for signing challenges
- Cross-device sync through platform credentials (iCloud Keychain, Google
  Password Manager)

Look at what that means for identity: you have a private key in tamper-resistant
hardware, authenticated by biometrics the user already trusts. That's not just
password replacement. That's infrastructure to sign a credential presentation or
make a selective disclosure proof.

The same gesture that logs you into your bank can authorize sharing a verified
credential.

## Biometrics Are Already Everywhere

To me is interesting how fast this spread while identity folks debated
architecture. Consider what's already deployed:

**Air Travel**: U.S. Customs and Border Protection implements biometric
collection at entry/exit points. Cameras at gates capture your face, matching
against databases. CLEAR and TSA PreCheck use fingerprints and iris scans. You
walk through, look at a camera, board the plane.

**Stadiums and Venues**: Enroll once - link your ticket and payment to your
face - then walk through looking at a camera. Some venues let fans pay for
concessions with a glance. No wristbands, no physical tickets.

**Electronic Signing**: Biometric signatures on tablets, multi-factor
authentication for document signing, secure signer verification for
transactions.

Biometric gating replaces physical tokens (passports, tickets, IDs) with your
own body's data. The infrastructure exists. People use it daily.

## The Full Chain Already Works

Think about what modern devices provide for identity proofing:

1. **Document capture** - Camera for scanning ID documents
2. **Liveness detection** - Biometric sensors to prove you're present
3. **Key binding** - Secure enclave to bind verified identity to a cryptographic
   key
4. **Credential presentation** - WebAuthn to sign assertions

The complete chain - prove who you are, receive a credential, present it later -
can happen entirely through capabilities that shipped in your pocket. No special
wallet app. No new infrastructure to deploy.

## What This Means for Verifiable Credentials

The hard problem got solved sideways. Browser vendors and device manufacturers
treated asymmetric cryptography and biometrics as default infrastructure. They
weren't trying to solve identity - they were killing passwords. But the result
is the same.

Consider what you can do with passkeys:

```
User authenticates with Face ID
  → Secure enclave holds private key
    → Key signs a challenge (or a credential presentation)
      → Relying party verifies signature
```

That's the same flow Verifiable Credentials need. The cryptographic ceremony is
identical. Present a credential, prove you hold the corresponding key,
biometrics gate the operation.

## Real Talk: What's Still Missing

This doesn't mean Verifiable Credentials achieve mainstream adoption tomorrow.
Other challenges remain:

**Issuer ecosystem**: Someone needs to issue credentials. Governments,
universities, employers need to participate. This is policy and business model
work, not technology.

**Credential formats**: The standards landscape is fragmented. SD-JWT, mDL,
various W3C profiles. Interoperability takes time.

**User mental models**: People understand passwords (even if they hate them).
"Presenting a verifiable credential" is a new concept that needs explanation.

**Revocation and validity**: Credentials expire, get revoked, need status
checks. Infrastructure for this is still maturing.

The assumption that consumer-side infrastructure was the bottleneck? No longer
true. But adoption barriers moved, they didn't disappear.

## The Practical Takeaway

For anyone working on identity systems, the wallet distribution problem is
solved. Stop designing solutions that require users to download special apps or
manage seed phrases. The browser is the wallet. Passkeys are the keys.

This changes the product question from "how do we get users to adopt wallets?"
to "how do we integrate with infrastructure they already have?"

I worked with identity systems for years, and this shift feels significant. The
arguments about consumer deployment that dominated conferences - they're
obsolete. Whatever barriers remain for Verifiable Credentials, they're not about
the wallet.

Build on passkeys. The infrastructure shipped while we were debating.
