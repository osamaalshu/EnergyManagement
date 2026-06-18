import raw from './generated/productionData.json';
import type { ProductionData } from '../types/production';

export const productionData = raw as unknown as ProductionData;
