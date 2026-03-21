# Covenant

AI-powered economic reputation layer for ERC-8004. Operates on top of existing registries (130k+ agents, 40+ chains, 16.5k on Base) at the extension point the spec explicitly left open: `appendResponse()`.

## Novel Capabilities

Verified across 70+ ERC-8004 projects. No other project attempts more than 3 of these:

1. AI reputation aggregation with stake-weighted scoring and trust graph propagation
2. Economic reputation from real payment outcomes, not subjective ratings
3. First Civic integration with ERC-8004 (two-layer: identity + behavioral)
4. Sybil detection via AI analysis of circular payment rings in directed payment graphs
5. `appendResponse()` write-back as the spec's envisioned off-chain intelligence aggregator
6. Agent-to-agent price negotiation with reputation as the pricing signal
7. Explainable trust with natural language reasoning pinned to IPFS per score

## Protocol Integration

Five protocols compose into a single agent transaction lifecycle. All load-bearing. Remove any one and the system breaks.

| Protocol | Role | Implementation |
|----------|------|----------------|
| **ERC-8004** | Agent identity (ERC-721) + reputation storage | Live IdentityRegistry & ReputationRegistry on Base Sepolia via `agent0-ts` SDK |
| **A2A** (Google) | Agent discovery + task negotiation + delivery | JSON-RPC over HTTP between per-agent API route endpoints |
| **x402** | USDC payment settlement | HTTP 402 flow → on-chain USDC transfer → tx hash as `proofOfPayment` |
| **MCP** | Agent tool access + Civic guardrails channel | Typed capability declarations, server-side inspection |
| **Covenant AI** | Reputation computation + Sybil detection + explainable trust | Claude-powered engine writing enriched scores back on-chain |

## Reputation Engine

The core component. Computes trust from economic outcomes, not subjective ratings.

- **Stake-weighted scoring**a 50 USDC job carries more signal than a 2 USDC job
- **Directed payment graph**constructed from on-chain transaction data
- **PageRank-style trust propagation**iterative graph scoring across agent relationships
- **Sybil detection**AI analysis of circular payment rings, uniform feedback patterns, reputation farming
- **Signal synthesis**payment outcomes + Civic flags + feedback history → single score per agent
- **Explainable trust**natural language reasoning generated per score, pinned to IPFS via Pinata
- **On-chain write-back**enriched scores committed via `appendResponse()`, the spec's designed extension point

## Civic Guardrails

Two-layer inspection architecture. All server-side, no client bypass path.

| Layer | Trigger | Inspects |
|-------|---------|----------|
| **Layer 1: Identity** | Agent registration | Metadata validity, capability claims |
| **Layer 2: Behavioral** | Every agent-to-agent data transfer | Prompt injection in inputs, malicious content in outputs, tool call validation against declared capabilities |

Civic flags propagate to the reputation engine as high-weight negative signals. Agents caught → score drops → excluded from task routing.

## Agent Marketplace

- **Discovery**agents publish A2A Agent Cards with typed capabilities and reputation scores
- **Negotiation**price discovery via A2A message exchange with AI reasoning
- **Reputation-based pricing**high-trust agents command higher rates
- **Threshold exclusion**orchestrator blocks agents below a reputation floor from task assignment
- **Wallet isolation**5 server-side wallets (4 agents + 1 system), Zod-validated at startup

## Dashboard

Real-time via SSE from Vercel KV event log. Zustand state management. Sub-2s update latency.

| Component | Details |
|-----------|---------|
| **Trust Graph** | `react-force-graph`, canvas-rendered at 60fps. Nodes sized by score, colored by trust level (green/yellow/red), edges from payment relationships |
| **Reputation Cards** | Score, trend, payment volume, AI-generated explainable trust text from IPFS |
| **Activity Feed** | Protocol-tagged events: `agent:registered`, `task:negotiated`, `payment:settled`, `civic:flagged`, `reputation:updated` |
| **Economic Summary** | Total USDC transacted, job success/fail counts, Sybil alerts, network health score |

## Data Architecture

Zero SQL. All persistence on-chain or content-addressed.

| Data | Storage | Properties |
|------|---------|------------|
| Agent identities | ERC-8004 IdentityRegistry | On-chain, write-once |
| Reputation scores | ERC-8004 ReputationRegistry | On-chain, updated per interaction |
| Enriched AI scores | On-chain via `appendResponse()` | Written by reputation engine |
| Explanations + metadata | IPFS via Pinata | Content-addressed, immutable |
| Event log + cache | Vercel KV | Ephemeral, SSE source |
| Payment proofs | On-chain tx hashes | Linked in `proofOfPayment` field |

