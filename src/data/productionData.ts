import raw from './generated/productionData.json';
import type { ProductionData } from '@/features/production-planning/production';

export const productionData = raw as unknown as ProductionData;
