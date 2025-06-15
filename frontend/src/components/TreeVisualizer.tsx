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
  isDarkMode?: boolean;
  moleKilled?: boolean;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  treeData,
  playerLocation,
  onNodeClick,
  playIntro = true,
  isDarkMode = true,
  moleKilled = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousLocationRef = useRef<string | null>(null);

  // Visual configuration constants
  const NODE_CONFIG = {
    sizes: {
      root: { base: 26, hover: 26 },
      player: { base: 24, hover: 17 },
      regular: { base: 22, hover: 17 }
    },
    colors: {
      player: { fill: '#3B82F6', stroke: '#60A5FA' },
      mole: { fill: '#EF4444', stroke: '#F87171' },
      fhs: { fill: '#8B5CF6', stroke: '#ffffff' },
      regular: { fill: '#10B981', stroke: '#ffffff' }
    },
    strokeWidth: { base: 2, hover: 3 },
    glowFilter: 'url(#glow)'
  };

  const ICON_CONFIG = {
    size: 40,
    offset: -20,
    paths: {
      player: '/player.svg',
      mole: '/mole.svg'
    }
  };

  const ANIMATION_CONFIG = {
    nodeHover: { duration: 200 },
    navigation: { duration: 750, easing: d3.easeCubicInOut },
    intro: {
      phases: [
        { duration: 1000 }, // Initial zoom
        { duration: 2000, easing: d3.easeCubicInOut }, // Zoom out
        { duration: 1000 }, // Pause
        { duration: 1500, easing: d3.easeCubicInOut } // Zoom to player
      ]
    },
    celebration: { duration: '1s', repeatCount: 'indefinite' }
  };

  const LAYOUT_CONFIG = {
    nodeSpacing: 120,
    margin: { top: 100, right: 150, bottom: 100, left: 150 },
    viewBoxMultiplier: 2.5,
    minHeight: 1200,
    grid: { 
      size: 40, 
      strokeColor: isDarkMode ? '#1f2937' : '#d6d3d1' 
    },
    background: { 
      color: isDarkMode ? '#111827' : '#f5f5f4',
      opacity: isDarkMode ? 0.95 : 1
    }
  };

  const ZOOM_CONFIG = {
    scaleExtent: [0.1, 3] as [number, number],
    defaultScale: 3,
    fullTreeScale: 0.8,
    treePadding: 200,
    nudgeOffset: { x: 0.15, y: 0.2 }
  };

  const LINK_CONFIG = {
    gradient: {
      id: 'link-gradient-v',
      start: { 
        color: isDarkMode ? '#4B5563' : '#78716c',
        opacity: isDarkMode ? 0.6 : 0.4
      },
      end: { 
        color: isDarkMode ? '#6B7280' : '#a8a29e',
        opacity: isDarkMode ? 0.3 : 0.2
      }
    },
    strokeWidth: 2,
    opacity: 0.8
  };

  const LABEL_CONFIG = {
    fontSize: 14,
    fontWeight: { base: '500', player: '700' },
    offset: { parent: -32, leaf: 40 },
    colors: { 
      player: isDarkMode ? '#93C5FD' : '#1e40af',
      regular: isDarkMode ? '#E5E7EB' : '#44403c'
    },
    textShadow: isDarkMode ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)'
  };

  const GLOW_CONFIG = {
    id: 'glow',
    stdDeviation: 3
  };

  const CELEBRATION_CONFIG = {
    ring: {
      startRadius: 15,
      endRadius: 30,
      strokeWidth: 3
    }
  };

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
    const nodeSpacing = LAYOUT_CONFIG.nodeSpacing;
    const dynamicWidth = Math.max(maxNodesAtLevel * nodeSpacing, containerWidth * LAYOUT_CONFIG.viewBoxMultiplier);
    const margin = LAYOUT_CONFIG.margin;
    const width = dynamicWidth;
    const height = Math.max(containerHeight, LAYOUT_CONFIG.minHeight);

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
      .attr('width', LAYOUT_CONFIG.grid.size)
      .attr('height', LAYOUT_CONFIG.grid.size)
      .attr('patternUnits', 'userSpaceOnUse');
    
    pattern.append('path')
      .attr('d', `M ${LAYOUT_CONFIG.grid.size} 0 L 0 0 0 ${LAYOUT_CONFIG.grid.size}`)
      .attr('fill', 'none')
      .attr('stroke', LAYOUT_CONFIG.grid.strokeColor)
      .attr('stroke-width', '1');

    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', LAYOUT_CONFIG.background.color)
      .style('opacity', LAYOUT_CONFIG.background.opacity);
    
    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#grid)')
      .style('opacity', isDarkMode ? 0.3 : 0.1);

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
      .attr('id', LINK_CONFIG.gradient.id)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    
    linkGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', LINK_CONFIG.gradient.start.color)
      .attr('stop-opacity', LINK_CONFIG.gradient.start.opacity);
    
    linkGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', LINK_CONFIG.gradient.end.color)
      .attr('stop-opacity', LINK_CONFIG.gradient.end.opacity);

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
      .style('stroke', `url(#${LINK_CONFIG.gradient.id})`)
      .style('stroke-width', LINK_CONFIG.strokeWidth)
      .style('opacity', LINK_CONFIG.opacity);

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
      .attr('id', GLOW_CONFIG.id);
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', GLOW_CONFIG.stdDeviation)
      .attr('result', 'coloredBlur');
    
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Add a subtle pulse animation for adjacent nodes
    const pulseAnimation = defs.append('style')
      .text(`
        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .adjacent-node {
          animation: subtlePulse 2s ease-in-out infinite;
        }
      `);

    // Helper function to check if a node is adjacent to the current location
    const isAdjacentNode = (nodePath: string, currentPath: string): boolean => {
      // Check if it's the parent directory
      if (currentPath !== '/') {
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
        if (nodePath === parentPath) return true;
      }
      
      // Check if it's a direct child
      if (currentPath === '/') {
        // For root, children are paths with exactly one segment
        const segments = nodePath.split('/').filter(s => s);
        if (segments.length === 1) return true;
      } else {
        // For other directories, check if it's a direct child
        if (nodePath.startsWith(currentPath + '/')) {
          const relativePath = nodePath.substring(currentPath.length + 1);
          // Make sure there are no additional slashes (not a grandchild)
          if (!relativePath.includes('/')) return true;
        }
      }
      
      return false;
    };

    // Add circles for nodes
    node
      .append('circle')
      .attr('r', d => {
        if (d.data.path === '/') return NODE_CONFIG.sizes.root.base;
        if (d.data.path === playerLocation) return NODE_CONFIG.sizes.player.base;
        return NODE_CONFIG.sizes.regular.base;
      })
      .style('fill', d => {
        if (d.data.path === playerLocation) return NODE_CONFIG.colors.player.fill;
        if (d.data.has_mole) return NODE_CONFIG.colors.mole.fill;
        if (d.data.is_fhs) return NODE_CONFIG.colors.fhs.fill;
        return NODE_CONFIG.colors.regular.fill;
      })
      .style('stroke', d => {
        if (d.data.path === playerLocation) return NODE_CONFIG.colors.player.stroke;
        if (d.data.has_mole) return NODE_CONFIG.colors.mole.stroke;
        return NODE_CONFIG.colors.regular.stroke;
      })
      .style('stroke-width', NODE_CONFIG.strokeWidth.base)
      .style('cursor', d => {
        // Only show pointer cursor for adjacent nodes
        if (d.data.path === playerLocation) return 'default';
        return isAdjacentNode(d.data.path, playerLocation) ? 'pointer' : 'not-allowed';
      })
      .style('filter', d => d.data.path === playerLocation ? NODE_CONFIG.glowFilter : 'none')
      .style('opacity', d => {
        // Slightly fade non-adjacent nodes
        if (d.data.path === playerLocation) return 1;
        return isAdjacentNode(d.data.path, playerLocation) ? 1 : 0.6;
      })
      .style('transition', 'all 0.3s ease')
      .attr('class', d => {
        // Add class for adjacent nodes to enable pulse animation
        if (d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) {
          return 'adjacent-node';
        }
        return '';
      })
      .on('mouseover', function(event, d) {
        // Only apply hover effect to adjacent nodes
        if (d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) {
          d3.select(this)
            .transition()
            .duration(ANIMATION_CONFIG.nodeHover.duration)
            .attr('r', d.data.path === '/' ? NODE_CONFIG.sizes.root.hover : NODE_CONFIG.sizes.regular.hover)
            .style('stroke-width', NODE_CONFIG.strokeWidth.hover);
        }
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(ANIMATION_CONFIG.nodeHover.duration)
          .attr('r', d.data.path === '/' ? NODE_CONFIG.sizes.root.base : 
                    d.data.path === playerLocation ? NODE_CONFIG.sizes.player.base : 
                    NODE_CONFIG.sizes.regular.base)
          .style('stroke-width', NODE_CONFIG.strokeWidth.base);
      })
      .on('click', (event, d) => {
        // Only allow clicks on adjacent nodes
        if (onNodeClick && d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) {
          onNodeClick(d.data.path);
        }
      });

    // Add tooltips
    node
      .append('title')
      .text(d => {
        const baseText = `${d.data.path}\n${d.data.description}`;
        const moleText = d.data.has_mole ? '\n🐭 Mole is here!' : '';
        const clickableText = (d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) 
          ? '\n(Click to navigate here)' 
          : '';
        return baseText + moleText + clickableText;
      });

    // Add labels
    node
      .append('text')
      .attr('dy', d => d.children ? LABEL_CONFIG.offset.parent : LABEL_CONFIG.offset.leaf)
      .attr('text-anchor', 'middle')
      .style('font-size', `${LABEL_CONFIG.fontSize}px`)
      .style('font-weight', d => d.data.path === playerLocation ? LABEL_CONFIG.fontWeight.player : LABEL_CONFIG.fontWeight.base)
      .style('fill', d => d.data.path === playerLocation ? LABEL_CONFIG.colors.player : LABEL_CONFIG.colors.regular)
      .style('text-shadow', LABEL_CONFIG.textShadow)
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
        .attr('xlink:href', ICON_CONFIG.paths.player)
        .attr('width', ICON_CONFIG.size)
        .attr('height', ICON_CONFIG.size)
        .attr('x', ICON_CONFIG.offset)
        .attr('y', ICON_CONFIG.offset)
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
        .attr('r', CELEBRATION_CONFIG.ring.startRadius)
        .style('fill', 'none')
        .style('stroke', NODE_CONFIG.colors.mole.fill)
        .style('stroke-width', CELEBRATION_CONFIG.ring.strokeWidth)
        .style('opacity', 0)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('from', CELEBRATION_CONFIG.ring.startRadius)
        .attr('to', CELEBRATION_CONFIG.ring.endRadius)
        .attr('dur', ANIMATION_CONFIG.celebration.duration)
        .attr('repeatCount', ANIMATION_CONFIG.celebration.repeatCount);

      moleGroup
        .select('circle')
        .append('animate')
        .attr('attributeName', 'opacity')
        .attr('from', '1')
        .attr('to', '0')
        .attr('dur', ANIMATION_CONFIG.celebration.duration)
        .attr('repeatCount', ANIMATION_CONFIG.celebration.repeatCount);

      // Add mole SVG with falling animation when killed
      moleGroup
        .append('image')
        .attr('xlink:href', ICON_CONFIG.paths.mole)
        .attr('width', ICON_CONFIG.size)
        .attr('height', ICON_CONFIG.size)
        .attr('x', ICON_CONFIG.offset)
        .attr('y', ICON_CONFIG.offset)
        .style('pointer-events', 'none')
        .classed('mole-death', moleKilled);
    }

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_CONFIG.scaleExtent)
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
      const rootTransform = getZoomTransform(treeNodes, ZOOM_CONFIG.defaultScale);
      svg.call(zoom.transform, rootTransform);
      
      // Calculate full tree view
      const allNodes = treeNodes.descendants();
      const xExtent = d3.extent(allNodes, d => d.x) as [number, number];
      const yExtent = d3.extent(allNodes, d => d.y) as [number, number];
      
      const treeWidth = xExtent[1] - xExtent[0] + ZOOM_CONFIG.treePadding;
      const treeHeight = yExtent[1] - yExtent[0] + ZOOM_CONFIG.treePadding;
      
      const scaleX = (width - margin.left - margin.right) / treeWidth;
      const scaleY = (height - margin.top - margin.bottom) / treeHeight;
      const fullTreeScale = Math.min(scaleX, scaleY, ZOOM_CONFIG.fullTreeScale);
      
      const treeCenterX = (xExtent[0] + xExtent[1]) / 2;
      const treeCenterY = (yExtent[0] + yExtent[1]) / 2;
      const treeCenter = { x: treeCenterX, y: treeCenterY } as d3.HierarchyPointNode<TreeNode>;
      const fullTreeTransform = getZoomTransform(treeCenter, fullTreeScale);
      
      // Final player position with nudge offset
      const playerTransform = getZoomTransform(playerNode, ZOOM_CONFIG.defaultScale, 
                                              ZOOM_CONFIG.nudgeOffset.x, 
                                              ZOOM_CONFIG.nudgeOffset.y);
      
      // Animate using zoom transitions
      const phases = ANIMATION_CONFIG.intro.phases;
      svg.transition()
        .duration(phases[0].duration)
        .call(zoom.transform, rootTransform)
        .transition()
        .duration(phases[1].duration)
        .ease(phases[1].easing!)
        .call(zoom.transform, fullTreeTransform)
        .transition()
        .duration(phases[2].duration)
        .call(zoom.transform, fullTreeTransform)
        .transition()
        .duration(phases[3].duration)
        .ease(phases[3].easing!)
        .call(zoom.transform, playerTransform);
    } else if (playerNode) {
      // No intro: position on player with nudge offset
      const playerTransform = getZoomTransform(playerNode, ZOOM_CONFIG.defaultScale,
                                              ZOOM_CONFIG.nudgeOffset.x,
                                              ZOOM_CONFIG.nudgeOffset.y);
      
      if (isNavigation) {
        // Smooth transition for navigation moves
        svg.transition()
          .duration(ANIMATION_CONFIG.navigation.duration)
          .ease(ANIMATION_CONFIG.navigation.easing)
          .call(zoom.transform, playerTransform);
      } else {
        // Instant positioning for initial load
        svg.call(zoom.transform, playerTransform);
      }
    }

  }, [treeData, playerLocation, onNodeClick, playIntro, isDarkMode, moleKilled]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TreeVisualizer;