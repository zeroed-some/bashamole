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

  useEffect(() => {
    if (!treeData || !svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 1200;
    const height = 800;
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };

    const svg = d3
      .select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tree layout
    const treeLayout = d3
      .tree<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

    // Create hierarchy
    const root = d3.hierarchy(treeData);
    const treeNodes = treeLayout(root);

    // Create gradient for links
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#E5E7EB');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#9CA3AF');

    // Create links with curved paths
    const link = g
      .selectAll('.link')
      .data(treeNodes.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x))
      .style('fill', 'none')
      .style('stroke', 'url(#link-gradient)')
      .style('stroke-width', 2)
      .style('opacity', 0.6);

    // Create node groups
    const node = g
      .selectAll('.node')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Add circles for nodes with better styling
    node
      .append('circle')
      .attr('r', d => {
        if (d.data.path === '/') return 12; // Root is larger
        if (d.data.path === playerLocation) return 10;
        return 8;
      })
      .style('fill', d => {
        if (d.data.path === playerLocation) return '#3B82F6'; // Player location - blue
        if (d.data.has_mole) return '#EF4444'; // Mole location - red (only shown after win)
        if (d.data.is_fhs) return '#8B5CF6'; // FHS standard - purple
        return '#10B981'; // Generated directories - green
      })
      .style('stroke', d => {
        if (d.data.path === playerLocation) return '#1E40AF';
        if (d.data.has_mole) return '#991B1B';
        return '#ffffff';
      })
      .style('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('filter', d => d.data.path === playerLocation ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.data.path === '/' ? 14 : 10);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.data.path === '/' ? 12 : d.data.path === playerLocation ? 10 : 8);
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

    // Add labels with better positioning
    node
      .append('text')
      .attr('dy', '.35em')
      .attr('x', d => d.children ? -13 : 13)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .style('font-size', '13px')
      .style('font-weight', d => d.data.path === playerLocation ? '600' : '400')
      .style('fill', d => d.data.path === playerLocation ? '#1E40AF' : '#374151')
      .text(d => d.data.name || '/')
      .style('pointer-events', 'none');

    // Add player indicator emoji
    const playerNode = treeNodes.descendants().find(d => d.data.path === playerLocation);
    if (playerNode) {
      node
        .filter(d => d.data.path === playerLocation)
        .append('text')
        .attr('dy', -20)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .text('🧑‍💻');
    }

    // Add mole indicator if game is won
    const moleNode = treeNodes.descendants().find(d => d.data.has_mole);
    if (moleNode) {
      node
        .filter(d => d.data.has_mole)
        .append('text')
        .attr('dy', -20)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .text('🐭');
    }

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center on player location initially
    if (playerNode) {
      const scale = 0.8;
      const x = width / 2 - playerNode.y * scale;
      const y = height / 2 - playerNode.x * scale;
      
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(x, y).scale(scale)
      );
    }

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(20, ${height - 100})`);

    const legendItems = [
      { color: '#3B82F6', label: 'You are here' },
      { color: '#8B5CF6', label: 'System (FHS)' },
      { color: '#10B981', label: 'User directories' },
      { color: '#EF4444', label: 'Mole location', show: !!moleNode },
    ];

    legendItems.forEach((item, i) => {
      if (item.show === false) return;
      
      const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 25})`);
      
      legendItem.append('circle')
        .attr('r', 6)
        .style('fill', item.color);
      
      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .style('font-size', '12px')
        .style('fill', '#6B7280')
        .text(item.label);
    });

  }, [treeData, playerLocation, onNodeClick]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-inner overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TreeVisualizer;