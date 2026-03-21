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

## Civic Guardrails

Two-layer inspection architecture. All server-side, no client bypass path.

| Layer | Trigger | Inspects |
|-------|---------|----------|
| **Layer 1: Identity** | Agent registration | Metadata validity, capability claims, suspicious wallet patterns |
| **Layer 2: Behavioral** | Every agent-to-agent data transfer | Prompt injection in inputs, malicious content in outputs, tool call validation against declared capabilities |

Civic flags propagate to the reputation engine as high-weight negative signals (L1: -3, L2: -5). Agents caught have scores dropped and get excluded from task routing.


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


