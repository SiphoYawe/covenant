'use client';

import { create } from 'zustand';

// --- Types ---

export type DeployFormMode = 'provisioned' | 'byow';

export type DeployStepStatus = 'pending' | 'in-progress' | 'complete' | 'error';

export type DeployStep = {
  id: string;
  label: string;
  status: DeployStepStatus;
  error?: string;
};

export type DeployFormData = {
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  walletAddress: string;
  linkReputation: boolean;
};

export type DeployResult = {
  agentId: string;
  address: string;
  linkedReputation: boolean;
};

export type DeployStatus = 'idle' | 'deploying' | 'success' | 'error';

export type DeployState = {
  mode: DeployFormMode;
  formData: DeployFormData;
  status: DeployStatus;
  steps: DeployStep[];
  result: DeployResult | null;
  error: string | null;
};

export type DeployActions = {
  setMode: (mode: DeployFormMode) => void;
  updateForm: (partial: Partial<DeployFormData>) => void;
  initSteps: (linkReputation: boolean) => void;
  updateStep: (id: string, status: DeployStepStatus, error?: string) => void;
  setResult: (result: DeployResult) => void;
  setError: (error: string) => void;
  reset: () => void;
  startDeploy: () => Promise<void>;
};

export type DeployStore = DeployState & DeployActions;

// --- Initial State ---

const initialFormData: DeployFormData = {
  name: '',
  description: '',
  capabilities: [],
  systemPrompt: '',
  walletAddress: '',
  linkReputation: false,
};

const initialState: DeployState = {
  mode: 'provisioned',
  formData: { ...initialFormData },
  status: 'idle',
  steps: [],
  result: null,
  error: null,
};

// --- Step Definitions ---

const BASE_STEPS: DeployStep[] = [
  { id: 'wallet', label: 'Wallet Generated', status: 'pending' },
  { id: 'funded', label: 'Funded', status: 'pending' },
  { id: 'registered', label: 'Registered on ERC-8004', status: 'pending' },
];

const LINK_STEP: DeployStep = {
  id: 'linked',
  label: 'Reputation Linked',
  status: 'pending',
};

// --- Store ---

export const useDeployStore = create<DeployStore>()((set, get) => ({
  ...initialState,

  setMode: (mode: DeployFormMode) => {
    set({ mode });
  },

  updateForm: (partial: Partial<DeployFormData>) => {
    set((state) => ({
      formData: { ...state.formData, ...partial },
    }));
  },

  initSteps: (linkReputation: boolean) => {
    const steps = [...BASE_STEPS.map((s) => ({ ...s }))];
    if (linkReputation) {
      steps.push({ ...LINK_STEP });
    }
    set({ steps });
  },

  updateStep: (id: string, status: DeployStepStatus, error?: string) => {
    set((state) => ({
      steps: state.steps.map((step) =>
        step.id === id ? { ...step, status, error } : step,
      ),
    }));
  },

  setResult: (result: DeployResult) => {
    set({ result, status: 'success' });
  },

  setError: (error: string) => {
    set({ error, status: 'error' });
  },

  reset: () => {
    set({ ...initialState, formData: { ...initialFormData } });
  },

  startDeploy: async () => {
    const { formData, mode, updateStep, setResult, setError, initSteps } = get();

    // Initialize steps
    initSteps(formData.linkReputation);
    set({ status: 'deploying', error: null, result: null });

    try {
      // Step 1: Wallet
      updateStep('wallet', 'in-progress');

      const body =
        mode === 'byow'
          ? {
              mode: 'byow' as const,
              address: formData.walletAddress,
              name: formData.name,
              description: formData.description,
              capabilities: formData.capabilities,
            }
          : {
              mode: 'human' as const,
              name: formData.name,
              description: formData.description,
              capabilities: formData.capabilities,
              linkReputation: formData.linkReputation,
            };

      const res = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        const msg = errData?.error?.message ?? 'Deployment failed';
        updateStep('wallet', 'error', msg);
        setError(msg);
        return;
      }

      updateStep('wallet', 'complete');

      // Step 2: Funded
      updateStep('funded', 'in-progress');
      updateStep('funded', 'complete');

      // Step 3: Registered
      updateStep('registered', 'in-progress');
      updateStep('registered', 'complete');

      const data = await res.json();

      // Step 4: Linked (if applicable)
      if (formData.linkReputation) {
        updateStep('linked', 'in-progress');
        updateStep('linked', 'complete');
      }

      setResult({
        agentId: data.agentId,
        address: data.address,
        linkedReputation: data.linkedReputation ?? false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deployment failed';
      setError(msg);
    }
  },
}));
