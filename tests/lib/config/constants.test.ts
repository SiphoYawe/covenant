import { describe, it, expect } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, DEFAULT_TIMEOUT_MS, MAX_RETRY_COUNT } from '@/lib/config/constants';
import { IDENTITY_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ADDRESS } from '@/lib/config/contracts';

describe('Constants', () => {
  it('BASE_SEPOLIA_CHAIN_ID is 84532', () => {
    expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
  });

  it('DEFAULT_TIMEOUT_MS is a positive number', () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('MAX_RETRY_COUNT is a positive integer', () => {
    expect(MAX_RETRY_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_RETRY_COUNT)).toBe(true);
  });
});

describe('Contract Addresses', () => {
  it('IDENTITY_REGISTRY_ADDRESS is a hex string', () => {
    expect(IDENTITY_REGISTRY_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('REPUTATION_REGISTRY_ADDRESS is a hex string', () => {
    expect(REPUTATION_REGISTRY_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});
