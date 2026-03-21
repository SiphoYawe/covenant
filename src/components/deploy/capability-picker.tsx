'use client';

import { KNOWN_CAPABILITIES } from '@/lib/deploy/capabilities';

const MAX_CAPABILITIES = 10;

function formatCapability(cap: string): string {
  return cap.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type CapabilityPickerProps = {
  selected: string[];
  onChange: (capabilities: string[]) => void;
};

export function CapabilityPicker({ selected, onChange }: CapabilityPickerProps) {
  const atMax = selected.length >= MAX_CAPABILITIES;

  function toggle(cap: string) {
    if (selected.includes(cap)) {
      onChange(selected.filter((c) => c !== cap));
    } else if (!atMax) {
      onChange([...selected, cap]);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">Capabilities</span>
        <span className="text-xs text-muted-foreground">
          {selected.length}/{MAX_CAPABILITIES} selected
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {KNOWN_CAPABILITIES.map((cap) => {
          const isSelected = selected.includes(cap);
          const isDisabled = atMax && !isSelected;

          return (
            <button
              key={cap}
              type="button"
              onClick={() => toggle(cap)}
              disabled={isDisabled}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {formatCapability(cap)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
