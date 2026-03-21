import { describe, it, expect, beforeEach } from 'vitest';
import { useDeployStore } from '@/stores/deploy-store';

describe('Deploy Store', () => {
  beforeEach(() => {
    useDeployStore.setState(useDeployStore.getInitialState());
  });

  describe('initial state', () => {
    it('starts with provisioned mode', () => {
      expect(useDeployStore.getState().mode).toBe('provisioned');
    });

    it('starts with idle status', () => {
      expect(useDeployStore.getState().status).toBe('idle');
    });

    it('starts with empty form data', () => {
      const { formData } = useDeployStore.getState();
      expect(formData.name).toBe('');
      expect(formData.description).toBe('');
      expect(formData.capabilities).toEqual([]);
    });

    it('starts with empty steps', () => {
      expect(useDeployStore.getState().steps).toEqual([]);
    });

    it('starts with no result or error', () => {
      expect(useDeployStore.getState().result).toBeNull();
      expect(useDeployStore.getState().error).toBeNull();
    });
  });

  describe('setMode', () => {
    it('switches to byow mode', () => {
      useDeployStore.getState().setMode('byow');
      expect(useDeployStore.getState().mode).toBe('byow');
    });

    it('switches back to provisioned mode', () => {
      useDeployStore.getState().setMode('byow');
      useDeployStore.getState().setMode('provisioned');
      expect(useDeployStore.getState().mode).toBe('provisioned');
    });
  });

  describe('updateForm', () => {
    it('updates name', () => {
      useDeployStore.getState().updateForm({ name: 'Test Agent' });
      expect(useDeployStore.getState().formData.name).toBe('Test Agent');
    });

    it('updates description', () => {
      useDeployStore.getState().updateForm({ description: 'A test agent' });
      expect(useDeployStore.getState().formData.description).toBe('A test agent');
    });

    it('updates capabilities', () => {
      useDeployStore.getState().updateForm({ capabilities: ['research', 'analysis'] });
      expect(useDeployStore.getState().formData.capabilities).toEqual(['research', 'analysis']);
    });

    it('updates wallet address', () => {
      useDeployStore.getState().updateForm({ walletAddress: '0x1234567890abcdef1234567890abcdef12345678' });
      expect(useDeployStore.getState().formData.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('merges partial updates', () => {
      useDeployStore.getState().updateForm({ name: 'Agent A' });
      useDeployStore.getState().updateForm({ description: 'Does things' });
      const { formData } = useDeployStore.getState();
      expect(formData.name).toBe('Agent A');
      expect(formData.description).toBe('Does things');
    });
  });

  describe('updateStep', () => {
    it('updates step status', () => {
      // Initialize steps first
      useDeployStore.setState({
        steps: [
          { id: 'wallet', label: 'Wallet Generated', status: 'pending' },
          { id: 'funded', label: 'Funded', status: 'pending' },
        ],
      });

      useDeployStore.getState().updateStep('wallet', 'complete');
      expect(useDeployStore.getState().steps[0].status).toBe('complete');
      expect(useDeployStore.getState().steps[1].status).toBe('pending');
    });

    it('updates step with error message', () => {
      useDeployStore.setState({
        steps: [
          { id: 'wallet', label: 'Wallet Generated', status: 'pending' },
        ],
      });

      useDeployStore.getState().updateStep('wallet', 'error', 'Failed to generate');
      const step = useDeployStore.getState().steps[0];
      expect(step.status).toBe('error');
      expect(step.error).toBe('Failed to generate');
    });
  });

  describe('setResult', () => {
    it('sets deployment result and status to success', () => {
      const result = { agentId: '0xabc', address: '0xdef', linkedReputation: false };
      useDeployStore.getState().setResult(result);
      expect(useDeployStore.getState().result).toEqual(result);
      expect(useDeployStore.getState().status).toBe('success');
    });
  });

  describe('setError', () => {
    it('sets error and status to error', () => {
      useDeployStore.getState().setError('Something went wrong');
      expect(useDeployStore.getState().error).toBe('Something went wrong');
      expect(useDeployStore.getState().status).toBe('error');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useDeployStore.getState().setMode('byow');
      useDeployStore.getState().updateForm({ name: 'Test' });
      useDeployStore.getState().setError('fail');

      useDeployStore.getState().reset();

      const state = useDeployStore.getState();
      expect(state.mode).toBe('provisioned');
      expect(state.formData.name).toBe('');
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });
  });

  describe('initSteps', () => {
    it('creates steps for provisioned mode', () => {
      useDeployStore.getState().initSteps(false);
      const steps = useDeployStore.getState().steps;
      expect(steps).toHaveLength(3);
      expect(steps[0].id).toBe('wallet');
      expect(steps[1].id).toBe('funded');
      expect(steps[2].id).toBe('registered');
    });

    it('creates steps with reputation link step', () => {
      useDeployStore.getState().initSteps(true);
      const steps = useDeployStore.getState().steps;
      expect(steps).toHaveLength(4);
      expect(steps[3].id).toBe('linked');
    });
  });
});
