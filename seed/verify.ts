import type { EngineState, AgentRoster } from './types';
import { ALL_INTERACTIONS } from './interactions';
import { kvGet } from '@/lib/storage/kv';

export interface VerificationReport {
  totalAgents: number;
  totalInteractions: number;
  totalUsdcTransacted: number;
  phasesCompleted: string[];
  adversarialDetected: number;
  adversarialExcluded: number;
  agentScores: Array<{
    walletName: string;
    name: string;
    role: string;
    score: number;
    classification: string;
    interactionCount: number;
    totalEarned: number;
  }>;
  topProviders: Array<{ name: string; score: number }>;
  excludedAgents: Array<{ name: string; score: number; reason: string }>;
}

export async function generateVerificationReport(
  state: EngineState,
  agents: AgentRoster,
): Promise<VerificationReport> {
  const totalInteractions = state.completedInteractions.length;

  // Calculate total USDC transacted and per-agent stats
  let totalUsdcTransacted = 0;
  const agentEarnings = new Map<string, number>();
  const agentInteractionCounts = new Map<string, number>();

  for (const id of state.completedInteractions) {
    const interaction = ALL_INTERACTIONS.find(ix => ix.id === id);
    if (!interaction) continue;
    totalUsdcTransacted += interaction.usdcAmount;

    agentEarnings.set(
      interaction.provider,
      (agentEarnings.get(interaction.provider) ?? 0) + interaction.usdcAmount,
    );
    agentInteractionCounts.set(
      interaction.provider,
      (agentInteractionCounts.get(interaction.provider) ?? 0) + 1,
    );
  }

  // Collect scores from KV
  const agentScores: VerificationReport['agentScores'] = [];
  const excludedAgents: VerificationReport['excludedAgents'] = [];
  let adversarialDetected = 0;

  for (const [walletName, reg] of Object.entries(state.registeredAgents)) {
    const profile = agents.all.find(a => a.walletName === walletName);
    if (!profile) continue;

    const cached = await kvGet<{ score: number; explanationCID?: string | null }>(
      `agent:${reg.agentId}:reputation`,
    );
    const score = cached?.score ?? 5.0;
    const classification = score >= 8.0 ? 'trusted' : score >= 5.0 ? 'neutral' : score >= 3.0 ? 'suspicious' : 'adversarial';

    agentScores.push({
      walletName,
      name: profile.name,
      role: profile.role,
      score,
      classification,
      interactionCount: agentInteractionCounts.get(walletName) ?? 0,
      totalEarned: agentEarnings.get(walletName) ?? 0,
    });

    if (score < 3.0 && profile.role === 'adversarial') {
      adversarialDetected++;
      excludedAgents.push({
        name: profile.name,
        score,
        reason: walletName === 'X1' ? 'Civic critical flags (prompt injection)' : 'Sybil ring detection (circular payments)',
      });
    }
  }

  // Sort by score descending
  agentScores.sort((a, b) => b.score - a.score);

  const topProviders = agentScores
    .filter(a => a.role === 'provider' && a.score >= 8.0)
    .slice(0, 5)
    .map(a => ({ name: a.name, score: a.score }));

  return {
    totalAgents: Object.keys(state.registeredAgents).length,
    totalInteractions,
    totalUsdcTransacted,
    phasesCompleted: state.phasesCompleted,
    adversarialDetected,
    adversarialExcluded: excludedAgents.length,
    agentScores,
    topProviders,
    excludedAgents,
  };
}

export function printVerificationReport(report: VerificationReport): void {
  console.log('\n============================================');
  console.log('  Covenant Seed Data Verification Report');
  console.log('============================================\n');

  console.log(`  Agents registered:     ${report.totalAgents}`);
  console.log(`  Interactions executed:  ${report.totalInteractions}`);
  console.log(`  USDC transacted:       ${report.totalUsdcTransacted.toFixed(2)} USDC`);
  console.log(`  Phases completed:      ${report.phasesCompleted.join(', ')}`);
  console.log(`  Adversarial detected:  ${report.adversarialDetected}`);
  console.log(`  Adversarial excluded:  ${report.adversarialExcluded}`);

  console.log('\n  Top Providers:');
  for (const p of report.topProviders) {
    console.log(`    ${p.name}: ${p.score.toFixed(1)}/10`);
  }

  console.log('\n  Excluded Agents:');
  for (const a of report.excludedAgents) {
    console.log(`    ${a.name}: ${a.score.toFixed(1)}/10 (${a.reason})`);
  }

  console.log('\n  All Agent Scores:');
  for (const a of report.agentScores) {
    const bar = '#'.repeat(Math.round(a.score));
    const empty = '-'.repeat(10 - Math.round(a.score));
    console.log(`    ${a.walletName.padEnd(4)} ${a.name.padEnd(16)} ${bar}${empty} ${a.score.toFixed(1)}/10 [${a.classification}]`);
  }
}
