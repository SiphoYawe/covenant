'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/ui/loading';

export type ReputationLinkToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

type ProfileData = {
  deployerScore: number;
};

export function ReputationLinkToggle({ enabled, onChange }: ReputationLinkToggleProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deployer/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // Silently fail, profile display is supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !profile) {
      fetchProfile();
    }
  }, [enabled, profile, fetchProfile]);

  const boost = profile ? Math.min(0.5, profile.deployerScore * 0.05) : 0;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <label htmlFor="reputation-link" className="text-sm font-medium text-foreground cursor-pointer">
          Link my reputation to this agent
        </label>
        <button
          id="reputation-link"
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-secondary'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-5.5' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </button>
      </div>

      {enabled ? (
        <div className="mt-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loading size="sm" />
              <span>Loading profile...</span>
            </div>
          ) : profile ? (
            <>
              <p className="text-sm text-muted-foreground">
                Your score: <span className="text-foreground font-medium">{profile.deployerScore.toFixed(1)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Starting boost: <span className="text-score-good font-medium">+{boost.toFixed(2)}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Score will be calculated on deploy</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Agent deploys independently</p>
      )}
    </div>
  );
}
