import { useEffect, useState } from 'react';
import Sidebar, { type ActivePage } from '@/shared/Sidebar';
import TopBar from '@/shared/TopBar';
import DashboardPage from '@/pages/DashboardPage/DashboardPage';
import PortfolioPage from '@/pages/PortfolioPage/PortfolioPage';
import BuildingPage from '@/pages/BuildingPage/BuildingPage';
import SubsystemPage from '@/pages/SubsystemPage/SubsystemPage';
import EquipmentPage from '@/pages/EquipmentPage/EquipmentPage';
import TariffPage from '@/pages/TariffPage/TariffPage';
import CompressorPage from '@/pages/CompressorPage/CompressorPage';
import PvBessPage from '@/pages/PvBessPage/PvBessPage';
import TwinPage from '@/pages/TwinPage/TwinPage';
import AnalyseHubPage from '@/pages/AnalyseHubPage/AnalyseHubPage';
import ProductionPlannerPage from '@/pages/ProductionPlannerPage/ProductionPlannerPage';
import ScrapAnalyzerPage from '@/pages/ScrapAnalyzerPage/ScrapAnalyzerPage';
import PlantTelemetryPage from '@/pages/PlantTelemetryPage/PlantTelemetryPage';
import DeliveryViewPage from '@/pages/DeliveryViewPage/DeliveryViewPage';
import SystemSummaryModal from '@/shared/SystemSummaryModal';
import { type Crumb } from '@/shared/Breadcrumb';
import {
  navSites, getSite, getSubsystem, locateEquip,
  COMPRESSOR_SITE_ID, COMPRESSOR_EQUIP_ID, PVBESS_SITE_ID, PVBESS_EQUIP, type LeafRoute,
} from '@/lib/portfolioNav';

type ThemeMode = 'light' | 'dark';

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getDefaultSidebarState = () => {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 1024;
};

function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => getDefaultSidebarState());
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  // Drill-down state: Portfolio → Site → Subsystem → Equipment
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [systemSummaryOpen, setSystemSummaryOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage, selectedSiteId, selectedSubsystemId, selectedEquipmentId]);

  const closeMobileSidebar = () => { if (window.innerWidth < 1024) setSidebarOpen(false); };

  // ── Navigation (one model for cooling sites and the compressor pilot) ──

  const goOverview = () => { setActivePage('dashboard'); setSelectedSiteId(null); setSelectedSubsystemId(null); setSelectedEquipmentId(null); closeMobileSidebar(); };
  const goPortfolio = () => { setActivePage('portfolio'); setSelectedSiteId(null); setSelectedSubsystemId(null); setSelectedEquipmentId(null); closeMobileSidebar(); };
  const goTariff = () => { setActivePage('tariff'); closeMobileSidebar(); };
  const goAnalyse = () => { setActivePage('analyse'); closeMobileSidebar(); };
  const goProduction = () => { setActivePage('production'); closeMobileSidebar(); };
  const goScrap = () => { setActivePage('scrap'); closeMobileSidebar(); };
  const goPlant = () => { setActivePage('plant'); closeMobileSidebar(); };
  const goDelivery = () => { setActivePage('delivery'); closeMobileSidebar(); };
  const goTwin = () => { setSelectedSiteId(PVBESS_SITE_ID); setSelectedSubsystemId(null); setSelectedEquipmentId(null); setActivePage('twin'); closeMobileSidebar(); };
  const goPvBessFocus = (focus: 'pv' | 'inverters' | 'bess' | null) => {
    setSelectedSiteId(PVBESS_SITE_ID);
    setSelectedSubsystemId(focus === 'bess' ? 'bess' : focus ? 'pv' : null);
    setSelectedEquipmentId(focus === 'inverters' ? PVBESS_EQUIP.inverters : null);
    setActivePage('pvbess');
    closeMobileSidebar();
  };

  const goSite = (siteId: string) => {
    const site = getSite(siteId);
    if (!site) return;
    setSelectedSiteId(siteId);
    setSelectedSubsystemId(null);
    setSelectedEquipmentId(null);
    if (site.kind === 'compressor') {
      setSelectedSubsystemId('gas');
      setSelectedEquipmentId(COMPRESSOR_EQUIP_ID);
      setActivePage('compressor');
    } else if (site.kind === 'renewables') {
      setActivePage('pvbess');
    } else {
      setActivePage('building');
    }
    closeMobileSidebar();
  };

  const goSubsystem = (siteId: string, subId: string) => {
    const site = getSite(siteId);
    if (!site) return;
    setSelectedSiteId(siteId);
    setSelectedSubsystemId(subId);
    setSelectedEquipmentId(null);
    if (site.kind === 'compressor') {
      setSelectedEquipmentId(COMPRESSOR_EQUIP_ID);
      setActivePage('compressor');
    } else if (site.kind === 'renewables') {
      setActivePage('pvbess');
    } else {
      setActivePage('subsystem');
    }
    closeMobileSidebar();
  };

  const goEquip = (equipId: string, route: LeafRoute) => {
    const loc = locateEquip(equipId);
    if (loc) {
      setSelectedSiteId(loc.site.id);
      setSelectedSubsystemId(loc.subsystem.id);
    }
    setSelectedEquipmentId(equipId);
    setActivePage(route === 'compressor' ? 'compressor' : route === 'pvbess' ? 'pvbess' : 'equipment');
    closeMobileSidebar();
  };

  // ── Breadcrumb builder (segments carry sibling switchers) ──────────────

  const makeCrumbs = (siteId: string | null, subId: string | null, equipId: string | null): Crumb[] => {
    const crumbs: Crumb[] = [{ key: 'portfolio', label: 'Portfolio', onClick: goPortfolio }];
    const site = getSite(siteId);
    if (!site) return crumbs;
    crumbs.push({
      key: 'site',
      label: site.name,
      onClick: () => goSite(site.id),
      siblings: navSites.map((s) => ({ id: s.id, label: s.name, hint: s.sector, active: s.id === site.id, onSelect: () => goSite(s.id) })),
    });
    const sub = subId ? site.subsystems.find((s) => s.id === subId) : undefined;
    if (!sub) return crumbs;
    crumbs.push({
      key: 'sub',
      label: sub.label,
      onClick: () => goSubsystem(site.id, sub.id),
      siblings: site.subsystems.map((s) => ({ id: s.id, label: s.label, hint: `${s.equipment.length}`, active: s.id === sub.id, onSelect: () => goSubsystem(site.id, s.id) })),
    });
    const eq = equipId ? sub.equipment.find((e) => e.id === equipId) : undefined;
    if (!eq) return crumbs;
    crumbs.push({
      key: 'eq',
      label: eq.name,
      siblings: sub.equipment.map((e) => ({ id: e.id, label: e.name, active: e.id === eq.id, onSelect: () => goEquip(e.id, e.route) })),
    });
    return crumbs;
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // ── Page renderer ──────────────────────────────────────────────

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigateToPortfolio={goPortfolio}
            onNavigateToBuilding={goSite}
            onNavigateToEquipment={(_buildingId: string, equipmentId: string) => goEquip(equipmentId, 'equipment')}
            onNavigateToTariff={goTariff}
          />
        );
      case 'tariff':
        return <TariffPage onBack={goOverview} />;
      case 'compressor':
        return <CompressorPage crumbs={makeCrumbs(COMPRESSOR_SITE_ID, 'gas', COMPRESSOR_EQUIP_ID)} onBack={goPortfolio} />;
      case 'pvbess':
        return (
          <PvBessPage
            crumbs={makeCrumbs(PVBESS_SITE_ID, selectedSubsystemId, selectedEquipmentId)}
            focus={selectedSubsystemId === 'bess' ? 'bess' : selectedEquipmentId === PVBESS_EQUIP.inverters ? 'inverters' : selectedSubsystemId === 'pv' ? 'pv' : null}
            onBack={goPortfolio}
            onOpenTwin={goTwin}
          />
        );
      case 'twin':
        return <TwinPage crumbs={[...makeCrumbs(PVBESS_SITE_ID, null, null), { key: 'twin', label: 'Digital twin' }]} onOpenAnalytics={goPvBessFocus} />;
      case 'analyse':
        return <AnalyseHubPage onPlanner={goProduction} onDelivery={goDelivery} onScrap={goScrap} />;
      case 'production':
        return <ProductionPlannerPage onBack={goOverview} />;
      case 'scrap':
        return <ScrapAnalyzerPage onBack={goOverview} />;
      case 'plant':
        return <PlantTelemetryPage onBack={goOverview} />;
      case 'delivery':
        return <DeliveryViewPage onBack={goOverview} />;
      case 'portfolio':
        return <PortfolioPage onNavigateToBuilding={goSite} />;
      case 'building':
        return selectedSiteId ? (
          <BuildingPage
            buildingId={selectedSiteId}
            crumbs={makeCrumbs(selectedSiteId, null, null)}
            onBack={goPortfolio}
            onNavigateToSubsystem={(subId) => goSubsystem(selectedSiteId, subId)}
            onNavigateToEquipment={(equipId) => goEquip(equipId, 'equipment')}
            onOpenSystemSummary={() => setSystemSummaryOpen(true)}
          />
        ) : null;
      case 'subsystem': {
        const site = getSite(selectedSiteId);
        const sub = getSubsystem(selectedSiteId, selectedSubsystemId);
        return site && sub ? (
          <SubsystemPage
            crumbs={makeCrumbs(selectedSiteId, selectedSubsystemId, null)}
            site={site}
            subsystem={sub}
            onBack={() => goSite(site.id)}
            onNavigateToEquipment={goEquip}
          />
        ) : null;
      }
      case 'equipment':
        return selectedSiteId && selectedEquipmentId ? (
          <EquipmentPage
            buildingId={selectedSiteId}
            equipmentId={selectedEquipmentId}
            crumbs={makeCrumbs(selectedSiteId, selectedSubsystemId, selectedEquipmentId)}
            onBack={() => (selectedSubsystemId ? goSubsystem(selectedSiteId, selectedSubsystemId) : goSite(selectedSiteId))}
            onNavigateToPortfolio={goPortfolio}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen bg-surface-light text-slate-900 transition-colors duration-200 dark:bg-surface-dark dark:text-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePage={activePage}
        selectedSiteId={selectedSiteId}
        selectedSubsystemId={selectedSubsystemId}
        selectedEquipmentId={selectedEquipmentId}
        onOverview={goOverview}
        onPortfolio={goPortfolio}
        onSite={goSite}
        onSubsystem={goSubsystem}
        onEquip={goEquip}
        onAnalyse={goAnalyse}
        onProduction={goProduction}
        onScrap={goScrap}
        onPlant={goPlant}
        onDelivery={goDelivery}
      />
      <div className={`flex min-h-screen flex-col transition-[padding] duration-300 ${sidebarOpen ? 'lg:pl-72' : 'lg:pl-0'}`}>
        <TopBar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          activePage={activePage}
          theme={theme}
          onThemeToggle={toggleTheme}
        />
        <main className="flex-1 px-6 pb-16 pt-8">
          {renderPage()}
        </main>
      </div>

      {systemSummaryOpen && (
        <SystemSummaryModal onClose={() => setSystemSummaryOpen(false)} />
      )}
    </div>
  );
}

export default App;
