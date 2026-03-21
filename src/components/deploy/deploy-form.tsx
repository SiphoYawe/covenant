'use client';

import { useDeployStore } from '@/stores/deploy-store';
import { CapabilityPicker } from './capability-picker';
import { ReputationLinkToggle } from './reputation-link-toggle';
import { Button } from '@/components/ui/button';
import type { DeployFormMode } from '@/stores/deploy-store';

const MODE_TABS: { value: DeployFormMode; label: string }[] = [
  { value: 'provisioned', label: 'Provisioned' },
  { value: 'byow', label: 'Bring Your Own Wallet' },
];

export function DeployForm() {
  const mode = useDeployStore((s) => s.mode);
  const formData = useDeployStore((s) => s.formData);
  const status = useDeployStore((s) => s.status);
  const setMode = useDeployStore((s) => s.setMode);
  const updateForm = useDeployStore((s) => s.updateForm);
  const startDeploy = useDeployStore((s) => s.startDeploy);

  const isDeploying = status === 'deploying';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startDeploy();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode Tabs */}
      <div className="flex gap-1 rounded-full bg-secondary p-1">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMode(tab.value)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              mode === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="agent-name" className="block text-sm font-medium text-foreground mb-1.5">
          Agent Name
        </label>
        <input
          id="agent-name"
          type="text"
          value={formData.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          placeholder="e.g. Research Assistant"
          minLength={3}
          maxLength={50}
          required
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground mt-1 block">{formData.name.length}/50</span>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="agent-description" className="block text-sm font-medium text-foreground mb-1.5">
          Description
        </label>
        <textarea
          id="agent-description"
          value={formData.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          placeholder="Describe what your agent does..."
          minLength={10}
          maxLength={500}
          required
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <span className="text-xs text-muted-foreground mt-1 block">{formData.description.length}/500</span>
      </div>

      {/* Capabilities */}
      <CapabilityPicker
        selected={formData.capabilities}
        onChange={(caps) => updateForm({ capabilities: caps })}
      />

      {/* System Prompt (provisioned only) */}
      {mode === 'provisioned' && (
        <div>
          <label htmlFor="system-prompt" className="block text-sm font-medium text-foreground mb-1.5">
            System Prompt
          </label>
          <textarea
            id="system-prompt"
            value={formData.systemPrompt}
            onChange={(e) => updateForm({ systemPrompt: e.target.value })}
            placeholder="Optional system prompt for your agent..."
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <span className="text-xs text-muted-foreground mt-1 block">{formData.systemPrompt.length}/2000</span>
        </div>
      )}

      {/* Wallet Address (BYOW only) */}
      {mode === 'byow' && (
        <div>
          <label htmlFor="wallet-address" className="block text-sm font-medium text-foreground mb-1.5">
            Wallet Address
          </label>
          <input
            id="wallet-address"
            type="text"
            value={formData.walletAddress}
            onChange={(e) => updateForm({ walletAddress: e.target.value })}
            placeholder="0x..."
            pattern="^0x[0-9a-fA-F]{40}$"
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Reputation Link */}
      <ReputationLinkToggle
        enabled={formData.linkReputation}
        onChange={(enabled) => updateForm({ linkReputation: enabled })}
      />

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        disabled={isDeploying}
        className="w-full"
      >
        {isDeploying ? 'Deploying...' : 'Deploy Agent'}
      </Button>
    </form>
  );
}
