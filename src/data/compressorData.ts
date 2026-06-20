// Typed loader for the generated OQ-GN compressor pilot-preview dataset.
// Source: scripts/enrich_compressor.py (block5_gas_compressor synthetic).
import raw from './generated/compressorData.json';
import type { CompressorData } from '@/features/compressor-pilot/compressor';

export const compressorData = raw as CompressorData;
