'use client';

import { useCallback, useMemo, useRef, useEffect, useState, type MutableRefObject } from 'react';
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

type TrustGraphProps = {
  showLabels?: boolean;
  showEdgeLabels?: boolean;
};

export function TrustGraph({ showLabels = true, showEdgeLabels = false }: TrustGraphProps) {
  const agents = useAgents();
  const edges = useEdges();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const graphData = useMemo(() => buildGraphData(agents, edges), [agents, edges]);

  const maxVolume = useMemo(
    () => Math.max(...graphData.links.map((l) => l.volume), 1),
    [graphData.links],
  );

  const selectedAgentId = useDashboardStore((s) => s.selectedAgentId);

  // Spread nodes apart for clarity with much stronger repulsion
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // Light charge keeps nodes from overlapping
    fg.d3Force('charge')?.strength(-150);
    // Tight link distance pulls connected nodes closer
    fg.d3Force('link')?.distance(35);
    // Center force keeps graph roughly centered
    fg.d3Force('center')?.strength(0.08);
    // Reheat simulation to apply new forces
    fg.d3ReheatSimulation();
    // Auto-fit graph to container after simulation settles
    const timer = setTimeout(() => {
      fg.zoomToFit?.(400, 40);
    }, 1500);
    return () => clearTimeout(timer);
  }, [graphData]);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id ?? null);
  }, []);

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const score = node.score ?? 0;
      const role = node.role ?? '';
      const radius = getNodeRadius(score);
      const color = getNodeColor(score, role);
      const isSelected = node.id === selectedAgentId;
      const isHovered = node.id === hoveredNode;
      const pulseScale = isHovered ? 1.15 : 1;

      // Glow for hovered/selected nodes
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius * pulseScale + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(x, y, radius * pulseScale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Dimming for adversarial nodes
      if (role === 'adversarial') {
        ctx.globalAlpha = 0.7;
      }

      // Label
      if (showLabels) {
        ctx.font = `bold ${Math.max(4, radius * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 1;
        ctx.fillText(node.name ?? '', x, y + radius * pulseScale + 3);
      }

      ctx.globalAlpha = 1;
    },
    [selectedAgentId, hoveredNode, showLabels],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkCanvasObjectMode = useCallback(() => showEdgeLabels ? 'after' as const : undefined, [showEdgeLabels]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    if (!showEdgeLabels) return;
    const start = link.source;
    const end = link.target;
    if (!start || !end) return;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Draw background pill for readability
    const label = `$${link.volume}`;
    ctx.font = 'bold 5px sans-serif';
    const textWidth = ctx.measureText(label).width;
    const padding = 3;
    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.beginPath();
    const rx = midX - textWidth / 2 - padding;
    const ry = midY - 5;
    const rw = textWidth + padding * 2;
    const rh = 10;
    if (ctx.roundRect) {
      ctx.roundRect(rx, ry, rw, rh, 3);
    } else {
      ctx.rect(rx, ry, rw, rh);
    }
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00BBFF';
    ctx.fillText(label, midX, midY);
  }, [showEdgeLabels]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px]">
      <ForceGraph2D
        ref={fgRef}
        key={graphData.nodes.length}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeVal={(node: any) => getNodeRadius(node.score ?? 0)}
        nodeCanvasObject={nodeCanvasObject}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkWidth={(link: any) =>
          normalizeEdgeWidth(link.volume ?? 1, maxVolume)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkColor={(link: any) => getEdgeColor(link.outcome ?? 'success')}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.9}
        linkCanvasObjectMode={showEdgeLabels ? linkCanvasObjectMode : undefined}
        linkCanvasObject={showEdgeLabels ? linkCanvasObject : undefined}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        backgroundColor="transparent"
        cooldownTicks={200}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        warmupTicks={100}
        minZoom={0.5}
        maxZoom={4}
      />
    </div>
  );
}
