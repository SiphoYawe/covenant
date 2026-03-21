'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { AgentDetail } from '@/components/dashboard/agent-detail';
import { useAgents, useSelectedAgentId } from '@/stores/dashboard';
import { HugeiconsIcon } from '@hugeicons/react';
import { InformationCircleIcon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

export default function TrustGraphPage() {
  const agents = useAgents();
  const selectedAgentId = useSelectedAgentId();
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const agentCount = Object.keys(agents).length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 p-6 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Trust Graph</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {agentCount} agents, force-directed layout
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEdgeLabels(!showEdgeLabels)}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg transition-all duration-150"
            >
              <HugeiconsIcon icon={showEdgeLabels ? ViewOffIcon : ViewIcon} size={14} />
              {showEdgeLabels ? 'Hide amounts' : 'Show amounts'}
            </button>
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg transition-all duration-150"
            >
              <HugeiconsIcon icon={InformationCircleIcon} size={14} />
              Legend
            </button>
          </div>
        </div>

        {/* Full-screen graph with optional panels */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Graph container */}
          <div className="flex-1 bg-card card-elevated rounded-xl overflow-hidden min-h-0 relative">
            <div className="absolute inset-0">
              <TrustGraph showLabels showEdgeLabels={showEdgeLabels} />
            </div>

            {/* Legend overlay */}
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-4 overlay-elevated rounded-xl p-4 space-y-3 pointer-events-auto"
                >
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">Legend</h3>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Node Colors (by role)</p>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm text-foreground">Requester</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-score-excellent" />
                      <span className="text-sm text-foreground">Provider</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-score-critical" />
                      <span className="text-sm text-foreground">Adversarial</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground">Visual Encoding</p>
                    <p className="text-xs text-foreground">Node size = reputation score</p>
                    <p className="text-xs text-foreground">Edge thickness = USDC volume</p>
                    <p className="text-xs text-foreground">Arrow direction = payment flow</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cluster info */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <div className="overlay-elevated rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                Legitimate cluster: center
              </div>
              <div className="overlay-elevated rounded-lg px-3 py-1.5 text-xs text-score-critical">
                Adversarial: periphery
              </div>
            </div>
          </div>

          {/* Inspection panel */}
          <AnimatePresence>
            {selectedAgentId && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 overflow-hidden"
              >
                <AgentDetail />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
