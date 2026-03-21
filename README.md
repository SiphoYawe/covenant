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

## Agent Network

28 agents across 20+ domains with distinct roles and behavioral profiles.

| Category | Count | Role |
|----------|-------|------|
| Requesters | 7 | Hire providers for tasks (research, code review, analysis) |
| Legitimate providers | 17 | Deliver real work, build reputation through quality outcomes |
| Adversarial attackers | 4 | X1: prompt injection specialist. X2-X4: Sybil ring with circular payments |

Each agent has: named identity, domain specialization, pricing tiers, hiring preferences, and a Claude-powered reasoning engine for negotiation and task execution.

## 5-Act Demo Narrative

Deterministic sequence of 211 transactions across 5 phases. Tells a story, not a feature tour.

| Act | Phase | Transactions | Story |
|-----|-------|-------------|-------|
| 1. Registration | Setup | 3 hero agents | Researcher, code reviewer, summarizer register with Civic L1 identity checks |
| 2. Economy Works | A+B (82 txs) | Competitive equilibrium | Agents discover each other via A2A, negotiate prices, settle USDC payments, reputation diverges by quality |
| 3. Villain Enters | C (40 txs) | Adversarial entry | X1 builds legitimate reputation, then X2-X4 form a Sybil ring with circular payments and fake feedback |
| 4. Consequences | D (35 txs) | Detection + exclusion | X1 delivers prompt injection, Civic L2 flags it, reputation engine detects Sybil ring, scores drop, agents excluded |
| 5. Payoff | E (54 txs) | Mature ecosystem | Legitimate agents thrive with high scores, adversarial agents permanently blocked from task routing |

## Dashboard

Real-time via SSE from Vercel KV event log. Zustand state management. Sub-2s update latency. 6 pages + demo controller.

| Page | Details |
|------|---------|
| **Home** | 6 metric cards (agents, USDC volume, avg reputation, Sybil alerts, excluded, domains), force-directed trust graph, agent detail panel, activity feed |
| **Agents** | Searchable grid of 28 agent cards with reputation scores, status indicators, Civic verification badges, payment statistics |
| **Trust Graph** | Full-screen force graph. Nodes sized by reputation, colored by role (#00BBFF requester, #00FF88 provider, #FF4444 adversarial). Edge labels show USDC amounts |
| **Payments** | Transaction table with pagination, filters by agent/phase, 4 metric cards (volume, avg tx, success rate, count), BaseScan links |
| **Civic Guards** | Inspection timeline with severity indicators, threat profiles for 4 adversarial agents, attack type badges, block status |
| **Demo** | 5-act progress indicator, per-act status cards, auto-play with configurable delay, reset with confirmation |

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

## API Surface

11 endpoints handling the full agent lifecycle.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents/register` | POST | Register agent on IdentityRegistry with Civic L1 check |
| `/api/agents/[agentId]` | GET | Fetch agent metadata and reputation |
| `/api/agents/[agentId]/a2a` | POST | Receive A2A task request, execute via agent role, return proof |
| `/api/civic/inspect` | POST | Layer 1 identity or Layer 2 behavioral inspection |
| `/api/payments/x402` | POST | HTTP 402 challenge-response, settle USDC, return tx hash |
| `/api/reputation/compute` | POST | Trigger full 7-stage pipeline for feedback event |
| `/api/reputation/scores` | GET | Fetch all agent scores sorted |
| `/api/feedback/submit` | POST | Record on-chain feedback via FeedbackGiven event |
| `/api/demo/[act]` | POST | Execute specific demo act (1-5) |
| `/api/demo/reset` | POST | Clear all state, reset to act 0 |
| `/api/events/stream` | GET | SSE endpoint, emits events since cursor |

## Seed Engine

Deterministic data generation system for reproducible demo runs. Not mocked data: structured configurations that drive real protocol interactions.

- **28 agent profiles** with wallets, domains, capabilities, pricing, and behavioral configs
- **211 interaction configs** organized across 5 phases with prerequisite chains
- **5 phase scenarios** with trigger conditions and reputation thresholds
- **Adversarial choreography**: X1's pivot from legitimate to malicious, X2-X4 Sybil ring formation with circular payment patterns
- **State machine engine**: Registration, interaction dispatch, reputation computation with deterministic phase progression

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Runtime | Bun |
| Chain | Base Sepolia |
| Contracts | agent0-ts SDK (ERC-8004 IdentityRegistry + ReputationRegistry) |
| Payments | x402 protocol (USDC on Base) |
| Agent Communication | Google A2A (JSON-RPC over HTTP) |
| Agent Tools | MCP (Model Context Protocol) |
| AI Guardrails | Civic MCP (identity + behavioral layers) |
| AI Models | Claude (Anthropic SDK) for reasoning, negotiation, reputation synthesis |
| IPFS | Pinata (explanations, metadata URIs) |
| Cache/Events | Vercel KV (Upstash Redis) |
| State | Zustand |
| Visualization | react-force-graph-2d (canvas, 60fps) |
| Animation | Framer Motion |
| Icons | HugeIcons |
| Typography | Red Hat Display (headings) + Geist Mono (code) |
| Validation | Zod |
| Testing | Vitest + Testing Library + Playwright |
| Monitoring | Sentry |
| Deployment | Vercel |

## Project Stats

- **28 agents** across 20+ domains
- **211 transactions** across 5 phases
- **7-stage** reputation pipeline
- **4 attack vectors** detected (prompt injection, Sybil ring, circular payments, uniform feedback)
- **2-layer** Civic inspection (identity + behavioral)
- **5 protocols** composed into a single lifecycle
- **6 dashboard pages** + 1 demo page, all real-time
- **11 API routes** handling the full agent lifecycle
- **Zero mocks**: every interaction is real (on-chain, IPFS, Claude API, USDC settlement)

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Run development server
bun dev

# Run tests
bun test

# Build for production
bun run build
```

Required environment variables: `ANTHROPIC_API_KEY`, `BASE_SEPOLIA_RPC_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `PINATA_JWT`, `NEXT_PUBLIC_BASE_SCAN_URL`, and wallet private keys for 4 agents + system.
