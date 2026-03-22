# Covenant

AI-powered economic reputation layer for ERC-8004. Operates on top of existing registries (130k+ agents, 40+ chains, 16.5k on Base) at the extension point the spec explicitly left open: `appendResponse()`.

Built for AI London 2026 (Encode Club). Onchain AI track + Civic partner challenge.

## Novel Capabilities

Verified across 70+ ERC-8004 projects. No other project attempts more than 3 of these:

1. AI reputation aggregation with stake-weighted scoring and trust graph propagation
2. Economic reputation from real payment outcomes, not subjective ratings
3. First Civic integration with ERC-8004 (two-layer: identity + behavioral)
4. Sybil detection via AI analysis of circular payment rings in directed payment graphs
5. `appendResponse()` write-back as the spec's envisioned off-chain intelligence aggregator
6. Agent-to-agent price negotiation with reputation as the pricing signal
7. Explainable trust with natural language reasoning pinned to IPFS per score
8. Deterministic 5-act demo narrative: collaboration, villain entry, attack, detection, exclusion
9. 7-stage reputation pipeline from raw feedback to IPFS-pinned explanation to on-chain write-back

## Protocol Integration

Five protocols compose into a single agent transaction lifecycle. All load-bearing. Remove any one and the system breaks.

| Protocol | Role | Implementation |
|----------|------|----------------|
| **ERC-8004** | Agent identity (ERC-721) + reputation storage | Live IdentityRegistry & ReputationRegistry on Base Sepolia via `agent0-ts` SDK |
| **A2A** (Google) | Agent discovery + task negotiation + delivery | JSON-RPC over HTTP between per-agent API route endpoints |
| **x402** | USDC payment settlement | HTTP 402 flow, on-chain USDC transfer, tx hash as `proofOfPayment` |
| **MCP** | Agent tool access + Civic guardrails channel | Typed capability declarations, server-side inspection |
| **Covenant AI** | Reputation computation + Sybil detection + explainable trust | Claude-powered engine writing enriched scores back on-chain |

## Reputation Engine

7-stage pipeline. Computes trust from economic outcomes, not subjective ratings.

| Stage | Module | What It Does |
|-------|--------|-------------|
| 1 | Feedback reader | Ingests FeedbackGiven events from ERC-8004 ReputationRegistry |
| 2 | Stake weighting | Weights signals by USDC volume (50 USDC job > 2 USDC job) |
| 3 | Graph construction | Builds directed payment graph from on-chain transaction data |
| 4 | Trust propagation | PageRank-style iterative scoring across agent relationships |
| 5 | Sybil detection | AI analysis of circular payment cycles, uniform feedback variance, coordination patterns |
| 6 | Score synthesis | Combines stake scores + Civic penalties + trust propagation into 0-10 score |
| 7 | Explanation + write-back | Claude generates natural language reasoning per score, pins to IPFS via Pinata, commits on-chain via `appendResponse()` |

## Civic Integration

Full-stack Civic integration across authentication, identity verification, and behavioral guardrails. First project to combine Civic Auth with ERC-8004 agent identity and AI-powered behavioral inspection.

### Civic Auth

OAuth2 authentication via `@civic/auth/nextjs` and `@civic/auth-web3/nextjs`. Provides human identity for agent deployers and links deployer reputation to their agents.

| Component | Implementation |
|-----------|----------------|
| **Provider** | `CivicAuthProvider` wraps the entire app in `layout.tsx` |
| **OAuth handler** | Catch-all route at `/api/auth/[...civicauth]` handles login/callback |
| **Session** | `getUser()` from `@civic/auth/nextjs` retrieves authenticated session |
| **Embedded wallets** | `getWallets()` from `@civic/auth-web3/server` retrieves connected Web3 wallets |
| **Route guards** | `requireAuth()` throws 401 for unauthenticated API access |

Auth-protected endpoints:
- `POST /api/agents/deploy` (human mode): requires Civic Auth, uses embedded wallet as agent wallet or provisions a new one, optionally links deployer reputation via on-chain attestation
- `GET /api/deployer/profile`: returns deployer stats (linked agents, deployer score, total deployed, flagged count) for the authenticated wallet

### Civic Guardrails

Two-layer inspection architecture. All server-side, no client bypass path. Powered by Civic MCP via Anthropic's native MCP connector (`anthropic-beta: mcp-client-2025-11-20`).

| Layer | Trigger | Inspects | AI Model |
|-------|---------|----------|----------|
| **Layer 1: Identity** | Agent registration | Metadata validity, capability claims, prompt injection in metadata fields | Claude Haiku via Civic MCP |
| **Layer 2: Behavioral (input)** | Incoming A2A task requests | Prompt injection, encoded payloads, data exfiltration attempts, unsafe tool instructions | Claude Haiku via Civic MCP |
| **Layer 2: Behavioral (output)** | Outgoing agent deliverables | Hidden instructions in output, prompt injection payloads disguised as results, manipulated data | Claude Haiku via Civic MCP |
| **Tool validation** | MCP tool execution | Tool name vs. declared capabilities (local check, no API call) | N/A (deterministic) |

**Inspection flow in A2A protocol:**
1. Task request arrives at `/api/agents/[agentId]/a2a`
2. Civic Layer 2 inspects input before agent execution
3. Critical/High severity: 403 `CIVIC_BLOCKED`, request rejected
4. Agent executes task
5. Civic Layer 2 inspects output before delivery
6. Critical/High severity: 403 `CIVIC_FLAGGED`, response blocked
7. Medium/Low severity: response delivered with `X-Civic-Warning` header

**Graceful degradation:** if Civic MCP is unavailable, inspections pass with `verificationStatus: 'unverified'`. The system never blocks on Civic downtime.

### Threat Handling

Flags are stored as an append-only audit trail in Vercel KV (`agent:{agentId}:civic-flags`).

| Severity | Action | Reputation penalty |
|----------|--------|-------------------|
| Critical | `blocked` (hard rejection) | -3.0 |
| High | `blocked` (hard rejection) | -2.0 |
| Medium | `flagged` (soft warning) | -1.0 |
| Low | `allowed` (pass with note) | -0.5 |

Multiple flags stack additively. The reputation bridge (`getCivicPenalty`) feeds aggregate penalties into the reputation engine as high-weight negative inputs during score synthesis.

**Detectable attack types:** `prompt_injection`, `data_exfiltration`, `unauthorized_tool`, `malicious_content`, `capability_mismatch`

### Civic Event Stream

All Civic actions emit typed events to the event bus, streamed to the dashboard via SSE:

| Event | When |
|-------|------|
| `civic:identity-checked` | Layer 1 inspection completes |
| `civic:behavioral-checked` | Layer 2 passes |
| `civic:flagged` | Layer 2 detects threat |
| `civic:tool-blocked` | Unauthorized tool call attempted |
| `civic:resolved` | Threat handled with action |

The Civic Guards dashboard page shows real-time inspection timeline, filterable by agent/layer/severity, with aggregate metrics (total inspections, L1 passes, L2 catches) and flagged agent cards with exclusion status.


## Base Integration

All on-chain operations run on Base Sepolia using the official ERC-8004 contracts. Zero custom smart contracts deployed.

| Contract | Address | Operations |
|----------|---------|------------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `createAgent()`, `registerOnChain()`, `getAgent()` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `giveFeedback()`, `FeedbackGiven` event polling, reputation write-back |
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ERC-20 transfers for x402 payment settlement |

**Stack:** `viem` for wallet/public clients and raw ERC-20 calls, `agent0-sdk` for ERC-8004 contract interaction, Pinata for IPFS metadata storage.

**Wallet architecture:** 5 managed wallets (researcher, reviewer, summarizer, malicious, system) via `viem` wallet clients on `baseSepolia`. Dynamic wallet provisioning via `generatePrivateKey()` with USDC funding from system pool. BYOW (bring-your-own-wallet) mode with nonce-based signature verification.

**On-chain lifecycle:** Agent registration (ERC-721 mint), USDC payment settlement (x402 flow with tx hash as `proofOfPayment`), feedback submission (1-5 scale with tags), `FeedbackGiven` event polling with block-level crash recovery, and reputation write-back via `giveFeedback()` with `covenant-reputation` and `append-response` tags carrying signal summaries.

## Data Architecture

Zero SQL. All persistence on-chain or content-addressed.

| Data | Storage | Properties |
|------|---------|------------|
| Agent identities | ERC-8004 IdentityRegistry | On-chain, write-once |
| Reputation scores | ERC-8004 ReputationRegistry | On-chain, updated per interaction |
| Enriched AI scores | On-chain via `appendResponse()` | Written by reputation engine |
| Explanations + metadata | IPFS via Pinata | Content-addressed, immutable |
| Event log + cache | Vercel KV (Upstash Redis) | Ephemeral, SSE source |
| Payment proofs | On-chain tx hashes | Linked in `proofOfPayment` field |


