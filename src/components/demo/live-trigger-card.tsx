'use client';

type TriggerStep = {
  name: string;
  protocol: string;
  duration: string;
};

type LiveTriggerCardProps = {
  title: string;
  description: string;
  estimatedDuration: number;
  steps: TriggerStep[];
  isExecuting: boolean;
  onTrigger: () => void;
  result?: Record<string, unknown> | null;
};

const PROTOCOL_COLORS: Record<string, string> = {
  a2a: 'text-blue-400',
  'covenant-ai': 'text-primary',
  x402: 'text-emerald-400',
  civic: 'text-amber-400',
  erc8004: 'text-purple-400',
};

export function LiveTriggerCard({
  title,
  description,
  estimatedDuration,
  steps,
  isExecuting,
  onTrigger,
  result,
}: LiveTriggerCardProps) {
  const hasResult = result && typeof result === 'object';
  const isSuccess = hasResult && result.success === true;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
          ~{estimatedDuration}s
        </span>
      </div>

      {/* Steps breakdown */}
      <div className="flex flex-col gap-1.5">
        {steps.map((step) => (
          <div key={step.name} className="flex items-center gap-2 text-xs">
            <span className={`font-mono ${PROTOCOL_COLORS[step.protocol] ?? 'text-muted-foreground'}`}>
              {step.protocol}
            </span>
            <span className="text-foreground">{step.name}</span>
            <span className="text-muted-foreground ml-auto">{step.duration}</span>
          </div>
        ))}
      </div>

      {/* Trigger button */}
      <button
        type="button"
        onClick={onTrigger}
        disabled={isExecuting}
        className={`w-full rounded-xl py-3 text-sm font-medium transition-all ${
          isExecuting
            ? 'bg-primary/20 text-primary cursor-not-allowed animate-pulse'
            : hasResult
              ? isSuccess
                ? 'bg-score-excellent/20 text-score-excellent'
                : 'bg-score-critical/20 text-score-critical'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
        }`}
      >
        {isExecuting ? 'Executing...' : hasResult ? (isSuccess ? 'Complete' : 'Failed') : 'Trigger'}
      </button>
    </div>
  );
}
