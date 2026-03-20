# Covenant

AI-powered economic reputation layer for ERC-8004. Builds on top of existing registries (130k+ agents across 40+ chains, 16.5k on Base) to fill the gap the spec authors explicitly deferred: *"more complex reputation aggregation will happen off-chain."*

## What It Does

Covenant integrates five load-bearing protocols into a single transaction lifecycle — remove any one and the system breaks.

**Agent Identity & Registration** — Agents register on the live ERC-8004 IdentityRegistry on Base Sepolia with metadata files pinned to IPFS via Pinata. Each agent gets an ERC-721 identity token. The system manages 5 isolated wallets server-side (4 demo agents + 1 reputation engine wallet) with Zod-validated environment configuration at startup.

**Agent-to-Agent Communication (A2A)** — Full Google A2A protocol compliance. Agents publish Agent Cards advertising typed capabilities, discover peers, and exchange task requests via JSON-RPC over HTTP. All 4 agents run as internal Next.js API routes but communicate through real HTTP calls — genuine protocol compliance, not function calls pretending to be A2A.

**Payment Settlement (x402)** — USDC payments settle on Base Sepolia via the x402 HTTP payment protocol. Agent A requests work, Agent B responds with HTTP 402, payment settles on-chain, transaction hash captured as `proofOfPayment` and attached to ERC-8004 feedback submissions. Real money, real transactions.

**Civic Guardrails (Two-Layer)** — Every agent interaction passes through Civic MCP inspection server-side with no client bypass path. Layer 1 inspects agent metadata at registration. Layer 2 inspects every task input for prompt injection, every output for malicious content, and validates tool calls against declared capabilities. Civic flags propagate to the reputation engine as high-weight negative signals.

**AI Reputation Engine** — The core innovation. Reads feedback events from the ERC-8004 ReputationRegistry, applies stake-weighted scoring (a 50 USDC job carries more signal than a 2 USDC job), constructs a directed payment graph, runs PageRank-style trust propagation, and performs Sybil detection on circular payment patterns. Claude synthesizes all signals into a single score per agent with natural language explanations pinned to IPFS. Enriched scores write back on-chain via `appendResponse()` — the spec's designed extension point for exactly this kind of off-chain intelligence aggregator.

**Reputation-Based Task Routing** — The orchestrator routes work based on reputation. Agents below a threshold get excluded. Agents negotiate pricing through A2A message exchange — high-trust agents command higher rates. Emergent marketplace dynamics from reputation as economic signal.

## Dashboard

Real-time single-page dashboard fed by SSE from a Vercel KV event log. Zustand manages client state.

- **Trust Graph** — `react-force-graph` renders agents as nodes sized by reputation score, colored by trust level (green/yellow/red), connected by payment relationship edges. Canvas rendering, not DOM — handles animation at 60fps.
- **Reputation Cards** — Per-agent cards showing score, trend arrow, cumulative payment volume, and AI-generated explainable trust text pulled from IPFS.
- **Activity Feed** — Scrolling event log tagged by protocol: `agent:registered`, `task:negotiated`, `payment:settled`, `civic:flagged`, `reputation:updated`. Latest 50 events with auto-scroll.
- **Economic Summary** — Aggregate metrics: total USDC transacted, successful/failed job counts, active Sybil alerts, network health score.

Updates within 2 seconds of any reputation change event. SSE auto-reconnects on disconnect.

## Data Architecture

Zero SQL databases. All persistent data lives on-chain or on IPFS:

- Agent identities on ERC-8004 IdentityRegistry (on-chain, write-once)
- Reputation scores on ERC-8004 ReputationRegistry (on-chain, updated per interaction)
- Enriched AI scores via `appendResponse()` (on-chain)
- Explanations and metadata on IPFS via Pinata (content-addressed, immutable)
- Event log and cache in Vercel KV (ephemeral layer)
- Payment proofs as on-chain transaction hashes

Every external dependency has a graceful degradation path: Civic unavailable → transactions proceed flagged as "unverified"; Pinata down → explanations cached in KV with retry queue; Base RPC slow → UI shows "pending" with last-known cached state; x402 facilitator fails → transaction aborted, error event logged.

## Novel Capabilities

Verified across 70+ ERC-8004 projects — no other project attempts more than 3 of these:

1. AI reputation aggregation with stake-weighted scoring and trust graph propagation
2. Economic reputation derived from real payment outcomes, not subjective ratings
3. First Civic integration with ERC-8004 (two-layer: identity + behavioral)
4. Sybil detection via AI analysis of circular payment rings in the directed payment graph
5. `appendResponse()` write-back — the spec describes an "off-chain data intelligence aggregator" calling this function; Covenant is that aggregator
6. Agent-to-agent price negotiation with reputation as the pricing signal
7. Explainable trust with natural language reasoning generated per score and pinned to IPFS
