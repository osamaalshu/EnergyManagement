// Unified navigation model: Portfolio → Site → Subsystem → Equipment.
//
// Cooling sites come from the portfolio dataset; their subsystems are derived
// from each unit's `type` (the grouping was always implicit in the data). The
// OQ-GN compressor is a *different site* (gas, pilot/synthetic), so it joins the
// portfolio as its own site with a single "Compressed gas" subsystem — honest
// placement, not folded into a cooling building. Compressor leaves route to the
// dedicated CompressorPage; cooling leaves route to the generic EquipmentPage.
import { buildings as coolingBuildings, buildingDetails } from '@/data/mockPortfolioData';
import { compressorData } from '@/data/compressorData';

// A site has one or more subsystems; each subsystem has many equipment units.
// Cooling is a single subsystem (the chiller plant) whose units are the
// chillers, cooling towers, and pumps — not three separate subsystems.
export type SubsystemId = 'cooling' | 'gas';
export type SiteKind = 'cooling' | 'compressor';
export type LeafRoute = 'equipment' | 'compressor';

export const SUBSYSTEM_META: Record<SubsystemId, { label: string }> = {
  cooling: { label: 'Cooling' },
  gas: { label: 'Compressed gas' },
};

export const COMPRESSOR_SITE_ID = 'oq-gn-nizwa';
export const COMPRESSOR_EQUIP_ID = 'cmp-cs-01';

export interface NavEquip {
  id: string;
  name: string;
  status: 'running' | 'off' | 'warning';
  route: LeafRoute;
}
export interface NavSubsystem {
  id: SubsystemId;
  label: string;
  equipment: NavEquip[];
  warnings: number;
}
export interface NavSite {
  id: string;
  name: string;
  sector: string;
  kind: SiteKind;
  subsystems: NavSubsystem[];
}

function coolingSite(b: { id: string; name: string; sector: string }): NavSite {
  const equipment = buildingDetails[b.id]?.equipment ?? [];
  const items: NavEquip[] = equipment.map((e) => ({ id: e.id, name: e.name, status: e.status, route: 'equipment' as const }));
  const subsystems: NavSubsystem[] = items.length
    ? [{ id: 'cooling', label: SUBSYSTEM_META.cooling.label, equipment: items, warnings: items.filter((i) => i.status === 'warning').length }]
    : [];
  return { id: b.id, name: b.name, sector: b.sector, kind: 'cooling', subsystems };
}

const compressorSite: NavSite = {
  id: COMPRESSOR_SITE_ID,
  name: compressorData.meta.site,
  sector: 'Gas · pilot',
  kind: 'compressor',
  subsystems: [
    {
      id: 'gas',
      label: SUBSYSTEM_META.gas.label,
      equipment: [
        { id: COMPRESSOR_EQUIP_ID, name: `Compressor ${compressorData.meta.compressorTag}`, status: 'running', route: 'compressor' },
      ],
      warnings: 0,
    },
  ],
};

/** All sites, cooling first then the compressor pilot. */
export const navSites: NavSite[] = [...coolingBuildings.map(coolingSite), compressorSite];

export const getSite = (id: string | null): NavSite | undefined => navSites.find((s) => s.id === id);
export const getSubsystem = (siteId: string | null, subId: string | null): NavSubsystem | undefined =>
  getSite(siteId)?.subsystems.find((s) => s.id === subId);

/** Find which site/subsystem an equipment id belongs to (for deep links / direct nav). */
export const locateEquip = (equipId: string): { site: NavSite; subsystem: NavSubsystem; equip: NavEquip } | undefined => {
  for (const site of navSites) {
    for (const subsystem of site.subsystems) {
      const equip = subsystem.equipment.find((e) => e.id === equipId);
      if (equip) return { site, subsystem, equip };
    }
  }
  return undefined;
};
