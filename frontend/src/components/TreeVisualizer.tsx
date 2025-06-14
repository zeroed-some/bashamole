'use client';

// src/components/TreeVisualizer.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TreeNode } from '@/lib/api';

interface TreeVisualizerProps {
  treeData: TreeNode;
  playerLocation: string;
  onNodeClick?: (path: string) => void;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  treeData,
  playerLocation,
  onNodeClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!treeData || !svgRef.current || !containerRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Set up dimensions with dynamic sizing
    const margin = { top: 100, right: 50, bottom: 100, left: 50 };
    const width = Math.max(containerWidth, 1600);
    const height = Math.max(containerHeight, 1200);

    const svg = d3
      .select(svgRef.current)
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Add a subtle grid pattern background
    const defs = svg.append('defs');
    
    const pattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');
    
    pattern.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', '1');

    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', '#111827')
      .style('opacity', 0.95);
    
    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#grid)')
      .style('opacity', 0.3);

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${margin.top})`);

    // Create tree layout - vertical orientation
    const treeLayout = d3
      .tree<TreeNode>()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
      .separation((a, b) => {
        const aIsLeaf = !a.children || a.children.length === 0;
        const bIsLeaf = !b.children || b.children.length === 0;
        
        if (aIsLeaf && bIsLeaf) {
          return 1.5;
        }
        return a.parent === b.parent ? 1 : 1.2;
      });

    // Create hierarchy
    const root = d3.hierarchy(treeData);
    const treeNodes = treeLayout(root);

    // Create gradient for links
    const linkGradient = defs
      .append('linearGradient')
      .attr('id', 'link-gradient-v')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    
    linkGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4B5563')
      .attr('stop-opacity', 0.6);
    
    linkGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6B7280')
      .attr('stop-opacity', 0.3);

    // Create links with vertical layout
    const link = g
      .selectAll('.link')
      .data(treeNodes.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical<any, any>()
        .x(d => d.x)
        .y(d => d.y))
      .style('fill', 'none')
      .style('stroke', 'url(#link-gradient-v)')
      .style('stroke-width', 2)
      .style('opacity', 0.8);

    // Create node groups
    const node = g
      .selectAll('.node')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Add glow effect for interactive nodes
    const glowFilter = defs.append('filter')
      .attr('id', 'glow');
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Add circles for nodes
    node
      .append('circle')
      .attr('r', d => {
        if (d.data.path === '/') return 14;
        if (d.data.path === playerLocation) return 11;
        return 9;
      })
      .style('fill', d => {
        if (d.data.path === playerLocation) return '#3B82F6';
        if (d.data.has_mole) return '#EF4444';
        if (d.data.is_fhs) return '#8B5CF6';
        return '#10B981';
      })
      .style('stroke', d => {
        if (d.data.path === playerLocation) return '#60A5FA';
        if (d.data.has_mole) return '#F87171';
        return '#ffffff';
      })
      .style('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('filter', d => d.data.path === playerLocation ? 'url(#glow)' : 'none')
      .style('transition', 'all 0.3s ease')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.data.path === '/' ? 16 : 12)
          .style('stroke-width', 3);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.data.path === '/' ? 14 : d.data.path === playerLocation ? 11 : 9)
          .style('stroke-width', 2);
      })
      .on('click', (event, d) => {
        if (onNodeClick) {
          onNodeClick(d.data.path);
        }
      });

    // Add tooltips
    node
      .append('title')
      .text(d => `${d.data.path}\n${d.data.description}\n${d.data.has_mole ? '🐭 Mole is here!' : ''}`);

    // Add labels
    node
      .append('text')
      .attr('dy', d => d.children ? -20 : 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', d => d.data.path === playerLocation ? '600' : '400')
      .style('fill', d => d.data.path === playerLocation ? '#93C5FD' : '#E5E7EB')
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)')
      .text(d => d.data.name || '/')
      .style('pointer-events', 'none');

    // Add player indicator with SVG
    const playerNode = treeNodes.descendants().find(d => d.data.path === playerLocation);
    if (playerNode) {
      const playerGroup = node
        .filter(d => d.data.path === playerLocation)
        .append('g')
        .attr('transform', 'translate(0, -30)');

      // Add pulsing animation
      playerGroup
        .append('circle')
        .attr('r', 15)
        .style('fill', 'none')
        .style('stroke', '#3B82F6')
        .style('stroke-width', 2)
        .style('opacity', 0)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('from', '15')
        .attr('to', '25')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

      playerGroup
        .select('circle')
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr('from', '0.8')
        .attr('to', '0')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');

      // Add player icon
      playerGroup
        .append('image')
        .attr('xlink:href', '/player.svg')
        .attr('width', 24)
        .attr('height', 24)
        .attr('x', -12)
        .attr('y', -12);
    }

    // Add mole indicator with SVG if game is won
    const moleNode = treeNodes.descendants().find(d => d.data.has_mole);
    if (moleNode) {
      const moleGroup = node
        .filter(d => d.data.has_mole)
        .append('g')
        .attr('transform', 'translate(0, -30)');

      // Add celebration animation
      moleGroup
        .append('circle')
        .attr('r', 15)
        .style('fill', 'none')
        .style('stroke', '#EF4444')
        .style('stroke-width', 3)
        .style('opacity', 0)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('from', '15')
        .attr('to', '30')
        .attr('dur', '1s')
        .attr('repeatCount', 'indefinite');

      moleGroup
        .select('circle')
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr('from', '1')
        .attr('to', '0')
        .attr('dur', '1s')
        .attr('repeatCount', 'indefinite');

      // Add mole icon
      moleGroup
        .append('image')
        .attr('xlink:href', '/mole.svg')
        .attr('width', 24)
        .attr('height', 24)
        .attr('x', -12)
        .attr('y', -12);
    }

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center on player location with animation
    if (playerNode) {
      const scale = 0.8;
      const x = width / 2 - playerNode.x * scale;
      const y = containerHeight / 2 - playerNode.y * scale - margin.top;
      
      svg
        .transition()
        .duration(750)
        .call(
          zoom.transform as any,
          d3.zoomIdentity.translate(x, y).scale(scale)
        );
    }

  }, [treeData, playerLocation, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TreeVisualizer;