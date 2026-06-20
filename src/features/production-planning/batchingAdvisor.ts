import {
  MIN_ECONOMIC_RUN_KG,
  computeStartupLedger,
  scheduleOrders,
  type Econ,
  type LineParam,
  type Order,
  type SkuParam,
} from './productionModel';

export interface BatchSuggestion {
  id: string;
  family: string;
  productId: string;
  orderIds: string[];
  mergedQty: number;
  startupsSaved: number;
  scrapSavedKg: number;
  scrapSavedOmr: number;
  addedLateDays: number;
  otifBefore: number;
  otifAfter: number;
  feasible: boolean;
  energySavedKwh?: number;
}

interface SuggestOptions {
  dueWindowDays?: number;
  maxAddedLateDays?: number;
  minEconomicRunKg?: number;
  topN?: number;
}

const ADVISOR_DAYS = 30;
const ADVISOR_MACHINES = 1;
const ADVISOR_FAMILY_SETUP_H = 3;
const ADVISOR_DIAMETER_SETUP_H = 0.5;
const ADVISOR_STARTUP_SCRAP_KG_PER_CHANGEOVER = 10;

const round = (value: number, digits = 0): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const batchOrderId = (productId: string) => `batch:${productId}`;

export function applyBatchSuggestion(orders: Order[], suggestion: Pick<BatchSuggestion, 'productId' | 'orderIds' | 'mergedQty'>): Order[] {
  const selected = new Set(suggestion.orderIds);
  const selectedOrders = orders.filter((order) => selected.has(order.id));

  if (selectedOrders.length === 0) {
    return [...orders];
  }

  const merged: Order = {
    id: batchOrderId(suggestion.productId),
    productId: suggestion.productId,
    qty: suggestion.mergedQty,
    dueDay: Math.min(...selectedOrders.map((order) => order.dueDay)),
    priority: selectedOrders.some((order) => order.priority) || undefined,
  };

  let inserted = false;
  const next: Order[] = [];
  for (const order of orders) {
    if (!selected.has(order.id)) {
      next.push(order);
      continue;
    }

    if (!inserted) {
      next.push(merged);
      inserted = true;
    }
  }

  return next;
}

export function suggestBatches(
  orders: Order[],
  products: Record<string, SkuParam>,
  line: LineParam,
  econ: Econ,
  hoursPerDay: number,
  opts: SuggestOptions = {},
): BatchSuggestion[] {
  const dueWindowDays = opts.dueWindowDays ?? 7;
  const maxAddedLateDays = opts.maxAddedLateDays ?? 1;
  const minEconomicRunKg = opts.minEconomicRunKg ?? MIN_ECONOMIC_RUN_KG;
  const topN = opts.topN ?? 3;

  const base = scheduleOrders(
    orders,
    products,
    ADVISOR_DAYS,
    ADVISOR_MACHINES,
    line,
    econ,
    hoursPerDay,
    ADVISOR_FAMILY_SETUP_H,
    ADVISOR_DIAMETER_SETUP_H,
    ADVISOR_STARTUP_SCRAP_KG_PER_CHANGEOVER,
    'grouped',
  );
  const ledgerBase = computeStartupLedger(base, products, econ.materialOmrPerKg, minEconomicRunKg);
  const baseLateByOrder = Object.fromEntries(base.items.map((item) => [item.orderId, item.lateDays]));
  const otifBefore = base.total ? base.onTime / base.total : 1;

  const ordersByProduct = new Map<string, Order[]>();
  for (const order of orders) {
    if (order.qty <= 0 || !products[order.productId]) {
      continue;
    }

    const group = ordersByProduct.get(order.productId) ?? [];
    group.push(order);
    ordersByProduct.set(order.productId, group);
  }

  const candidates = new Map<string, { productId: string; orderIds: string[]; mergedQty: number }>();
  for (const [productId, productOrders] of ordersByProduct) {
    const product = products[productId];
    const sorted = [...productOrders].sort((a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id));

    for (const first of sorted) {
      const group = sorted.filter((order) => order.dueDay >= first.dueDay && order.dueDay - first.dueDay <= dueWindowDays);
      if (group.length < 2) {
        continue;
      }

      const hasSubEconomicOrder = group.some((order) => order.qty * product.kgPerUnit < minEconomicRunKg);
      if (!hasSubEconomicOrder) {
        continue;
      }

      const orderIds = group.map((order) => order.id);
      const key = `${productId}:${orderIds.join('|')}`;
      candidates.set(key, {
        productId,
        orderIds,
        mergedQty: group.reduce((sum, order) => sum + order.qty, 0),
      });
    }
  }

  const suggestions: BatchSuggestion[] = [];
  for (const candidate of candidates.values()) {
    const modifiedOrders = applyBatchSuggestion(orders, candidate);
    const cand = scheduleOrders(
      modifiedOrders,
      products,
      ADVISOR_DAYS,
      ADVISOR_MACHINES,
      line,
      econ,
      hoursPerDay,
      ADVISOR_FAMILY_SETUP_H,
      ADVISOR_DIAMETER_SETUP_H,
      ADVISOR_STARTUP_SCRAP_KG_PER_CHANGEOVER,
      'grouped',
    );
    const ledgerCand = computeStartupLedger(cand, products, econ.materialOmrPerKg, minEconomicRunKg);
    const startupsSaved = ledgerBase.startups - ledgerCand.startups;

    if (startupsSaved <= 0) {
      continue;
    }

    const mergedOrderId = batchOrderId(candidate.productId);
    let addedLateDays = 0;
    for (const item of cand.items) {
      if (item.orderId === mergedOrderId) {
        for (const orderId of candidate.orderIds) {
          addedLateDays = Math.max(addedLateDays, item.lateDays - (baseLateByOrder[orderId] ?? 0));
        }
      } else {
        addedLateDays = Math.max(addedLateDays, item.lateDays - (baseLateByOrder[item.orderId] ?? 0));
      }
    }

    const scrapSavedKg = ledgerBase.startupScrapKg - ledgerCand.startupScrapKg;
    suggestions.push({
      id: `batch:${candidate.productId}:${candidate.orderIds.join('+')}`,
      family: products[candidate.productId].family,
      productId: candidate.productId,
      orderIds: candidate.orderIds,
      mergedQty: candidate.mergedQty,
      startupsSaved,
      scrapSavedKg,
      scrapSavedOmr: scrapSavedKg * econ.materialOmrPerKg,
      addedLateDays: round(Math.max(0, addedLateDays), 1),
      otifBefore,
      otifAfter: cand.total ? cand.onTime / cand.total : 1,
      feasible: addedLateDays <= maxAddedLateDays,
    });
  }

  return suggestions
    .sort((a, b) => b.scrapSavedOmr - a.scrapSavedOmr || a.id.localeCompare(b.id))
    .slice(0, topN);
}
