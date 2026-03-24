import React, { useMemo, useRef, useEffect } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { RefreshCcw } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

interface KnowledgeGraphProps {
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data, onNodeClick }) => {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 400 });

  const graphData = useMemo(() => {
    return {
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.links.map(l => ({ ...l }))
    };
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-100);
      fgRef.current.d3Force('link')?.distance(40);
      fgRef.current.d3Force('center')?.strength(0.05);
    }
  }, [dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0a0a] relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel={(node: any) => `
          <div class="bg-black/90 border border-emerald-500/30 p-2 rounded text-[10px] font-mono text-emerald-400">
            <div class="uppercase opacity-50 mb-1">${node.type}</div>
            <div>${node.label}</div>
          </div>
        `}
        onNodeClick={(node: any) => onNodeClick?.(node)}
        nodeRelSize={2.5}
        nodeColor={(node: any) => {
          if (node.type === 'theory') return '#10b981'; // emerald-500
          if (node.type === 'signal') return '#3b82f6'; // blue-500
          return '#4b5563'; // gray-600
        }}
        linkColor={() => 'rgba(255, 255, 255, 0.05)'}
        linkWidth={0.5}
        nodeCanvasObjectMode={() => 'before'}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const size = node.type === 'theory' ? 3 : 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          
          // Glow effect
          const color = node.type === 'theory' ? '#10b981' : (node.type === 'signal' ? '#3b82f6' : '#4b5563');
          ctx.shadowColor = color;
          ctx.shadowBlur = 10 / globalScale;
          ctx.fillStyle = color;
          ctx.fill();
          
          // Reset shadow
          ctx.shadowBlur = 0;

          if (globalScale >= 3) {
            const label = node.label;
            const fontSize = 8 / globalScale;
            ctx.font = `${fontSize}px "JetBrains Mono"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillText(label, node.x, node.y + 6);
          }
        }}
        cooldownTicks={100}
      />
      
      {/* Reset View Button */}
      <button 
        onClick={() => fgRef.current?.zoomToFit(400)}
        className="absolute bottom-3 right-3 p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all"
        title="Сбросить вид"
      >
        <RefreshCcw size={12} />
      </button>
      
      {/* Obsidian-style corner labels */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">Теории</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
            <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">Сигналы</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
