import type { KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { MapLayout } from '@lifespire/engine';
import type { NodeVisitState } from '@lifespire/shared-types';

import { cn } from '@/lib/cn';
import { GLYPH_COLOR } from './glyphColor';
import { NodeGlyph } from './NodeGlyph';
import { deriveEdgeState, type EdgeState, type NodeStateMap } from './nodeState';

const STATE_CLASS: Record<NodeVisitState, string> = {
  locked: 'ls-node--locked',
  available: 'ls-node--available',
  current: 'ls-node--current',
  visited: 'ls-node--visited',
  skipped: 'ls-node--skipped',
};

const EDGE_CLASS: Record<EdgeState, string> = {
  idle: '',
  active: 'ls-path--active',
  done: 'ls-path--done',
};

export interface MapCanvasProps {
  layout: MapLayout;
  states: NodeStateMap;
  closingIds: readonly string[];
  onSelect: (nodeId: string) => void;
}

/**
 * The day's map as SVG (`engine.layoutMap()`): one path per edge and one glyph
 * per node. Locked nodes are neither focusable nor interactive; available and
 * visited nodes are keyboard reachable (Tab + Enter).
 */
export function MapCanvas({ layout, states, closingIds, onSelect }: MapCanvasProps) {
  const { t } = useTranslation(['node', 'home']);
  const closing = new Set(closingIds);
  const positions = new Map(layout.nodes.map((node) => [node.id, node] as const));

  const activate = (event: MouseEvent<SVGGElement> | KeyboardEvent<SVGGElement>, id: string) => {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    onSelect(id);
  };

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={t('home:mapAriaLabel', { count: layout.nodes.length })}
      className="h-full w-full"
    >
      <g>
        {layout.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) {
            return null;
          }
          const edgeState = deriveEdgeState(
            states[edge.from] ?? 'locked',
            states[edge.to] ?? 'locked',
          );
          const midY = (from.y + to.y) / 2;
          return (
            <path
              key={`${edge.from}->${edge.to}`}
              d={`M ${from.x} ${from.y} C ${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`}
              className={cn('ls-path', EDGE_CLASS[edgeState])}
              aria-hidden="true"
              data-edge={`${edge.from}->${edge.to}`}
            />
          );
        })}
      </g>
      <g>
        {layout.nodes.map((node) => {
          const state = states[node.id] ?? 'locked';
          const interactive = state !== 'locked';
          const isCurrent = state === 'current';
          const isClosingNode = closing.has(node.id);
          const label = t('node:ariaLabel', {
            type: t('node:type.' + node.type),
            row: node.row + 1,
            state: t('node:state.' + state),
          });

          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              className={cn(
                'ls-node',
                STATE_CLASS[state],
                interactive && 'ls-node--interactive',
                isCurrent ? 'text-gold' : GLYPH_COLOR[node.type],
              )}
              data-node-id={node.id}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : undefined}
              aria-label={label}
              onClick={interactive ? (event) => activate(event, node.id) : undefined}
              onKeyDown={interactive ? (event) => activate(event, node.id) : undefined}
            >
              {isCurrent ? <circle className="ls-halo" r={30} /> : null}
              <circle className="ls-node-circle" r={isClosingNode ? 24 : 21} />
              {state === 'visited' ? (
                <path className="ls-check" d="M-7 0.5 -2 5.5 7 -4" />
              ) : (
                <NodeGlyph type={node.type} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
