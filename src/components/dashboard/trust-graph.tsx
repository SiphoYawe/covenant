'use client';

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  useAgents,
  useEdges,
  useDashboardStore,
} from '@/stores/dashboard';
import {
  buildGraphData,
  getNodeColor,
  getNodeRadius,
  normalizeEdgeWidth,
  getEdgeColor,
} from '@/components/dashboard/graph-utils';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Loading trust graph...
    </div>
  ),
});

export function TrustGraph() {
  const agents = useAgents();
  const edges = useEdges();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  const graphData = useMemo(() => buildGraphData(agents, edges), [agents, edges]);

  const maxVolume = useMemo(
    () => Math.max(...graphData.links.map((l) => l.volume), 1),
    [graphData.links],
  );

  const selectedAgentId = useDashboardStore((s) => s.selectedAgentId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    useDashboardStore.getState().setSelectedAgent(node.id);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    useDashboardStore.getState().setSelectedAgent(null);
  }, []);

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const score = node.score ?? 5;
      const radius = getNodeRadius(score);
      const color = getNodeColor(score);
      const isSelected = node.id === selectedAgentId;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0,187,255,0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00BBFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.font = '4px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(node.name ?? '', x, y + radius + 2);
    },
    [selectedAgentId],
  );

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px]">
      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeVal={(node: any) => getNodeRadius(node.score ?? 5)}
        nodeCanvasObject={nodeCanvasObject}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkWidth={(link: any) =>
          normalizeEdgeWidth(link.volume ?? 1, maxVolume)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkColor={(link: any) => getEdgeColor(link.outcome ?? 'success')}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.9}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        backgroundColor="transparent"
        cooldownTicks={50}
      />
    </div>
  );
}
