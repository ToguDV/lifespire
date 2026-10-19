// Scaffolding owned by the map-generation task: replaced by the real
// deterministic generator. Kept here so `src/index.ts` keeps a valid public
// surface while that work lands.
import type { MapData, MapGenInput } from '../types';

export function generateMap(seed: string, input: MapGenInput): MapData {
  void seed;
  void input;
  throw new Error('generateMap is not implemented yet');
}
