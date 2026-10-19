import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeRewards } from '@lifespire/engine';

import { db } from '../../db/db';
import { ensureMeta, readMeta } from '../../db/meta';
import { useRunStore } from '../run/runStore';
import { DayScreen } from './DayScreen';

async function resetLocalState(): Promise<void> {
  await db.runs.clear();
  await db.tasks.clear();
  await db.meta.clear();
  useRunStore.setState({ run: null, tasks: {} });
}

beforeEach(resetLocalState);

describe('DayScreen (Home)', () => {
  it('renders a keyboard-reachable button for every start node of the generated map', async () => {
    render(<DayScreen onStartNode={() => {}} />);

    const nodes = await screen.findAllByRole('button', { name: /fila/i });
    const run = await db.runs.toCollection().first();

    expect(run).toBeTruthy();
    expect(nodes).toHaveLength(run!.map.startIds.length);
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the "local-only" status chip and never says "offline"', async () => {
    render(<DayScreen onStartNode={() => {}} />);

    expect(await screen.findByText('local-only')).toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('opens the detail panel with the engine-computed reward when a node is selected', async () => {
    const user = userEvent.setup();
    render(<DayScreen onStartNode={() => {}} />);

    const nodes = await screen.findAllByRole('button', { name: /fila/i });
    const first = nodes[0]!;
    const nodeId = first.getAttribute('data-node-id');
    expect(nodeId).toBeTruthy();

    expect(screen.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();

    await user.click(first);

    const run = await db.runs.toCollection().first();
    const node = run!.map.nodes[nodeId!]!;
    const rewards = computeRewards(node.type, node.difficulty, 0);
    const expectedGold = new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(
      rewards.gold,
    );

    expect(await screen.findByRole('button', { name: 'Empezar' })).toBeInTheDocument();
    const goldValues = await screen.findAllByText(`+${expectedGold}`);
    expect(goldValues.length).toBeGreaterThan(0);

    // The panel shows a localized task title, not the raw node type fallback.
    const task = await db.tasks.get(`${run!.dayKey}:${nodeId!}`);
    expect(task?.title).toBeTruthy();
    expect(task?.title).not.toBe(node.type);
    expect(await screen.findByText(task!.title)).toBeInTheDocument();
  });

  it('navigates to the selected node when "Empezar" is pressed', async () => {
    const user = userEvent.setup();
    const onStartNode = vi.fn();
    render(<DayScreen onStartNode={onStartNode} />);

    const nodes = await screen.findAllByRole('button', { name: /fila/i });
    const first = nodes[0]!;
    const nodeId = first.getAttribute('data-node-id');

    await user.click(first);
    await user.click(await screen.findByRole('button', { name: 'Empezar' }));

    expect(onStartNode).toHaveBeenCalledWith(nodeId);
  });

  it('persists the userSeedSalt exactly once', async () => {
    const first = await ensureMeta();
    const second = await ensureMeta();

    expect(first.userSeedSalt).toMatch(/^[0-9a-f]{64}$/);
    expect(second.userSeedSalt).toBe(first.userSeedSalt);
    expect(await readMeta('userSeedSalt')).toBe(first.userSeedSalt);
  });

  it('reuses the cached map for the same day instead of regenerating it', async () => {
    const first = render(<DayScreen onStartNode={() => {}} />);
    await screen.findAllByRole('button', { name: /fila/i });
    const before = await db.runs.toCollection().first();

    first.unmount();
    render(<DayScreen onStartNode={() => {}} />);
    await screen.findAllByRole('button', { name: /fila/i });

    const runs = await db.runs.toArray();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.seed).toBe(before!.seed);
  });
});
