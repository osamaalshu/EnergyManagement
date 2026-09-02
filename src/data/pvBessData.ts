// Typed loader for the generated PV + BESS reference dataset.
// Source: tools/export_pv_bess_dashboard.py (enerlytics platform) — recorded public
// datasets replayed through the physics; the dispatch is a stated scenario.
import raw from './generated/pvBessData.json';
import type { PvBessData } from '@/features/pv-bess/pvBess';

export const pvBessData = raw as unknown as PvBessData;
