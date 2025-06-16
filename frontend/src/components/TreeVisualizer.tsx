'use client';

// src/components/TreeVisualizer.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TreeNode } from '@/lib/api';

// Quirky visual configuration - moved outside component to avoid dependency issues
const NODE_CONFIG = {
  sizes: {
    root: { base: 30, hover: 35 },
    player: { base: 26, hover: 28 },
    regular: { base: 20, hover: 24 },
    mole: { base: 22, hover: 26 }
  },
  colors: {
    player: { 
      fill: '#60A5FA', 
      stroke: '#3B82F6',
      glow: '#93C5FD'
    },
    mole: { 
      fill: '#F87171', 
      stroke: '#DC2626',
      pulse: '#FCA5A5'
    },
    fhs: { 
      fill: '#C084FC', 
      stroke: '#9333EA',
      pattern: 'fhs-pattern'
    },
    regular: { 
      fill: '#86EFAC', 
      stroke: '#22C55E',
      hover: '#BBF7D0'
    },
    root: {
      fill: '#FDE047',
      stroke: '#EAB308'
    }
  },
  strokeWidth: { base: 3, hover: 4 },
  wobble: {
    amount: 2,
    speed: 3000
  }
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
  nodeHover: { duration: 300 },
  navigation: { duration: 750, easing: d3.easeCubicInOut },
  intro: {
    phases: [
      { duration: 1000 },
      { duration: 2000, easing: d3.easeCubicInOut },
      { duration: 1000 },
      { duration: 1500, easing: d3.easeCubicInOut },
      { duration: 800 },
      { duration: 1200, easing: d3.easeCubicInOut },
      { duration: 1500, easing: d3.easeCubicInOut }
    ]
  },
  celebration: { duration: '1s', repeatCount: 'indefinite' },
  pulse: { duration: '2s', repeatCount: 'indefinite' }
};

const PARTICLE_CONFIG = {
  count: 30,
  size: { min: 2, max: 6 },
  colors: ['#FDE047', '#A78BFA', '#F87171', '#60A5FA', '#86EFAC'],
  speed: { min: 20000, max: 40000 }
};

const ZOOM_CONFIG = {
  scaleExtent: [0.1, 3] as [number, number],
  defaultScale: 2.5,
  fullTreeScale: 0.8,
  partialTreeScale: 1.5,
  treePadding: 200,
  nudgeOffset: { x: 0.15, y: 0.2 }
};

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

  const LAYOUT_CONFIG = {
    nodeSpacing: 140,
    margin: { top: 120, right: 160, bottom: 120, left: 160 },
    viewBoxMultiplier: 2.5,
    minHeight: 1200,
    background: { 
      color: isDarkMode ? '#0F172A' : '#FEF3C7',
      opacity: 1
    }
  };

  const LINK_CONFIG = {
    strokeWidth: 3,
    opacity: 0.6,
    dashArray: '5,5',
    colors: {
      default: isDarkMode ? '#475569' : '#92400E',
      hover: isDarkMode ? '#64748B' : '#DC2626',
      adjacent: isDarkMode ? '#3B82F6' : '#2563EB'
    }
  };

  const LABEL_CONFIG = {
    fontSize: 15,
    fontWeight: { base: '600', player: '800' },
    offset: { parent: -38, leaf: 44 },
    colors: { 
      player: isDarkMode ? '#93C5FD' : '#1E40AF',
      regular: isDarkMode ? '#E5E7EB' : '#451A03',
      mole: '#DC2626'
    },
    background: {
      fill: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(254, 243, 199, 0.9)',
      padding: { x: 8, y: 4 },
      radius: 4
    }
  };

  const isAnimatingRef = useRef(false);

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
    
    const levelCounts: { [key: number]: number } = {};
    root.each((d) => {
      levelCounts[d.depth] = (levelCounts[d.depth] || 0) + 1;
    });
    const maxNodesAtLevel = Math.max(...Object.values(levelCounts));
    
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

    // Add definitions
    const defs = svg.append('defs');
    
    // Create quirky patterns
    const fhsPattern = defs.append('pattern')
      .attr('id', 'fhs-pattern')
      .attr('patternUnits', 'objectBoundingBox')
      .attr('width', 0.25)
      .attr('height', 0.25);
    
    fhsPattern.append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1.5)
      .attr('fill', '#9333EA')
      .attr('opacity', 0.3);

    // Add glow filters
    const glowFilter = defs.append('filter')
      .attr('id', 'glow');
    
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', 4)
      .attr('result', 'coloredBlur');
    
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Add drop shadow filter
    const dropShadow = defs.append('filter')
      .attr('id', 'drop-shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    
    dropShadow.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 3);
    
    dropShadow.append('feOffset')
      .attr('dx', 2)
      .attr('dy', 2)
      .attr('result', 'offsetblur');
    
    const feMerge2 = dropShadow.append('feMerge');
    feMerge2.append('feMergeNode').attr('in', 'offsetblur');
    feMerge2.append('feMergeNode').attr('in', 'SourceGraphic');

    // Quirky background with floating particles
    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', LAYOUT_CONFIG.background.color)
      .style('opacity', LAYOUT_CONFIG.background.opacity);

    // Add floating background particles
    const particlesGroup = svg.append('g').attr('class', 'particles');
    
    for (let i = 0; i < PARTICLE_CONFIG.count; i++) {
      const particle = particlesGroup.append('circle')
        .attr('cx', Math.random() * width)
        .attr('cy', Math.random() * height)
        .attr('r', Math.random() * (PARTICLE_CONFIG.size.max - PARTICLE_CONFIG.size.min) + PARTICLE_CONFIG.size.min)
        .attr('fill', PARTICLE_CONFIG.colors[Math.floor(Math.random() * PARTICLE_CONFIG.colors.length)])
        .attr('opacity', 0.3);

      // Animate particles floating
      particle
        .transition()
        .duration(Math.random() * (PARTICLE_CONFIG.speed.max - PARTICLE_CONFIG.speed.min) + PARTICLE_CONFIG.speed.min)
        .ease(d3.easeLinear)
        .attr('cy', -20)
        .on('end', function repeat() {
          d3.select(this)
            .attr('cy', height + 20)
            .attr('cx', Math.random() * width)
            .transition()
            .duration(Math.random() * (PARTICLE_CONFIG.speed.max - PARTICLE_CONFIG.speed.min) + PARTICLE_CONFIG.speed.min)
            .ease(d3.easeLinear)
            .attr('cy', -20)
            .on('end', repeat);
        });
    }

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tree layout
    const treeLayout = d3
      .tree<TreeNode>()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
      .separation((a, b) => {
        const aParentChildCount = a.parent ? (a.parent.children?.length || 0) : 0;
        // const bParentChildCount = b.parent ? (b.parent.children?.length || 0) : 0;
        
        if (a.parent === b.parent && aParentChildCount > 3) {
          const aIsLeaf = !a.children || a.children.length === 0;
          const bIsLeaf = !b.children || b.children.length === 0;
          
          if (aIsLeaf && bIsLeaf) {
            return 2.5;
          }
          return 2;
        }
        
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
    
    // Center the root
    const rootX = width / 2;
    treeNodes.each((d) => {
      d.x = d.x + (rootX - treeNodes.x);
    });

    // Helper function to check if a node is adjacent
    const isAdjacentNode = (nodePath: string, currentPath: string): boolean => {
      if (currentPath !== '/') {
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
        if (nodePath === parentPath) return true;
      }
      
      if (currentPath === '/') {
        const segments = nodePath.split('/').filter(s => s);
        if (segments.length === 1) return true;
      } else {
        if (nodePath.startsWith(currentPath + '/')) {
          const relativePath = nodePath.substring(currentPath.length + 1);
          if (!relativePath.includes('/')) return true;
        }
      }
      
      return false;
    };

    // Create quirky curved links
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkGenerator = d3.linkVertical<any, any>()
      .x(d => d.x)
      .y(d => d.y)
      .source(d => {
        // Add some wobble to the source point
        const wobbleX = Math.sin(Date.now() / NODE_CONFIG.wobble.speed) * NODE_CONFIG.wobble.amount;
        return { x: d.source.x + wobbleX, y: d.source.y };
      })
      .target(d => d.target);

    const link = g
      .selectAll('.link')
      .data(treeNodes.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', linkGenerator)
      .style('fill', 'none')
      .style('stroke', d => {
        const targetPath = (d.target as d3.HierarchyPointNode<TreeNode>).data.path;
        if (isAdjacentNode(targetPath, playerLocation) || targetPath === playerLocation) {
          return LINK_CONFIG.colors.adjacent;
        }
        return LINK_CONFIG.colors.default;
      })
      .style('stroke-width', LINK_CONFIG.strokeWidth)
      .style('stroke-dasharray', d => {
        const targetPath = (d.target as d3.HierarchyPointNode<TreeNode>).data.path;
        if (targetPath === playerLocation) return 'none';
        return LINK_CONFIG.dashArray;
      })
      .style('opacity', LINK_CONFIG.opacity)
      .style('filter', 'drop-shadow(0 0 3px rgba(0,0,0,0.3))');

    // Animate link dashes
    link
      .style('stroke-dashoffset', 0)
      .transition()
      .duration(20000)
      .ease(d3.easeLinear)
      .style('stroke-dashoffset', -100)
      .on('end', function repeat() {
        d3.select(this)
          .style('stroke-dashoffset', 0)
          .transition()
          .duration(20000)
          .ease(d3.easeLinear)
          .style('stroke-dashoffset', -100)
          .on('end', repeat);
      });

    // Create node groups
    const node = g
      .selectAll('.node')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Add subtle wobble animation to all nodes
    node.each(function(d, i) {
      const nodeGroup = d3.select(this);
      const delay = i * 100;
      
      nodeGroup
        .transition()
        .delay(delay)
        .duration(NODE_CONFIG.wobble.speed)
        .ease(d3.easeSinInOut)
        .attr('transform', `translate(${d.x + NODE_CONFIG.wobble.amount},${d.y})`)
        .transition()
        .duration(NODE_CONFIG.wobble.speed)
        .ease(d3.easeSinInOut)
        .attr('transform', `translate(${d.x - NODE_CONFIG.wobble.amount},${d.y})`)
        .on('end', function repeat() {
          d3.select(this)
            .transition()
            .duration(NODE_CONFIG.wobble.speed)
            .ease(d3.easeSinInOut)
            .attr('transform', `translate(${d.x + NODE_CONFIG.wobble.amount},${d.y})`)
            .transition()
            .duration(NODE_CONFIG.wobble.speed)
            .ease(d3.easeSinInOut)
            .attr('transform', `translate(${d.x - NODE_CONFIG.wobble.amount},${d.y})`)
            .on('end', repeat);
        });
    });

    // Add node backgrounds (quirky shapes)
    node.each(function(d) {
      const nodeEl = d3.select(this);
      const isRoot = d.data.path === '/';
      const isPlayer = d.data.path === playerLocation;
      const hasMole = d.data.has_mole;
      
      if (isRoot) {
        // Star shape for root
        const starPoints = 8;
        const outerRadius = NODE_CONFIG.sizes.root.base;
        const innerRadius = outerRadius * 0.6;
        
        let path = '';
        for (let i = 0; i < starPoints * 2; i++) {
          const angle = (i * Math.PI) / starPoints;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          path += `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }
        path += 'Z';
        
        nodeEl.append('path')
          .attr('d', path)
          .attr('class', 'node-shape')
          .style('fill', NODE_CONFIG.colors.root.fill)
          .style('stroke', NODE_CONFIG.colors.root.stroke)
          .style('stroke-width', NODE_CONFIG.strokeWidth.base)
          .style('filter', 'url(#drop-shadow)');
      } else if (hasMole) {
        // Irregular shape for mole locations
        const size = NODE_CONFIG.sizes.mole.base;
        nodeEl.append('path')
          .attr('d', `M ${-size},0 Q ${-size/2},${-size} 0,${-size} T ${size},0 Q ${size/2},${size} 0,${size} T ${-size},0`)
          .attr('class', 'node-shape mole-node')
          .style('fill', NODE_CONFIG.colors.mole.fill)
          .style('stroke', NODE_CONFIG.colors.mole.stroke)
          .style('stroke-width', NODE_CONFIG.strokeWidth.base)
          .style('filter', 'url(#glow)');
      } else {
        // Regular circles with personality
        nodeEl.append('circle')
          .attr('r', () => {
            if (isPlayer) return NODE_CONFIG.sizes.player.base;
            if (d.data.is_fhs) return NODE_CONFIG.sizes.regular.base + 2;
            return NODE_CONFIG.sizes.regular.base;
          })
          .attr('class', 'node-shape')
          .style('fill', () => {
            if (isPlayer) return NODE_CONFIG.colors.player.fill;
            if (d.data.is_fhs) return `url(#${NODE_CONFIG.colors.fhs.pattern})`;
            return NODE_CONFIG.colors.regular.fill;
          })
          .style('stroke', () => {
            if (isPlayer) return NODE_CONFIG.colors.player.stroke;
            if (d.data.is_fhs) return NODE_CONFIG.colors.fhs.stroke;
            return NODE_CONFIG.colors.regular.stroke;
          })
          .style('stroke-width', NODE_CONFIG.strokeWidth.base)
          .style('filter', isPlayer ? 'url(#glow)' : 'url(#drop-shadow)');
      }
    });

    // Add interactivity
    node.selectAll('.node-shape')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .style('cursor', function(this: any) {
        const d = d3.select(this.parentNode).datum() as d3.HierarchyPointNode<TreeNode>;
        if (d.data.path === playerLocation) return 'default';
        return isAdjacentNode(d.data.path, playerLocation) ? 'pointer' : 'not-allowed';
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .style('opacity', function(this: any) {
        const d = d3.select(this.parentNode).datum() as d3.HierarchyPointNode<TreeNode>;
        if (d.data.path === playerLocation) return 1;
        return isAdjacentNode(d.data.path, playerLocation) ? 1 : 0.5;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      .on('mouseover', function(this: any, event: MouseEvent) {
        const d = d3.select(this.parentNode).datum() as d3.HierarchyPointNode<TreeNode>;
        if (d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) {
          d3.select(this)
            .transition()
            .duration(ANIMATION_CONFIG.nodeHover.duration)
            .attr('r', function() {
              const currentR = d3.select(this).attr('r');
              return currentR ? parseFloat(currentR) * 1.2 : NODE_CONFIG.sizes.regular.hover;
            })
            .style('filter', 'url(#glow) drop-shadow(0 0 8px rgba(0,0,0,0.4))');
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      .on('mouseout', function(this: any, event: MouseEvent) {
        const d = d3.select(this.parentNode).datum() as d3.HierarchyPointNode<TreeNode>;
        d3.select(this)
          .transition()
          .duration(ANIMATION_CONFIG.nodeHover.duration)
          .attr('r', function() {
            if (d.data.path === '/') return NODE_CONFIG.sizes.root.base;
            if (d.data.path === playerLocation) return NODE_CONFIG.sizes.player.base;
            if (d.data.has_mole) return NODE_CONFIG.sizes.mole.base;
            return NODE_CONFIG.sizes.regular.base;
          })
          .style('filter', d.data.path === playerLocation ? 'url(#glow)' : 'url(#drop-shadow)');
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      .on('click', function(this: any, event: MouseEvent) {
        const d = d3.select(this.parentNode).datum() as d3.HierarchyPointNode<TreeNode>;
        if (onNodeClick && d.data.path !== playerLocation && isAdjacentNode(d.data.path, playerLocation)) {
          onNodeClick(d.data.path);
        }
      });

    // Add pulse animation to mole nodes
    node.filter(d => d.data.has_mole)
      .select('.mole-node')
      .append('animate')
      .attr('attributeName', 'opacity')
      .attr('values', '0.7;1;0.7')
      .attr('dur', ANIMATION_CONFIG.pulse.duration)
      .attr('repeatCount', ANIMATION_CONFIG.pulse.repeatCount);

    // Add labels with backgrounds
    const labels = node
      .append('g')
      .attr('class', 'label-group');

    // Label background
    labels.append('rect')
      .attr('class', 'label-bg')
      .attr('fill', LABEL_CONFIG.background.fill)
      .attr('rx', LABEL_CONFIG.background.radius)
      .attr('ry', LABEL_CONFIG.background.radius)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))');

    // Label text
    labels.append('text')
      .attr('class', 'label-text')
      .attr('dy', d => d.children ? LABEL_CONFIG.offset.parent : LABEL_CONFIG.offset.leaf)
      .attr('text-anchor', 'middle')
      .style('font-size', `${LABEL_CONFIG.fontSize}px`)
      .style('font-weight', d => d.data.path === playerLocation ? LABEL_CONFIG.fontWeight.player : LABEL_CONFIG.fontWeight.base)
      .style('fill', d => {
        if (d.data.path === playerLocation) return LABEL_CONFIG.colors.player;
        if (d.data.has_mole) return LABEL_CONFIG.colors.mole;
        return LABEL_CONFIG.colors.regular;
      })
      .style('font-family', 'Comic Sans MS, cursive')
      .text(d => d.data.name || '/')
      .style('pointer-events', 'none');

    // Size backgrounds to fit text
    labels.each(function() {
      const labelGroup = d3.select(this);
      const text = labelGroup.select('.label-text');
      const bg = labelGroup.select('.label-bg');
      
      const bbox = (text.node() as SVGTextElement).getBBox();
      
      bg.attr('x', bbox.x - LABEL_CONFIG.background.padding.x)
        .attr('y', bbox.y - LABEL_CONFIG.background.padding.y)
        .attr('width', bbox.width + LABEL_CONFIG.background.padding.x * 2)
        .attr('height', bbox.height + LABEL_CONFIG.background.padding.y * 2);
    });

    // Add icon images for special directories
    node.each(function(d) {
      const nodeEl = d3.select(this);
      let iconPath = null;
      
      // Map paths to icon files
      if (d.data.path === '/home') iconPath = '/icons/home.svg';
      else if (d.data.path === '/tmp') iconPath = '/icons/trash.svg';
      else if (d.data.path === '/etc') iconPath = '/icons/config.svg';
      else if (d.data.path === '/bin' || d.data.path === '/sbin') iconPath = '/icons/terminal.svg';
      else if (d.data.path === '/var') iconPath = '/icons/database.svg';
      else if (d.data.path === '/usr') iconPath = '/icons/folder.svg';
      else if (d.data.path === '/opt') iconPath = '/icons/package.svg';
      else if (d.data.path.includes('Documents')) iconPath = '/icons/document.svg';
      else if (d.data.path.includes('Pictures')) iconPath = '/icons/picture.svg';
      else if (d.data.path.includes('Downloads')) iconPath = '/icons/download.svg';
      else if (d.data.path.includes('Desktop')) iconPath = '/icons/desktop.svg';
      
      if (iconPath) {
        const iconSize = 24;
        nodeEl.append('image')
          .attr('class', 'directory-icon')
          .attr('xlink:href', iconPath)
          .attr('width', iconSize)
          .attr('height', iconSize)
          .attr('x', -iconSize / 2)
          .attr('y', -iconSize / 2)
          .style('pointer-events', 'none')
          .style('opacity', 0.8)
          .on('mouseover', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .style('opacity', 1)
              .attr('transform', 'scale(1.2)');
          })
          .on('mouseout', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .style('opacity', 0.8)
              .attr('transform', 'scale(1)');
          });
      }
    });

    // Add player and mole indicators
    const playerNode = treeNodes.descendants().find(d => d.data.path === playerLocation);
    if (playerNode) {
      const playerGroup = node
        .filter(d => d.data.path === playerLocation)
        .append('g');

      playerGroup
        .append('image')
        .attr('xlink:href', ICON_CONFIG.paths.player)
        .attr('width', ICON_CONFIG.size)
        .attr('height', ICON_CONFIG.size)
        .attr('x', ICON_CONFIG.offset)
        .attr('y', ICON_CONFIG.offset)
        .style('pointer-events', 'none')
        .style('filter', 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))');
    }

    const moleNode = treeNodes.descendants().find(d => d.data.has_mole);
    if (moleNode) {
      const moleGroup = node
        .filter(d => d.data.has_mole)
        .append('g');

      // Celebration rings
      for (let i = 0; i < 3; i++) {
        moleGroup
          .append('circle')
          .attr('r', 15)
          .style('fill', 'none')
          .style('stroke', NODE_CONFIG.colors.mole.pulse)
          .style('stroke-width', 2)
          .style('opacity', 0)
          .transition()
          .delay(i * 300)
          .duration(1500)
          .ease(d3.easeQuadOut)
          .attr('r', 40)
          .style('opacity', 0)
          .on('end', function repeat() {
            d3.select(this)
              .attr('r', 15)
              .style('opacity', 0)
              .transition()
              .duration(1500)
              .ease(d3.easeQuadOut)
              .attr('r', 40)
              .style('opacity', 0)
              .on('end', repeat);
          });
      }

      moleGroup
        .append('image')
        .attr('xlink:href', ICON_CONFIG.paths.mole)
        .attr('width', ICON_CONFIG.size)
        .attr('height', ICON_CONFIG.size)
        .attr('x', ICON_CONFIG.offset)
        .attr('y', ICON_CONFIG.offset)
        .style('pointer-events', 'none')
        .style('filter', 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))')
        .classed('mole-death', moleKilled);
    }

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_CONFIG.scaleExtent)
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Zoom transform helper
    const getZoomTransform = (node: d3.HierarchyPointNode<TreeNode>, scale: number, offsetX: number = 0, offsetY: number = 0) => {
      const viewBoxCenterX = width / 2;
      const viewBoxCenterY = height / 2;
      
      const translateX = viewBoxCenterX - (node.x + margin.left) * scale + (width * offsetX);
      const translateY = viewBoxCenterY - (node.y + margin.top) * scale + (height * offsetY);
      
      return d3.zoomIdentity.translate(translateX, translateY).scale(scale);
    };

    // Handle intro and navigation animations
    if (playIntro && playerNode) {
      const rootTransform = getZoomTransform(treeNodes, ZOOM_CONFIG.defaultScale);
      svg.call(zoom.transform, rootTransform);
      
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
      
      const moleTransform = moleNode ? getZoomTransform(moleNode, ZOOM_CONFIG.defaultScale) : null;
      const partialTreeTransform = getZoomTransform(treeCenter, ZOOM_CONFIG.partialTreeScale);
      const playerTransform = getZoomTransform(playerNode, ZOOM_CONFIG.defaultScale, 
                                              ZOOM_CONFIG.nudgeOffset.x, 
                                              ZOOM_CONFIG.nudgeOffset.y);
      
      const phases = ANIMATION_CONFIG.intro.phases;
      
      if (moleTransform) {
        isAnimatingRef.current = true;
        
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
          .call(zoom.transform, moleTransform)
        .transition()
          .duration(phases[4].duration)
          .call(zoom.transform, moleTransform)
        .transition()
          .duration(phases[5].duration)
          .ease(phases[5].easing!)
          .call(zoom.transform, partialTreeTransform)
        .transition()
          .duration(phases[6].duration)
          .ease(phases[6].easing!)
          .call(zoom.transform, playerTransform)
          .on('end', () => {
            isAnimatingRef.current = false;
          });
      } else {
        isAnimatingRef.current = true;
        
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
          .duration(phases[6].duration)
          .ease(phases[6].easing!)
          .call(zoom.transform, playerTransform)
          .on('end', () => {
            isAnimatingRef.current = false;
          });
      }
    } else if (playerNode && !isAnimatingRef.current) {
      const playerTransform = getZoomTransform(playerNode, ZOOM_CONFIG.defaultScale,
                                              ZOOM_CONFIG.nudgeOffset.x,
                                              ZOOM_CONFIG.nudgeOffset.y);
      
      if (isNavigation) {
        svg.transition()
          .duration(ANIMATION_CONFIG.navigation.duration)
          .ease(ANIMATION_CONFIG.navigation.easing)
          .call(zoom.transform, playerTransform);
      } else {
        svg.call(zoom.transform, playerTransform);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData, playerLocation, onNodeClick, playIntro, isDarkMode, moleKilled]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default TreeVisualizer;