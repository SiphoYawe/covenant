'use client';

const BASESCAN_URL = 'https://sepolia.basescan.org/tx/';

function TxLink({ hash }: { hash: string }) {
  const short = hash.length > 10 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
  return (
    <a
      href={`${BASESCAN_URL}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-primary hover:underline"
    >
      {short}
    </a>
  );
}

type TriggerSummaryProps = {
  type: 'lifecycle' | 'sybil-cascade';
  result: Record<string, unknown>;
};

export function TriggerSummary({ type, result }: TriggerSummaryProps) {
  const success = result.success === true;
  const durationMs = (result.durationMs as number) ?? 0;
  const durationStr = (durationMs / 1000).toFixed(1) + 's';

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {type === 'lifecycle' ? 'Lifecycle Result' : 'Sybil Cascade Result'}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{durationStr}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              success
                ? 'bg-score-excellent/20 text-score-excellent'
                : 'bg-score-critical/20 text-score-critical'
            }`}
          >
            {success ? 'Success' : 'Failed'}
          </span>
        </div>
      </div>

      {type === 'lifecycle' ? (
        <LifecycleSummary result={result} />
      ) : (
        <SybilSummary result={result} />
      )}
    </div>
  );
}

function LifecycleSummary({ result }: { result: Record<string, unknown> }) {
  const requesterId = String(result.requesterId ?? '');
  const providerId = String(result.providerId ?? '');
  const price = result.negotiatedPrice != null ? Number(result.negotiatedPrice) : null;
  const paymentTx = result.paymentTxHash ? String(result.paymentTxHash) : '';
  const feedbackTx = result.feedbackTxHash ? String(result.feedbackTxHash) : '';
  const errorMsg = result.error ? String(result.error) : '';

  return (
    <div className="space-y-3">
      {/* Agents */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Requester</span>
          <p className="text-xs text-foreground font-mono mt-0.5">{requesterId}</p>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Provider</span>
          <p className="text-xs text-foreground font-mono mt-0.5">{providerId}</p>
        </div>
      </div>

      {/* Price */}
      <PriceDisplay price={price} />

      {/* Tx Hashes */}
      <div className="space-y-1.5">
        {paymentTx ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-16">Payment</span>
            <TxLink hash={paymentTx} />
          </div>
        ) : null}
        {feedbackTx ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-16">Feedback</span>
            <TxLink hash={feedbackTx} />
          </div>
        ) : null}
      </div>

      {/* Error */}
      {errorMsg ? <p className="text-xs text-score-critical">{errorMsg}</p> : null}
    </div>
  );
}

function PriceDisplay({ price }: { price: number | null }) {
  if (price === null) return null;
  return (
    <div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Agreed Price</span>
      <p className="text-sm text-foreground font-semibold mt-0.5">{price} USDC</p>
    </div>
  );
}

function SybilSummary({ result }: { result: Record<string, unknown> }) {
  const ringMembers = (result.ringMembers as string[]) ?? [];
  const scoreDrops = (result.scoreDrops as Record<string, { before: number; after: number }>) ?? {};
  const explanation = String(result.explanation ?? '');
  const txHashes = (result.txHashes as Record<string, string>) ?? {};
  const errorMsg = result.error ? String(result.error) : '';

  return (
    <div className="space-y-3">
      {/* Ring Pattern */}
      <div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Detected Ring</span>
        <p className="text-xs text-foreground font-mono mt-0.5">
          {ringMembers.join(' -> ')}{' -> '}{ringMembers[0]}
        </p>
      </div>

      {/* Score Drops */}
      <div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score Changes</span>
        <div className="space-y-1 mt-1">
          {Object.entries(scoreDrops).map(([agentId, drop]) => (
            <div key={agentId} className="flex items-center gap-2 text-xs">
              <span className="text-foreground font-mono w-20 truncate">{agentId}</span>
              <span className="text-muted-foreground">{drop.before.toFixed(1)}</span>
              <span className="text-muted-foreground">{'→'}</span>
              <span className="text-score-critical font-semibold">{drop.after.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      {explanation ? (
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Explanation</span>
          <p className="text-xs text-foreground mt-0.5 leading-relaxed">{explanation}</p>
        </div>
      ) : null}

      {/* Tx Hashes */}
      {Object.keys(txHashes).length > 0 ? (
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">On-Chain Write-Back</span>
          <div className="space-y-1 mt-1">
            {Object.entries(txHashes).map(([agentId, hash]) => (
              <div key={agentId} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-mono w-20 truncate">{agentId}</span>
                <TxLink hash={hash} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Error */}
      {errorMsg ? <p className="text-xs text-score-critical">{errorMsg}</p> : null}
    </div>
  );
}
