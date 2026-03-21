import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import { kvSet } from '@/lib/storage/kv';
import { getWallet } from '@/lib/wallets';
import { getSDK } from '@/lib/protocols/erc8004/client';

export type DeployerAttestation = {
  type: 'deployer-attestation';
  deployerAddress: string;
  linkedAt: number;
  reputationLinked: boolean;
  txHash: string;
};

/**
 * Write a deployer attestation on-chain via ERC-8004 appendResponse (giveFeedback).
 * Records that a human deployer is linked to this agent.
 */
export async function writeDeployerAttestation(
  agentId: string,
  deployerAddress: string,
): Promise<{ txHash: string }> {
  const systemWallet = getWallet('system');
  const privateKey = systemWallet.client.account.address;
  const sdk = getSDK(privateKey);

  const linkedAt = Date.now();

  const attestationPayload = JSON.stringify({
    type: 'deployer-attestation',
    deployerAddress,
    linkedAt,
    reputationLinked: true,
  });

  const tx = await sdk.giveFeedback(
    agentId,
    5, // Neutral score for attestation
    'covenant-deployer',
    'deployer-attestation',
    undefined,
    {
      text: attestationPayload,
    },
  );

  const mined = await tx.waitMined();
  const txHash = mined.receipt.transactionHash ?? tx.hash;

  // Store attestation record in KV
  const attestation: DeployerAttestation = {
    type: 'deployer-attestation',
    deployerAddress,
    linkedAt,
    reputationLinked: true,
    txHash,
  };
  await kvSet(`agent:${agentId}:deployer-attestation`, attestation);

  // Emit event
  const bus = createEventBus();
  await bus.emit({
    type: EVENT_TYPES.DEPLOYER_REPUTATION_LINKED,
    protocol: Protocol.Erc8004,
    agentId,
    data: {
      deployerAddress,
      txHash,
      linkedAt,
    },
  });

  return { txHash };
}
