'use client';

// src/components/TreeVisualizer.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TreeNode } from '@/lib/api';

interface TreeVisualizerProps {
  treeData: TreeNode;
  playerLocation: string;
  onNodeClick?: (path: string) => void;
  playIntro?: boolean;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  treeData,
  playerLocation,
  onNodeClick,
  playIntro = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!treeData || !svgRef.current || !containerRef.current) return;

    const isNavigation = previousLocationRef.current !== null && 
                        previousLocationRef.current !== playerLocation && 
                        !playIntro;
    
    previousLocationRef.current = playerLocation;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Create hierarchy and calculate dimensions
    const root = d3.hierarchy(treeData);
    
    // Calculate the maximum number of nodes at any depth
    const levelCounts: { [key: number]: number } = {};
    root.each(d => {
      levelCounts[d.depth] = (levelCounts[d.depth] || 0) + 1;
    });
    const maxNodesAtLevel = Math.max(...Object.values(levelCounts));
    
    // Dynamic width based on tree structure
    const nodeSpacing = 120; // Increased from 80 for better spacing
    const dynamicWidth = Math.max(maxNodesAtLevel * nodeSpacing, containerWidth * 2); // Increased multiplier
    const margin = { top: 100, right: 150, bottom: 100, left: 150 }; // Increased margins
    const width = dynamicWidth;
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
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tree layout - vertical orientation with better spacing
    const treeLayout = d3
      .tree<TreeNode>()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
      .separation((a, b) => {
        // Special handling for directories with many children
        const aParentChildCount = a.parent ? (a.parent.children?.length || 0) : 0;
        const bParentChildCount = b.parent ? (b.parent.children?.length || 0) : 0;
        
        // If nodes share a parent with many children (like home dirs), give more space
        if (a.parent === b.parent && aParentChildCount > 3) {
          const aIsLeaf = !a.children || a.children.length === 0;
          const bIsLeaf = !b.children || b.children.length === 0;
          
          if (aIsLeaf && bIsLeaf) {
            // Extra space for leaf nodes in crowded directories
            return 2.5;
          }
          return 2;
        }
        
        // Base separation on node depth
        if (a.depth === 0 || b.depth === 0) return 4;
        if (a.depth === 1 || b.depth === 1) return 3;
        
        const aIsLeaf = !a.children || a.children.length === 0;
        const bIsLeaf = !b.children || b.children.length === 0;
        
        if (aIsLeaf && bIsLeaf) {
          return 1.5;
        }
        return a.parent === b.parent ? 1.5 : 2;
      });

    // Apply tree layout
    const treeNodes = treeLayout(root);
    
    // Adjust the x-coordinate to center the root
    const rootX = width / 2;
    treeNodes.each(d => {
      d.x = d.x + (rootX - root.x);
    });

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
        if (d.data.path === '/') return 16;
        if (d.data.path === playerLocation) return 13;
        return 11;
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
          .attr('r', d.data.path === '/' ? 18 : 14)
          .style('stroke-width', 3);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', d.data.path === '/' ? 16 : d.data.path === playerLocation ? 13 : 11)
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
      .style('font-size', '14px')
      .style('font-weight', d => d.data.path === playerLocation ? '700' : '500')
      .style('fill', d => d.data.path === playerLocation ? '#93C5FD' : '#E5E7EB')
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)')
      .text(d => d.data.name || '/')
      .style('pointer-events', 'none');

    // Add player indicator with SVG overlaid on node
    const playerNode = treeNodes.descendants().find(d => d.data.path === playerLocation);
    if (playerNode) {
      const playerGroup = node
        .filter(d => d.data.path === playerLocation)
        .append('g');

      // Add player SVG directly on the node
      playerGroup
        .append('image')
        .attr('xlink:href', '/player.svg')
        .attr('width', 20)
        .attr('height', 20)
        .attr('x', -10)
        .attr('y', -10)
        .style('pointer-events', 'none');
    }

    // Add mole indicator with SVG overlaid if game is won
    const moleNode = treeNodes.descendants().find(d => d.data.has_mole);
    if (moleNode) {
      const moleGroup = node
        .filter(d => d.data.has_mole)
        .append('g');

      // Add celebration animation ring
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

      // Add mole SVG directly on the node
      moleGroup
        .append('image')
        .attr('xlink:href', '/mole.svg')
        .attr('width', 20)
        .attr('height', 20)
        .attr('x', -10)
        .attr('y', -10)
        .style('pointer-events', 'none');
    }

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    // Apply zoom behavior immediately
    svg.call(zoom);

    // Helper function to create zoom transform for centering on a node
    const getZoomTransform = (node: d3.HierarchyPointNode<TreeNode>, scale: number, offsetX: number = 0, offsetY: number = 0) => {
      const viewBoxCenterX = width / 2;
      const viewBoxCenterY = height / 2;
      
      // Calculate translation to center the node with optional offset
      const translateX = viewBoxCenterX - (node.x + margin.left) * scale + (width * offsetX);
      const translateY = viewBoxCenterY - (node.y + margin.top) * scale + (height * offsetY);
      
      return d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    };

    // Animated intro sequence using zoom transitions
    if (playIntro && playerNode) {
      // Start zoomed in on root
      const rootTransform = getZoomTransform(treeNodes, 3);
      svg.call(zoom.transform, rootTransform);
      
      // Calculate full tree view
      const allNodes = treeNodes.descendants();
      const xExtent = d3.extent(allNodes, d => d.x) as [number, number];
      const yExtent = d3.extent(allNodes, d => d.y) as [number, number];
      
      const treeWidth = xExtent[1] - xExtent[0] + 200;
      const treeHeight = yExtent[1] - yExtent[0] + 200;
      
      const scaleX = (width - margin.left - margin.right) / treeWidth;
      const scaleY = (height - margin.top - margin.bottom) / treeHeight;
      const fullTreeScale = Math.min(scaleX, scaleY, 0.8);
      
      const treeCenterX = (xExtent[0] + xExtent[1]) / 2;
      const treeCenterY = (yExtent[0] + yExtent[1]) / 2;
      const treeCenter = { x: treeCenterX, y: treeCenterY } as d3.HierarchyPointNode<TreeNode>;
      const fullTreeTransform = getZoomTransform(treeCenter, fullTreeScale);
      
      // Final player position - nudged 10% left and 15% down
      const playerTransform = getZoomTransform(playerNode, 3, 0.1, 0.2);
      
      // Animate using zoom transitions
      svg.transition()
        .duration(1000)
        .call(zoom.transform, rootTransform)
        .transition()
        .duration(2000)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, fullTreeTransform)
        .transition()
        .duration(1000)
        .call(zoom.transform, fullTreeTransform)
        .transition()
        .duration(1500)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, playerTransform);
    } else if (playerNode) {
      // No intro: directly position on player - nudged 10% left and 15% down
      const playerTransform = getZoomTransform(playerNode, 3, 0.1, 0.2);
      svg.call(zoom.transform, playerTransform);
    }

  }, [treeData, playerLocation, onNodeClick, playIntro]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TreeVisualizer;