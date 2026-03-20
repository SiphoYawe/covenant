import type { WalletRole } from '@/lib/wallets/types';

/** Non-system agent roles for the 4 demo agents */
export type DemoAgentRole = 'researcher' | 'reviewer' | 'summarizer' | 'malicious';

/** Configuration for a demo agent */
export type AgentConfig = {
  role: DemoAgentRole;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  walletRole: WalletRole;
};
