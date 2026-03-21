import type {
  SeedInteraction,
  SeedPhase,
  InteractionValidationResult,
} from './types';
import { REQUESTER_BUDGETS } from './types';
import { AGENT_ROSTER } from './agents';

// ──────────────────────────────────────────
// Helper to build interactions compactly
// ──────────────────────────────────────────

function ix(
  phase: SeedPhase,
  seq: number,
  requester: string,
  provider: string,
  usdc: number,
  outcome: SeedInteraction['outcome'],
  cap: string,
  desc: string,
  opts?: Partial<Pick<SeedInteraction, 'isMalicious' | 'notes' | 'civicFlags' | 'isSybilRing'>>,
): SeedInteraction {
  return {
    id: `${phase}-${String(seq).padStart(3, '0')}`,
    phase,
    sequenceNumber: seq,
    requester,
    provider,
    usdcAmount: usdc,
    outcome,
    capabilityRequired: cap,
    description: desc,
    ...opts,
  };
}

// ══════════════════════════════════════════
// PHASE A: BOOTSTRAP (40 txs, all positive)
// Budget spent: R1=15, R2=14, R3=15, R4=10, R5=7, R6=4, R7=10
// Total: 75 USDC
// ══════════════════════════════════════════

const PHASE_A: SeedInteraction[] = [
  // R1 NexusResearch (6 txs, 15 USDC)
  ix('A', 1, 'R1', 'S1', 5, 'positive', 'code-review', 'Review the authentication middleware for the Covenant agent registration API endpoint'),
  ix('A', 2, 'R1', 'S3', 2, 'positive', 'summarization', 'Summarize the ERC-8004 specification focusing on the appendResponse mechanism and reputation storage'),
  ix('A', 3, 'R1', 'S5', 3, 'positive', 'data-analysis', 'Analyze registration patterns across ERC-8004 agents on Base Sepolia over the past 30 days'),
  ix('A', 4, 'R1', 'S8', 3, 'positive', 'risk-forecasting', 'Assess risk factors for integrating Claude AI with on-chain reputation scoring systems'),
  ix('A', 5, 'R1', 'S3', 1, 'positive', 'summarization', 'Create a TLDR of the latest Base network governance proposal on fee structure changes'),
  ix('A', 6, 'R1', 'S5', 1, 'positive', 'data-analysis', 'Chart the daily USDC transaction volume trends on Base Sepolia for the current month'),

  // R2 DeFiGuard (6 txs, 14 USDC)
  ix('A', 7, 'R2', 'S2', 4, 'positive', 'smart-contract-audit', 'Audit the IdentityRegistry contract for reentrancy vulnerabilities in the register function'),
  ix('A', 8, 'R2', 'S11', 3, 'positive', 'on-chain-analytics', 'Trace recent large USDC transfers on Base Sepolia and flag anomalous patterns'),
  ix('A', 9, 'R2', 'S14', 3, 'positive', 'gas-optimization', 'Optimize gas usage for batch agent registration transactions on the ERC-8004 registry'),
  ix('A', 10, 'R2', 'S16', 2, 'positive', 'mev-analysis', 'Scan the Base Sepolia mempool for potential frontrunning on agent registration transactions'),
  ix('A', 11, 'R2', 'S2', 1, 'positive', 'vulnerability-scan', 'Quick scan of the ERC-721 token approval patterns in the agent identity registry'),
  ix('A', 12, 'R2', 'S11', 1, 'positive', 'on-chain-analytics', 'Profile the top 10 most active agent wallets on the ERC-8004 registry by transaction count'),

  // R3 ContentDAO (8 txs, 15 USDC)
  ix('A', 13, 'R3', 'S3', 2, 'positive', 'summarization', 'Summarize the Optimism RetroPGF Round 4 results focusing on impact metrics and funding allocation'),
  ix('A', 14, 'R3', 'S6', 2, 'positive', 'sentiment-analysis', 'Analyze Twitter sentiment around the Base ecosystem launch and developer adoption trends'),
  ix('A', 15, 'R3', 'S7', 3, 'positive', 'content-generation', 'Write a blog post explaining how ERC-8004 enables trustless agent-to-agent commerce on Base'),
  ix('A', 16, 'R3', 'S4', 2, 'positive', 'translation', 'Translate the Covenant project overview document from English to Spanish for the LATAM community'),
  ix('A', 17, 'R3', 'S3', 2, 'positive', 'summarization', 'Extract key points from the Ethereum Foundation blog post on account abstraction roadmap'),
  ix('A', 18, 'R3', 'S6', 1, 'positive', 'sentiment-analysis', 'Monitor Discord sentiment in the Base Builders channel over the past week'),
  ix('A', 19, 'R3', 'S7', 2, 'positive', 'content-generation', 'Draft a Twitter thread explaining the benefits of on-chain agent reputation for DeFi users'),
  ix('A', 20, 'R3', 'S4', 1, 'positive', 'translation', 'Localize the Covenant FAQ section for the Japanese crypto community'),

  // R4 DataVault (6 txs, 10 USDC)
  ix('A', 21, 'R4', 'S5', 2, 'positive', 'data-analysis', 'Analyze the distribution of USDC holdings across agent wallets registered on ERC-8004'),
  ix('A', 22, 'R4', 'S10', 1, 'positive', 'image-classification', 'Classify NFT profile images used by registered agents into category taxonomies'),
  ix('A', 23, 'R4', 'S11', 2, 'positive', 'on-chain-analytics', 'Map token flow patterns between agent wallets and DeFi protocols on Base Sepolia'),
  ix('A', 24, 'R4', 'S15', 2, 'positive', 'token-analysis', 'Review the tokenomics of the USDC stablecoin on Base including bridge liquidity depth'),
  ix('A', 25, 'R4', 'S5', 2, 'positive', 'data-analysis', 'Build a correlation chart between agent registration volume and USDC transfer activity'),
  ix('A', 26, 'R4', 'S10', 1, 'positive', 'image-classification', 'Label and categorize screenshots of agent dashboard interfaces for UX analysis'),

  // R5 GovLens (5 txs, 7 USDC)
  ix('A', 27, 'R5', 'S9', 2, 'positive', 'legal-review', 'Review the terms of service for the Covenant agent marketplace for regulatory compliance'),
  ix('A', 28, 'R5', 'S6', 1, 'positive', 'sentiment-analysis', 'Gauge community sentiment on proposed DAO governance changes for agent fee structures'),
  ix('A', 29, 'R5', 'S12', 2, 'positive', 'documentation', 'Write documentation for the governance voting process in the Covenant agent ecosystem'),
  ix('A', 30, 'R5', 'S6', 1, 'positive', 'sentiment-analysis', 'Analyze forum discussions about agent registration requirements and KYC proposals'),
  ix('A', 31, 'R5', 'S12', 1, 'positive', 'documentation', 'Create a changelog documenting governance parameter changes in the past quarter'),

  // R6 ChainBrief (4 txs, 4 USDC)
  ix('A', 32, 'R6', 'S3', 1, 'positive', 'summarization', 'Summarize the weekly Base ecosystem roundup including new protocol launches and TVL changes'),
  ix('A', 33, 'R6', 'S7', 1, 'positive', 'content-generation', 'Draft a concise news brief about the ERC-8004 standard adoption milestones'),
  ix('A', 34, 'R6', 'S17', 1, 'positive', 'fast-summarization', 'Quick TLDR of the Coinbase quarterly earnings report focusing on Base metrics'),
  ix('A', 35, 'R6', 'S17', 1, 'positive', 'fast-summarization', 'Rapid summary of overnight crypto market movements and notable token price changes'),

  // R7 BuilderHub (5 txs, 10 USDC)
  ix('A', 36, 'R7', 'S1', 2, 'positive', 'code-review', 'Review the agent-to-agent communication module for proper error handling and retry logic'),
  ix('A', 37, 'R7', 'S13', 2, 'positive', 'qa-testing', 'Generate a test suite for the x402 payment integration covering edge cases and failure modes'),
  ix('A', 38, 'R7', 'S14', 2, 'positive', 'gas-optimization', 'Analyze gas costs for the ERC-8004 appendResponse function and suggest optimizations'),
  ix('A', 39, 'R7', 'S1', 2, 'positive', 'code-review', 'Review the Zustand store implementation for the agent dashboard state management'),
  ix('A', 40, 'R7', 'S13', 1, 'positive', 'qa-testing', 'Create unit tests for the wallet generation module covering key derivation and validation'),
];

// ══════════════════════════════════════════
// PHASE B: DIFFERENTIATION (50 txs)
// Budget spent: R1=30, R2=22, R3=12, R4=10, R5=6, R6=7, R7=8
// Total: 95 USDC
// ══════════════════════════════════════════

const PHASE_B: SeedInteraction[] = [
  // R1 repeat business + cross-domain (8 txs, 30 USDC)
  ix('B', 1, 'R1', 'S1', 6, 'positive', 'code-review', 'Review the reputation aggregation engine for correct stake-weighted scoring implementation'),
  ix('B', 2, 'R1', 'S1', 7, 'positive', 'code-review', 'Audit the trust graph propagation algorithm for edge cases in cyclic dependency handling'),
  ix('B', 3, 'R1', 'S1', 8, 'positive', 'code-review', 'Deep security review of the Civic MCP integration layer for authentication bypass vulnerabilities'),
  ix('B', 4, 'R1', 'S2', 3, 'positive', 'smart-contract-audit', 'Audit the appendResponse function in the ERC-8004 registry for access control issues'),
  ix('B', 5, 'R1', 'S4', 2, 'positive', 'translation', 'Translate the Covenant technical whitepaper abstract into Mandarin for Asian market outreach'),
  ix('B', 6, 'R1', 'S11', 2, 'positive', 'on-chain-analytics', 'Trace the flow of USDC through the x402 payment channel across all registered agents'),
  ix('B', 7, 'R1', 'S3', 1, 'positive', 'summarization', 'Summarize the latest Flashbots research paper on MEV redistribution mechanisms'),
  ix('B', 8, 'R1', 'S17', 1, 'positive', 'fast-summarization', 'Quick TLDR of the Ethereum core devs call notes focusing on EOF and Verkle tree updates'),

  // R2 rehires + cross-domain (8 txs, 22 USDC)
  ix('B', 9, 'R2', 'S2', 5, 'positive', 'smart-contract-audit', 'Formal verification review of the agent staking contract for integer overflow edge cases'),
  ix('B', 10, 'R2', 'S2', 4, 'positive', 'smart-contract-audit', 'Comprehensive audit of the USDC transfer logic in the x402 payment settlement module'),
  ix('B', 11, 'R2', 'S1', 4, 'positive', 'code-review', 'Cross-domain code review of the reputation score synthesis function for numerical stability'),
  ix('B', 12, 'R2', 'S8', 2, 'positive', 'risk-forecasting', 'Model the financial risk of agent default scenarios in the Covenant payment system'),
  ix('B', 13, 'R2', 'S16', 2, 'positive', 'mev-analysis', 'Detect potential MEV extraction vectors in the agent transaction settlement flow'),
  ix('B', 14, 'R2', 'S3', 1, 'positive', 'summarization', 'Summarize the OpenZeppelin security advisory on proxy upgrade vulnerabilities'),
  ix('B', 15, 'R2', 'S12', 1, 'positive', 'documentation', 'Document the security incident response playbook for the DeFi protocol integration'),
  ix('B', 16, 'R2', 'S15', 1, 'positive', 'token-analysis', 'Quick analysis of USDC depeg risk factors and stablecoin reserve composition'),

  // R3 volume buying + quality competition (10 txs, 12 USDC)
  ix('B', 17, 'R3', 'S3', 2, 'positive', 'summarization', 'Summarize the Uniswap v4 hook system documentation for content creators and developers'),
  ix('B', 18, 'R3', 'S17', 1, 'mixed', 'fast-summarization', 'Quick summary of the Aave governance proposal on GHO stablecoin interest rate changes', { notes: 'S17 delivers fast but misses nuance, mixed quality' }),
  ix('B', 19, 'R3', 'S6', 1, 'positive', 'sentiment-analysis', 'Track sentiment shifts around the Arbitrum airdrop announcement across social platforms'),
  ix('B', 20, 'R3', 'S7', 2, 'positive', 'content-generation', 'Write an explainer article on how AI agents use reputation scores to negotiate service prices'),
  ix('B', 21, 'R3', 'S4', 1, 'positive', 'translation', 'Translate the Covenant user guide introduction section into Korean for the Korean community'),
  ix('B', 22, 'R3', 'S3', 1, 'positive', 'summarization', 'Extract key takeaways from the Messari quarterly DeFi report on lending protocol growth'),
  ix('B', 23, 'R3', 'S6', 1, 'positive', 'sentiment-analysis', 'Analyze Reddit sentiment in r/ethereum about the Dencun upgrade impact on L2 costs'),
  ix('B', 24, 'R3', 'S7', 1, 'positive', 'content-generation', 'Create a social media post announcing the Covenant beta launch with key feature highlights'),
  ix('B', 25, 'R3', 'S10', 1, 'positive', 'image-classification', 'Categorize agent profile avatars by style type for the marketplace visual consistency report'),
  ix('B', 26, 'R3', 'S12', 1, 'positive', 'documentation', 'Write a brief contributor guide for the ContentDAO open-source documentation project'),

  // R4 analytics + cross-domain (7 txs, 10 USDC)
  ix('B', 27, 'R4', 'S5', 2, 'positive', 'data-analysis', 'Analyze the price discovery patterns in agent service negotiations using x402 payment data'),
  ix('B', 28, 'R4', 'S11', 2, 'positive', 'on-chain-analytics', 'Profile wallet interaction patterns between top-rated agents and their repeat customers'),
  ix('B', 29, 'R4', 'S15', 1, 'positive', 'token-analysis', 'Evaluate liquidity depth for USDC on Base DEXes and its impact on agent payment settlement'),
  ix('B', 30, 'R4', 'S8', 1, 'positive', 'risk-forecasting', 'Model volatility scenarios for ETH gas prices and their effect on agent transaction costs'),
  ix('B', 31, 'R4', 'S10', 1, 'positive', 'image-classification', 'Detect chart patterns in agent reputation score time-series visualizations'),
  ix('B', 32, 'R4', 'S5', 1, 'positive', 'data-analysis', 'Calculate the Gini coefficient of agent earnings distribution across all service providers'),
  ix('B', 33, 'R4', 'S15', 1, 'positive', 'token-analysis', 'Track USDC velocity metrics across the Covenant payment network for the past 7 days'),

  // R5 governance focus (5 txs, 6 USDC)
  ix('B', 34, 'R5', 'S9', 2, 'positive', 'legal-review', 'Review the legal implications of on-chain reputation scoring under EU AI Act requirements'),
  ix('B', 35, 'R5', 'S6', 1, 'positive', 'sentiment-analysis', 'Monitor governance forum sentiment on the proposal to increase minimum agent stake requirements'),
  ix('B', 36, 'R5', 'S12', 1, 'positive', 'documentation', 'Document the decision framework for agent dispute resolution in governance proceedings'),
  ix('B', 37, 'R5', 'S3', 1, 'positive', 'summarization', 'Summarize the MakerDAO endgame governance restructuring and its lessons for agent DAOs'),
  ix('B', 38, 'R5', 'S6', 1, 'positive', 'sentiment-analysis', 'Analyze community reactions to the proposed agent fee redistribution mechanism'),

  // R6 budget explorer (7 txs, 7 USDC)
  ix('B', 39, 'R6', 'S3', 1, 'positive', 'summarization', 'Summarize breaking news about the SEC ruling on decentralized exchange classification'),
  ix('B', 40, 'R6', 'S17', 1, 'positive', 'fast-summarization', 'Rapid TLDR of the Binance monthly market report focusing on stablecoin flows'),
  ix('B', 41, 'R6', 'S3', 1, 'positive', 'summarization', 'Condense the Chainalysis crypto crime mid-year report into a 3-paragraph brief'),
  ix('B', 42, 'R6', 'S17', 1, 'mixed', 'fast-summarization', 'Quick summary of the Polygon zkEVM upgrade announcement and compatibility changes', { notes: 'S17 too terse, missing critical technical details' }),
  ix('B', 43, 'R6', 'S7', 1, 'positive', 'content-generation', 'Write a headline and subheading for a news article about rising agent registration on Base'),
  ix('B', 44, 'R6', 'S6', 1, 'positive', 'sentiment-analysis', 'Quick sentiment check on crypto Twitter reactions to the latest Federal Reserve rate decision'),
  ix('B', 45, 'R6', 'S10', 1, 'mixed', 'image-classification', 'Classify trending NFT collection screenshots by visual style for the weekly roundup', { notes: 'S10 budget quality, some misclassifications' }),

  // R7 dev tools (5 txs, 8 USDC)
  ix('B', 46, 'R7', 'S1', 2, 'positive', 'code-review', 'Review the SSE event streaming implementation for real-time dashboard updates'),
  ix('B', 47, 'R7', 'S13', 1, 'positive', 'qa-testing', 'Generate integration tests for the A2A agent discovery and negotiation protocol flow'),
  ix('B', 48, 'R7', 'S14', 1, 'positive', 'gas-optimization', 'Optimize calldata encoding for batch reputation score write-back transactions'),
  ix('B', 49, 'R7', 'S13', 1, 'positive', 'qa-testing', 'Write edge case tests for the USDC consolidation transfer calculation logic'),
  ix('B', 50, 'R7', 'S12', 1, 'positive', 'documentation', 'Document the API endpoints for the agent discovery service with request and response examples'),
];

// ══════════════════════════════════════════
// PHASE C: ADVERSARIAL ENTRY (30 txs)
// Budget spent: R1=10, R2=8, R3=2, R4=2, R5=4, R6=3, R7=4
// Adversarial: X2=9, X3=9, X4=9
// Total: 60 USDC
// ══════════════════════════════════════════

const PHASE_C: SeedInteraction[] = [
  // X1 legitimate entry (4 txs, providers get paid)
  ix('C', 1, 'R7', 'X1', 2, 'positive', 'code-review', 'Review the WebSocket connection handler for proper cleanup on client disconnect'),
  ix('C', 2, 'R7', 'X1', 2, 'positive', 'code-review', 'Analyze the error boundary implementation in the React dashboard components'),
  ix('C', 3, 'R4', 'X1', 2, 'positive', 'code-review', 'Review the data pipeline transformation functions for type safety and null handling'),
  ix('C', 4, 'R3', 'X1', 2, 'positive', 'code-review', 'Check the content rendering component for XSS vulnerabilities in user-generated markdown'),

  // Sybil ring circular payments: X2->X3, X3->X4, X4->X2 (9 txs, 3 cycles)
  ix('C', 5, 'X2', 'X3', 2, 'positive', 'summarization', 'Summarize the recent token listing announcements on major centralized exchanges', { isSybilRing: true, notes: 'Sybil ring cycle 1 step 1' }),
  ix('C', 6, 'X3', 'X4', 2, 'positive', 'data-analysis', 'Analyze trading volume patterns for newly listed tokens across DEX aggregators', { isSybilRing: true, notes: 'Sybil ring cycle 1 step 2' }),
  ix('C', 7, 'X4', 'X2', 2, 'positive', 'summarization', 'Create a brief overview of the top-performing DeFi protocols by TVL growth this month', { isSybilRing: true, notes: 'Sybil ring cycle 1 step 3' }),
  ix('C', 8, 'X2', 'X3', 2, 'positive', 'summarization', 'Summarize the latest cross-chain bridge security audit findings and recommendations', { isSybilRing: true, notes: 'Sybil ring cycle 2 step 1' }),
  ix('C', 9, 'X3', 'X4', 2, 'positive', 'data-analysis', 'Review staking reward distribution data across major proof-of-stake networks', { isSybilRing: true, notes: 'Sybil ring cycle 2 step 2' }),
  ix('C', 10, 'X4', 'X2', 2, 'positive', 'summarization', 'Compile a summary of regulatory developments affecting DeFi protocols in Q1 2026', { isSybilRing: true, notes: 'Sybil ring cycle 2 step 3' }),
  ix('C', 11, 'X2', 'X3', 2, 'positive', 'summarization', 'Summarize the key outcomes from the latest Ethereum All Core Devs call on Pectra upgrade', { isSybilRing: true, notes: 'Sybil ring cycle 3 step 1' }),
  ix('C', 12, 'X3', 'X4', 2, 'positive', 'data-analysis', 'Analyze gas consumption trends on Base Sepolia following the latest protocol upgrade', { isSybilRing: true, notes: 'Sybil ring cycle 3 step 2' }),
  ix('C', 13, 'X4', 'X2', 2, 'positive', 'summarization', 'Brief overview of NFT marketplace volume comparison across Ethereum, Base, and Solana', { isSybilRing: true, notes: 'Sybil ring cycle 3 step 3' }),

  // Reputation farming (9 txs, mutual boosting)
  ix('C', 14, 'X2', 'X4', 1, 'positive', 'code-review', 'Review the token transfer helper function for proper balance validation checks'),
  ix('C', 15, 'X3', 'X2', 1, 'positive', 'summarization', 'Summarize the changelog for the latest Hardhat release and new features'),
  ix('C', 16, 'X4', 'X3', 1, 'positive', 'data-analysis', 'Quick analysis of gas price trends on Ethereum mainnet over the past 24 hours'),
  ix('C', 17, 'X2', 'X4', 1, 'positive', 'summarization', 'Brief summary of the OpenAI partnership announcements related to blockchain tooling'),
  ix('C', 18, 'X3', 'X2', 1, 'positive', 'summarization', 'Compile a list of new ERC proposals submitted in the past month with short descriptions'),
  ix('C', 19, 'X4', 'X3', 1, 'positive', 'data-analysis', 'Tabulate the validator count changes across major L2 networks for the week'),
  ix('C', 20, 'X2', 'X4', 1, 'positive', 'code-review', 'Check the event emitter utility for proper listener cleanup on component unmount'),
  ix('C', 21, 'X3', 'X2', 1, 'positive', 'summarization', 'Quick recap of the latest Solidity compiler release notes and breaking changes'),
  ix('C', 22, 'X4', 'X3', 1, 'positive', 'data-analysis', 'Count active addresses interacting with the top 5 Base DeFi protocols today'),

  // X4 undercutting legitimate providers (4 txs)
  ix('C', 23, 'R5', 'X4', 2, 'mixed', 'code-review', 'Review the governance proposal submission smart contract for access control flaws', { notes: 'X4 undercuts S1 at 2 USDC vs 5+. Technically valid but shallow review.' }),
  ix('C', 24, 'R5', 'X4', 2, 'mixed', 'summarization', 'Summarize the DAO treasury management best practices document for governance voters', { notes: 'X4 undercuts S3. Minimal effort, technically passes.' }),
  ix('C', 25, 'R6', 'X4', 2, 'mixed', 'code-review', 'Quick review of the news aggregation script for input sanitization issues', { notes: 'X4 undercuts S1. Budget requester attracted by low price.' }),
  ix('C', 26, 'R6', 'X4', 1, 'mixed', 'summarization', 'Rapid summary of the CoinDesk consensus conference keynote highlights', { notes: 'X4 undercuts S17 at 1 USDC. Bare minimum output.' }),

  // Continued legitimate commerce (4 txs)
  ix('C', 27, 'R1', 'S1', 5, 'positive', 'code-review', 'Review the Sybil detection graph algorithm for correctness in cycle identification'),
  ix('C', 28, 'R1', 'S2', 5, 'positive', 'smart-contract-audit', 'Audit the on-chain reputation write-back mechanism for unauthorized access vectors'),
  ix('C', 29, 'R2', 'S2', 4, 'positive', 'smart-contract-audit', 'Security review of the USDC allowance management in the payment escrow module'),
  ix('C', 30, 'R2', 'S16', 4, 'positive', 'mev-analysis', 'Analyze potential sandwich attack vectors on large reputation score update transactions'),
];

// ══════════════════════════════════════════
// PHASE D: DETECTION & CONSEQUENCES (40 txs)
// Budget spent: R1=22, R2=17, R3=10, R4=10, R5=6, R6=5, R7=8
// Total: 78 USDC (+ 0 for rejected txs)
// ══════════════════════════════════════════

const PHASE_D: SeedInteraction[] = [
  // Malicious delivery (2 txs, X1 delivers malicious payloads)
  ix('D', 1, 'R1', 'X1', 4, 'negative', 'code-review', 'Review the access control implementation in the agent registry for privilege escalation risks', { isMalicious: true, civicFlags: ['prompt-injection', 'malicious-suggestion'], notes: 'X1 delivers review suggesting removal of access controls as optimization. Civic L2 catches.' }),
  ix('D', 2, 'R7', 'X1', 3, 'negative', 'code-review', 'Audit the credential management module for secure storage best practices', { isMalicious: true, civicFlags: ['prompt-injection', 'credential-exposure'], notes: 'X1 suggests hardcoding API keys for simplicity. Civic L2 catches prompt injection.' }),

  // Civic detection response (4 txs, rejected after flagging)
  ix('D', 3, 'R1', 'X1', 0, 'rejected', 'code-review', 'Attempted hire of ShadowReview for smart contract review, rejected due to Civic critical flag', { notes: 'R1 attempts to hire X1 again but Civic flag prevents engagement' }),
  ix('D', 4, 'R2', 'X1', 0, 'rejected', 'code-review', 'Attempted hire of ShadowReview for security audit, rejected due to active Civic violation', { notes: 'R2 routing blocked by Civic L2 flag on X1' }),
  ix('D', 5, 'R3', 'X2', 0, 'rejected', 'summarization', 'Attempted hire of EchoNode for content summary, rejected due to Sybil ring detection', { notes: 'X2 flagged as Sybil ring member after graph analysis' }),
  ix('D', 6, 'R4', 'X3', 0, 'rejected', 'data-analysis', 'Attempted hire of MirrorBot for data analysis, rejected due to Sybil ring detection', { notes: 'X3 flagged as Sybil ring member, circular payment pattern detected' }),

  // Routing exclusion (6 txs, 0 USDC)
  ix('D', 7, 'R1', 'X2', 0, 'rejected', 'summarization', 'Routing exclusion: EchoNode below 3.0 reputation threshold, hire blocked by system', { notes: 'Automated routing exclusion after Sybil detection' }),
  ix('D', 8, 'R2', 'X3', 0, 'rejected', 'data-analysis', 'Routing exclusion: MirrorBot below 3.0 reputation threshold, hire blocked by system', { notes: 'Automated routing exclusion after Sybil detection' }),
  ix('D', 9, 'R3', 'X4', 0, 'rejected', 'code-review', 'Routing exclusion: GhostAgent below 3.0 reputation threshold, hire blocked by system', { notes: 'Automated routing exclusion after Sybil and undercutting detection' }),
  ix('D', 10, 'R5', 'X1', 0, 'rejected', 'code-review', 'Routing exclusion: ShadowReview below 3.0 threshold after Civic critical flag', { notes: 'X1 completely excluded from marketplace after malicious behavior' }),
  ix('D', 11, 'R6', 'X4', 0, 'rejected', 'summarization', 'Routing exclusion: GhostAgent below 3.0 threshold after Sybil ring exposure', { notes: 'R6 previous undercutting customer, now blocked by routing' }),
  ix('D', 12, 'R7', 'X2', 0, 'rejected', 'summarization', 'Routing exclusion: EchoNode below 3.0 reputation threshold, automatic block', { notes: 'Automated system-wide exclusion of Sybil ring members' }),

  // Premium pricing emergence (8 txs, trusted providers command higher rates)
  ix('D', 13, 'R1', 'S1', 7, 'positive', 'code-review', 'Premium review of the explainable trust score generation module for algorithmic fairness'),
  ix('D', 14, 'R1', 'S2', 7, 'positive', 'smart-contract-audit', 'Premium audit of the reputation cascade mechanism for score propagation correctness'),
  ix('D', 15, 'R2', 'S1', 6, 'positive', 'code-review', 'Premium cross-domain review of the Civic MCP integration for authentication edge cases'),
  ix('D', 16, 'R2', 'S2', 4, 'positive', 'smart-contract-audit', 'Premium audit of the USDC escrow release conditions and timeout handling'),
  ix('D', 17, 'R2', 'S9', 3, 'positive', 'legal-review', 'Premium legal review of the automated agent exclusion mechanism for due process compliance'),
  ix('D', 18, 'R4', 'S2', 5, 'positive', 'smart-contract-audit', 'Premium audit of the on-chain data indexer smart contract for data integrity guarantees'),
  ix('D', 19, 'R7', 'S1', 5, 'positive', 'code-review', 'Premium review of the real-time event streaming architecture for scalability bottlenecks'),
  ix('D', 20, 'R3', 'S9', 4, 'positive', 'legal-review', 'Legal analysis of content licensing requirements for AI-generated articles in the marketplace'),

  // Mid-tier competition (8 txs, varying outcomes)
  ix('D', 21, 'R3', 'S3', 2, 'positive', 'summarization', 'Summarize the impact of Sybil detection on marketplace trust metrics and agent behavior'),
  ix('D', 22, 'R3', 'S7', 2, 'positive', 'content-generation', 'Write a case study about how Covenant detected and excluded a Sybil ring in real time'),
  ix('D', 23, 'R4', 'S5', 3, 'positive', 'data-analysis', 'Analyze the reputation score distribution shift after adversarial agent exclusion'),
  ix('D', 24, 'R4', 'S11', 2, 'mixed', 'on-chain-analytics', 'Map the on-chain transaction graph showing the X2-X3-X4 circular payment pattern', { notes: 'S11 identifies pattern but visualization lacks detail' }),
  ix('D', 25, 'R5', 'S6', 2, 'positive', 'sentiment-analysis', 'Analyze community sentiment after the Sybil ring exposure and agent exclusion events'),
  ix('D', 26, 'R5', 'S12', 1, 'positive', 'documentation', 'Document the Sybil detection algorithm workflow and threshold parameters for governance review'),
  ix('D', 27, 'R6', 'S3', 2, 'positive', 'summarization', 'Summarize the marketplace health report post-adversarial exclusion with key recovery metrics'),
  ix('D', 28, 'R6', 'S17', 1, 'positive', 'fast-summarization', 'Quick TLDR of the agent exclusion event timeline for the daily news briefing'),

  // Post-detection legitimate commerce (12 txs, ecosystem recovers)
  ix('D', 29, 'R1', 'S5', 2, 'positive', 'data-analysis', 'Analyze trust graph topology changes after adversarial node removal and edge pruning'),
  ix('D', 30, 'R1', 'S8', 2, 'positive', 'risk-forecasting', 'Model the long-term reputation recovery trajectory for the marketplace after Sybil event'),
  ix('D', 31, 'R2', 'S11', 3, 'positive', 'on-chain-analytics', 'Trace the USDC flow reversal patterns as the Sybil ring agents lost their customer base'),
  ix('D', 32, 'R2', 'S14', 2, 'positive', 'gas-optimization', 'Optimize the batch reputation update transaction to reduce gas costs for score write-back'),
  ix('D', 33, 'R3', 'S6', 1, 'positive', 'sentiment-analysis', 'Monitor social sentiment about marketplace safety improvements after the Sybil detection'),
  ix('D', 34, 'R3', 'S4', 1, 'positive', 'translation', 'Translate the Sybil detection case study into Portuguese for the Brazilian community'),
  ix('D', 35, 'R4', 'S15', 2, 'positive', 'token-analysis', 'Analyze USDC liquidity pool depth changes on Base DEXes after the marketplace cleanup'),
  ix('D', 36, 'R4', 'S10', 1, 'positive', 'image-classification', 'Classify reputation score chart patterns to identify healthy vs distressed agent profiles'),
  ix('D', 37, 'R5', 'S9', 3, 'positive', 'legal-review', 'Review the automated exclusion process for compliance with fair dealing requirements'),
  ix('D', 38, 'R6', 'S7', 2, 'positive', 'content-generation', 'Write a marketplace update post highlighting improved trust metrics after Sybil cleanup'),
  ix('D', 39, 'R7', 'S13', 2, 'positive', 'qa-testing', 'Generate regression tests for the Sybil detection pipeline to prevent false positives'),
  ix('D', 40, 'R7', 'S14', 2, 'positive', 'gas-optimization', 'Optimize the on-chain write-back function for batch reputation updates across 28 agents'),
];

// ══════════════════════════════════════════
// PHASE E: MATURE ECOSYSTEM (50 txs)
// Budget spent: R1=23, R2=19, R3=21, R4=18, R5=7, R6=6, R7=18
// Total: 112 USDC
// ══════════════════════════════════════════

const PHASE_E: SeedInteraction[] = [
  // Continued commerce (25 txs)
  ix('E', 1, 'R1', 'S1', 6, 'positive', 'code-review', 'Comprehensive review of the full reputation engine codebase for production readiness'),
  ix('E', 2, 'R1', 'S2', 5, 'positive', 'smart-contract-audit', 'Final security audit of all smart contract interactions before mainnet deployment consideration'),
  ix('E', 3, 'R1', 'S5', 3, 'positive', 'data-analysis', 'Generate the final analytics dashboard dataset showing ecosystem health across all metrics'),
  ix('E', 4, 'R1', 'S8', 3, 'positive', 'risk-forecasting', 'Produce the comprehensive risk assessment report for the Covenant protocol launch readiness'),
  ix('E', 5, 'R2', 'S2', 4, 'positive', 'smart-contract-audit', 'Final comprehensive audit of the entire x402 payment flow including edge case scenarios'),
  ix('E', 6, 'R2', 'S16', 3, 'positive', 'mev-analysis', 'Complete MEV exposure assessment for all Covenant transaction types on Base mainnet'),
  ix('E', 7, 'R2', 'S1', 2, 'positive', 'code-review', 'Final code review of the Civic integration security layer for production deployment'),
  ix('E', 8, 'R2', 'S14', 2, 'positive', 'gas-optimization', 'Final gas optimization pass on all production contract interactions and batch operations'),
  ix('E', 9, 'R3', 'S7', 3, 'positive', 'content-generation', 'Write the launch announcement blog post for the Covenant marketplace with feature highlights'),
  ix('E', 10, 'R3', 'S4', 3, 'positive', 'translation', 'Translate the complete marketplace user guide into Spanish, Mandarin, and Japanese summaries'),
  ix('E', 11, 'R3', 'S3', 2, 'positive', 'summarization', 'Create the executive summary of the Covenant ecosystem report for investor presentations'),
  ix('E', 12, 'R3', 'S6', 2, 'positive', 'sentiment-analysis', 'Final sentiment analysis of the crypto community reception to the Covenant launch teasers'),
  ix('E', 13, 'R4', 'S5', 3, 'positive', 'data-analysis', 'Generate the comprehensive agent interaction graph dataset for the final dashboard visualization'),
  ix('E', 14, 'R4', 'S11', 2, 'positive', 'on-chain-analytics', 'Produce the final on-chain analytics report covering all 210 transactions and USDC flows'),
  ix('E', 15, 'R4', 'S15', 1, 'positive', 'token-analysis', 'Complete tokenomics assessment of the USDC flow patterns within the Covenant ecosystem'),
  ix('E', 16, 'R5', 'S9', 2, 'positive', 'legal-review', 'Final compliance review of the entire Covenant platform against current regulatory frameworks'),
  ix('E', 17, 'R5', 'S12', 2, 'positive', 'documentation', 'Write the governance documentation for the Covenant DAO proposal submission process'),
  ix('E', 18, 'R6', 'S3', 2, 'positive', 'summarization', 'Create the final weekly ecosystem roundup summarizing the complete Covenant beta period'),
  ix('E', 19, 'R6', 'S17', 1, 'positive', 'fast-summarization', 'Quick TLDR of the Covenant beta metrics for the closing news brief'),
  ix('E', 20, 'R7', 'S1', 2, 'positive', 'code-review', 'Final production readiness review of the complete Covenant backend codebase'),
  ix('E', 21, 'R7', 'S13', 2, 'positive', 'qa-testing', 'Generate the final integration test suite covering all critical user flows end-to-end'),
  ix('E', 22, 'R7', 'S14', 2, 'positive', 'gas-optimization', 'Final gas report comparing optimized vs unoptimized transaction costs across all operations'),
  ix('E', 23, 'R3', 'S12', 2, 'positive', 'documentation', 'Write the API reference documentation for the Covenant agent interaction endpoints'),
  ix('E', 24, 'R4', 'S10', 2, 'positive', 'image-classification', 'Classify all agent profile images and reputation badge designs for the production launch'),
  ix('E', 25, 'R4', 'S8', 2, 'positive', 'risk-forecasting', 'Model the long-term economic sustainability of the agent reputation marketplace'),

  // Trust graph maturity (10 txs, cross-cluster, multi-hop)
  ix('E', 26, 'R1', 'S9', 2, 'positive', 'legal-review', 'Cross-domain: legal review of the AI reputation scoring methodology for bias compliance'),
  ix('E', 27, 'R1', 'S13', 2, 'positive', 'qa-testing', 'Cross-domain: test generation for the reputation explanation natural language module'),
  ix('E', 28, 'R2', 'S5', 3, 'positive', 'data-analysis', 'Cross-domain: statistical analysis of attack detection false positive rates in the system'),
  ix('E', 29, 'R3', 'S11', 2, 'positive', 'on-chain-analytics', 'Cross-domain: trace the complete payment flow graph for the content creation supply chain'),
  ix('E', 30, 'R4', 'S9', 2, 'positive', 'legal-review', 'Cross-domain: compliance review of automated data collection practices in analytics pipeline'),
  ix('E', 31, 'R5', 'S5', 1, 'positive', 'data-analysis', 'Cross-domain: data analysis of governance participation rates across agent categories'),
  ix('E', 32, 'R6', 'S12', 1, 'positive', 'documentation', 'Cross-domain: write documentation for the news API integration with agent reputation feeds'),
  ix('E', 33, 'R7', 'S8', 1, 'positive', 'risk-forecasting', 'Cross-domain: risk model for developer tool dependency on agent marketplace availability'),
  ix('E', 34, 'R3', 'S15', 2, 'positive', 'token-analysis', 'Multi-hop trust: token analysis of USDC flow patterns through the content creator network'),
  ix('E', 35, 'R4', 'S4', 2, 'positive', 'translation', 'Multi-hop trust: translate the analytics dashboard labels into 3 languages for global users'),

  // New agent entry (5 txs, new pairings)
  ix('E', 36, 'R1', 'S12', 1, 'positive', 'documentation', 'New pairing: documentation for the research methodology used in reputation analysis'),
  ix('E', 37, 'R2', 'S7', 2, 'positive', 'content-generation', 'New pairing: write a security advisory template for DeFi protocol vulnerability disclosures'),
  ix('E', 38, 'R5', 'S7', 1, 'positive', 'content-generation', 'New pairing: draft the governance newsletter covering quarterly agent ecosystem changes'),
  ix('E', 39, 'R6', 'S4', 1, 'positive', 'translation', 'New pairing: translate breaking crypto news headlines into Spanish for LATAM distribution'),
  ix('E', 40, 'R5', 'S13', 1, 'positive', 'qa-testing', 'New pairing: generate tests for the governance proposal validation smart contract logic'),

  // Final snapshot (10 txs, high-value across top providers)
  ix('E', 41, 'R3', 'S7', 3, 'positive', 'content-generation', 'Snapshot: write the definitive Covenant ecosystem overview for the project showcase page'),
  ix('E', 42, 'R3', 'S3', 1, 'positive', 'summarization', 'Snapshot: create the final summary of all marketplace statistics and achievement milestones'),
  ix('E', 43, 'R4', 'S5', 2, 'positive', 'data-analysis', 'Snapshot: generate the final data visualization dataset for the trust graph rendering engine'),
  ix('E', 44, 'R7', 'S1', 1, 'positive', 'code-review', 'Snapshot: final review of the trust graph visualization component for rendering correctness'),
  ix('E', 45, 'R7', 'S14', 1, 'positive', 'gas-optimization', 'Snapshot: final gas analysis comparing Base Sepolia costs with projected mainnet estimates'),
  ix('E', 46, 'R2', 'S8', 2, 'positive', 'risk-forecasting', 'Snapshot: final risk assessment summary for the Covenant protocol security posture report'),
  ix('E', 47, 'R2', 'S11', 2, 'positive', 'on-chain-analytics', 'Snapshot: final on-chain transaction summary covering all phases with volume breakdowns'),
  ix('E', 48, 'R6', 'S6', 1, 'positive', 'sentiment-analysis', 'Snapshot: final community sentiment report capturing the overall Covenant reception'),
  ix('E', 49, 'R3', 'S6', 1, 'positive', 'sentiment-analysis', 'Snapshot: final social media engagement metrics for all Covenant-related content pieces'),
  ix('E', 50, 'R1', 'S3', 1, 'positive', 'summarization', 'Snapshot: final TLDR of the entire Covenant beta period for the project retrospective'),
];

// ──────────────────────────────────────────
// ALL INTERACTIONS
// ──────────────────────────────────────────

export const ALL_INTERACTIONS: SeedInteraction[] = [
  ...PHASE_A,
  ...PHASE_B,
  ...PHASE_C,
  ...PHASE_D,
  ...PHASE_E,
];

// ──────────────────────────────────────────
// Query Functions
// ──────────────────────────────────────────

const interactionIndex = new Map<string, SeedInteraction>(
  ALL_INTERACTIONS.map((ix) => [ix.id, ix])
);

export function getPhaseInteractions(phase: SeedPhase): SeedInteraction[] {
  return ALL_INTERACTIONS
    .filter((ix) => ix.phase === phase)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

export function getInteractionById(id: string): SeedInteraction | undefined {
  return interactionIndex.get(id);
}

export function getInteractionsByAgent(agentId: string): SeedInteraction[] {
  return ALL_INTERACTIONS.filter(
    (ix) => ix.requester === agentId || ix.provider === agentId
  );
}

export function getInteractionCount(): {
  total: number;
  byPhase: Record<SeedPhase, number>;
} {
  const byPhase: Record<SeedPhase, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const interaction of ALL_INTERACTIONS) {
    byPhase[interaction.phase]++;
  }
  return { total: ALL_INTERACTIONS.length, byPhase };
}

// ──────────────────────────────────────────
// Validation
// ──────────────────────────────────────────

export function validateInteractionGraph(
  interactions: SeedInteraction[],
): InteractionValidationResult {
  const errors: string[] = [];
  const budgetSummary: Record<string, number> = {};
  const agentIds = new Set(AGENT_ROSTER.all.map((a) => a.walletName));

  // Validate agent references
  for (const interaction of interactions) {
    if (!agentIds.has(interaction.requester)) {
      errors.push(
        `Interaction ${interaction.id}: unknown requester "${interaction.requester}"`
      );
    }
    if (!agentIds.has(interaction.provider)) {
      errors.push(
        `Interaction ${interaction.id}: unknown provider "${interaction.provider}"`
      );
    }
  }

  // Validate ID uniqueness
  const ids = new Set<string>();
  for (const interaction of interactions) {
    if (ids.has(interaction.id)) {
      errors.push(`Duplicate interaction ID: ${interaction.id}`);
    }
    ids.add(interaction.id);
  }

  // Calculate budget per requester (only R1-R7)
  for (const interaction of interactions) {
    if (interaction.requester.startsWith('R')) {
      budgetSummary[interaction.requester] =
        (budgetSummary[interaction.requester] ?? 0) + interaction.usdcAmount;
    }
  }

  // Validate budget constraints
  for (const [requester, spent] of Object.entries(budgetSummary)) {
    const budget = REQUESTER_BUDGETS[requester];
    if (budget !== undefined && spent > budget) {
      errors.push(
        `Requester ${requester} budget exceeded: spent ${spent} USDC, budget is ${budget} USDC`
      );
    }
  }

  // Validate malicious flag only in Phase D
  for (const interaction of interactions) {
    if (interaction.isMalicious && interaction.phase !== 'D') {
      errors.push(
        `Interaction ${interaction.id}: isMalicious should only appear in Phase D`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    budgetSummary,
  };
}
