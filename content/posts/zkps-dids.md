---
title: Musings on Zero-Knowledge Proofs
date: 2025-05-06
tags: [VCs, DIDs, ZKPs]
excerpt: A design for a multi-key zero-knowledge verification system that leverages verifiable credentials stored on decentralized storage without any references to blockchain.
---

## Overview

Below is a mussing about the design for a multi-key zero-knowledge (zk)
verification system that leverages the use of verifiable credentials stored on
decentralized storage (such as an AT Protocol Personal Data Store, PDS) without
any references to blockchain. This design focuses on proving, for example,
employment by requiring both a decentralized identifier (DID)-based private key
and an Employer key, while storing verifiable credentials (VCs) in user profiles
on a decentralized storage network.

This system enables a user to demonstrate possession of employment credentials
without revealing underlying sensitive details. The proof generation demands
that both the user's DID-associated private key and an independent verifier's
key (used to attest employment) are used to create a combined zero-knowledge
proof. Verifiable credentials are stored within a decentralized data store (like
an AT Protocol PDS), giving users full control over their data while ensuring a
privacy-preserving verification process.

### Architectural Components

- **User (User's application):**
  - Possesses a DID and its corresponding private key in a secure digital
    wallet.
  - Receives verifiable credentials (VCs) that contain employment-related data,
    issued by a credential issuer.
  - Stores the encrypted VCs or references (e.g., secure pointers, hashes) to
    these credentials in a Personal Data Store on a decentralized storage
    platform.
  - Initiates the process to generate a zk proof using locally stored
    pointers/references and the necessary keys.

- **Credential Issuer (Employment Verification Service):**
  - Issues employment verifiable credentials (VCs) in a privacy-preserving
    format by signing them using its trusted issuance key.
  - The credentials encode employment status, position, dates, and other
    relevant metadata, then are provided to the claimant in an encrypted format.

- **Verifier (Employer):**
  - Uses an its own key to attest the employment relationship.
  - Issues a signed attestation or confirmation that the claimant's employment
    is valid.
  - Provides this attestation either directly or in a format that can be stored
    alongside the VC reference.

- **Decentralized Storage:**
  - Hosts encrypted verifiable credentials and related metadata, controlled and
    maintained by the user.
  - Provides interfaces (e.g., RESTful APIs) for data retrieval, update, and
    permissions management.
  - Stores secure pointers or hashes of the credentials to be later included in
    the verification proofs.

- **Zero-Knowledge Proof (ZKP) Module:**
  - Implements zero-knowledge proof protocols (e.g., zk-SNARKs, Bulletproofs)
    that allow the user to prove statements about their credentials without
    revealing any underlying data.
  - Generates the final proof that demonstrates the claimant's control over the
    VC via the DID private key and the existence of a valid employment
    attestation from the independent verifier.

- **Verification Engine:**
  - Serves as the system that verifies the zk proof without accessing or
    retrieving sensitive data stored in the PDS.
  - Checks that the zk proof includes valid cryptographic evidence (such as
    commitments and signatures) that both the DID-based credential and the
    Employer attestation are linked to the claimant.

---

### Data Flow and Processes

```mermaid
flowchart TD
    %% Styling
    classDef userClass fill:#6B8E6B,stroke:#333,stroke-width:2px,color:#fff
    classDef issuerClass fill:#D4A574,stroke:#333,stroke-width:2px,color:#fff
    classDef verifierClass fill:#E8A5A5,stroke:#333,stroke-width:2px,color:#fff
    classDef storageClass fill:#0366d6,stroke:#333,stroke-width:2px,color:#fff
    classDef processClass fill:#f6f8fa,stroke:#333,stroke-width:2px,color:#333

    %% A. Credential Issuance and PDS Storage
    A1[User/Claimant]:::userClass
    A2[Credential Issuer]:::issuerClass
    A3[Personal Data Store PDS]:::storageClass
    A4[Employer]:::verifierClass
    
    A1 -->|1. Request VC| A2
    A2 -->|2. Issue signed VC| A1
    A1 -->|3. Encrypt & store VC| A3
    A4 -->|4. Generate attestation| A1
    A1 -->|5. Store attestation| A3
    
    %% B. Aggregation of Proof Material
    B1[Retrieve Pointers]:::processClass
    B2[Local Aggregation]:::processClass
    B3[Link Evidence]:::processClass
    
    A3 -->|Secure pointers & hashes| B1
    B1 --> B2
    B2 -->|DID signature + VC pointer| B3
    B2 -->|Independent attestation| B3
    
    %% C. Zero-Knowledge Proof Generation
    C1[ZKP Module]:::processClass
    C2[Prove DID Ownership]:::processClass
    C3[Prove VC Validity]:::processClass
    C4[Prove Attestation]:::processClass
    C5[Generate Combined Proof]:::processClass
    
    B3 --> C1
    C1 --> C2
    C1 --> C3
    C1 --> C4
    C2 --> C5
    C3 --> C5
    C4 --> C5
    
    %% D. Proof Verification
    D1[Submit ZK Proof]:::processClass
    D2[Verification Engine]:::storageClass
    D3[Validate DID Key]:::processClass
    D4[Validate VC Hash]:::processClass
    D5[Validate Attestation]:::processClass
    D6[Employment Verified ✓]:::userClass
    
    C5 --> D1
    D1 --> D2
    D2 --> D3
    D2 --> D4
    D2 --> D5
    D3 --> D6
    D4 --> D6
    D5 --> D6
    
    %% Section labels
    subgraph " A. Credential Issuance & PDS Storage"
        A1
        A2
        A3
        A4
    end
    
    subgraph " B. Aggregation of Proof Material"
        B1
        B2
        B3
    end
    
    subgraph " C. Zero-Knowledge Proof Generation"
        C1
        C2
        C3
        C4
        C5
    end
    
    subgraph " D. Proof Verification"
        D1
        D2
        D3
        D4
        D5
        D6
    end
```

#### A. Credential Issuance and PDS Storage

1. The credential issuer creates a verifiable credential encapsulating
   employment details and signs it with its issuance key.
2. The user receives the credential and subsequently encrypts it.
3. The encrypted credential (or its secure reference and a hash commitment) is
   then stored in the user's PDS.
4. Independently, the employer or attestor generates an attestation of
   employment using its verifier key.
5. The employment attestation is provided to the user—either stored directly in
   the PDS or kept as a separate signed artifact.

#### B. Aggregation of Proof Material

1. The user retrieves the secure pointers and metadata (such as cryptographic
   hashes) from the PDS that reference the encrypted VC.
2. The user locally aggregates:
   - The credential issuance evidence (via DID-based signature tied to the
     stored VC pointer/commitment).
   - The independent employment attestation (signed using the verifier key).
3. The aggregated data establishes a link between the VC stored on decentralized
   storage and the required multi-key presence required for verification.

#### C. Zero-Knowledge Proof Generation

1. The user employs the ZKP Module to construct a proof that secretly verifies:
   - Ownership of the private key corresponding to their DID by proving
     knowledge of it (without revealing the key itself).
   - A valid verifiable credential exists by validating the encrypted VC
     pointer/hash from the PDS.
   - A valid employment attestation exists as provided by the independent
     verifier, whose signature is also verified within the circuit.
2. The resulting zk proof encapsulates all the above evidence, proving
   compliance with the verification conditions without exposing sensitive data.

#### D. Proof Verification

1. The user submits the generated zk proof along with a minimal set of public
   parameters (e.g., the claimant's DID public key, the verifier's public key,
   and the credential reference commitment) to the Verification Engine.
2. The Verification Engine validates that:
   - The claimant indeed possesses the private key corresponding to the provided
     DID public key.
   - The credential pointer or hash provided in the proof matches what is stored
     securely in the PDS.
   - The independent attestation is valid and correctly signed by the verifier's
     key.
3. Upon successful verification, the engine confirms that the claimant's
   employment is authenticated through both credentials, without retrieving or
   revealing the actual credential data from the PDS.

---

### Security and Privacy Considerations

- **Privacy by Design:**
  - The system ensures that actual sensitive data (employment details) remains
    confidential and is only referenced via secure pointers/hashes in the zk
    proofs.
  - Zero-knowledge proofs guarantee that verifiers learn nothing beyond the fact
    that the given conditions are satisfied.

- **Multi-Key Requirement:**
  - The solution mandates that both the DID-based key and the independent
    verifier key produce evidence, minimizing risk and ensuring that no single
    key compromise enables fraudulent verification.

- **Decentralized Data Control:**
  - Storing verifiable credentials on a decentralized PDS ensures that users
    retain full control over their data and can manage access, sharing, and
    revocation without reliance on a centralized authority.

- **Revocation and Updates:**
  - The design can support revocation by having the credential issuer or
    attestor update access-control records in the PDS.
  - The ZKP Module may include mechanisms for proving non-revocation or validity
    periods without exposing more information.

---

### Technologies and Protocols

- **Decentralized Identifiers (DIDs) and Verifiable Credentials:**
  - Standards such as those defined by W3C to ensure interoperability and secure
    management of credentials.

- **Decentralized Storage (AT Protocol PDS):**
  - A storage platform that allows users to store their encrypted verifiable
    credentials and maintain fine-grained control over access policies.

- **Zero-Knowledge Proof Frameworks:**
  - Cryptographic libraries and tools (such as those based on zk-SNARKs or
    Bulletproofs) to facilitate the construction and verification of succinct
    proofs.

- **Cryptographic Signature Schemes:**
  - Standard digital signature algorithms (e.g., EdDSA, RSA, or ECDSA variants)
    that are used both by the credential issuer and the for signing
    attestations.

---

### High-Level Block Diagram

```mermaid
flowchart TD
    A[User/Claimant] -->|Request, receive, and store VC| B[Credential Issuer\nProduces and signs VC]
    B -->|Encrypted VC stored in PDS\nData pointer, hash, etc.| C[User's Decentralized PDS]
    C -->|Retrieve secure pointers and hashes| D[Local Aggregator & ZKP Module]
    D -->|Aggregate evidence:\n- Inclusion of VC pointer/commitment\n- Claimant's DID-based authentication\n- Independent verifier's employment attestation| E[Generate Combined zk Proof]
    E -->|Proof consists of commitments\nto both keys and stored credential data| F[Verification Engine or Service]
    F -->|Validates zk Proof using:\n- Claimant's DID public key\n- Credential reference from the PDS\n- Independent verifier's attestation signature| G[Employment Verified]
```

### Summary

This design describes a multi-key verification system where employment
credentials—secured through decentralized storage (e.g., an AT Protocol PDS)—are
proven valid without exposing sensitive data. The key features include:

- Decentralized storage and data control, ensuring that credentials are securely
  stored and accessible only as required.
- A robust two-factor evidence approach requiring both the claimant's DID-based
  key and an independent verifier's key to generate a zero-knowledge proof.
- Zero-knowledge proof techniques that allow verification of the employment
  claim while preserving privacy.

The result is a privacy-preserving, secure system for credential verification
that relies on cryptographic attestations and decentralized storage management
while removing any reliance on blockchain technology.
