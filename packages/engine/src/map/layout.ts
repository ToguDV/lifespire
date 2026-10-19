// Scaffolding owned by the map-generation task: replaced by the real layout
// normalizer. Kept here so `src/index.ts` keeps a valid public surface while
// that work lands.
import type { MapData, MapLayout } from '../types';

export function layoutMap(map: MapData): MapLayout {
  void map;
  throw new Error('layoutMap is not implemented yet');
}
