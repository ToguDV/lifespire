// Scaffolding owned by the map-generation task: replaced by the real
// validator. Kept here so `src/index.ts` keeps a valid public surface while
// that work lands.
import type { MapData, MapGenInput, ValidationResult } from '../types';

export function validateMap(map: MapData, input: MapGenInput): ValidationResult {
  void map;
  void input;
  throw new Error('validateMap is not implemented yet');
}
