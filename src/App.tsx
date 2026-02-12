import { useEffect, useState } from 'react';
import Sidebar, { type NavigationKey, type ActivePage } from './components/Sidebar';
import TopBar from './components/TopBar';
import DashboardPage from './components/DashboardPage';
import PortfolioPage from './components/PortfolioPage';
import BuildingPage from './components/BuildingPage';
import EquipmentPage from './components/EquipmentPage';

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

  // Drill-down state
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  // ── Navigation handlers ────────────────────────────────────────

  const handleNavigate = (key: NavigationKey) => {
    if (key === 'dashboard' || key === 'portfolio') {
      setActivePage(key);
      setSelectedBuildingId(null);
      setSelectedEquipmentId(null);
    }
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleNavigateToPortfolio = () => {
    setActivePage('portfolio');
    setSelectedBuildingId(null);
    setSelectedEquipmentId(null);
  };

  const handleNavigateToBuilding = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    setSelectedEquipmentId(null);
    setActivePage('building');
  };

  const handleNavigateToEquipment = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    setActivePage('equipment');
  };

  /** Navigate directly to equipment from dashboard (warning/notification click) */
  const handleNavigateToEquipmentDirect = (buildingId: string, equipmentId: string) => {
    setSelectedBuildingId(buildingId);
    setSelectedEquipmentId(equipmentId);
    setActivePage('equipment');
  };

  const handleBackFromBuilding = () => {
    setSelectedBuildingId(null);
    setSelectedEquipmentId(null);
    setActivePage('portfolio');
  };

  const handleBackFromEquipment = () => {
    setSelectedEquipmentId(null);
    setActivePage('building');
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // ── Page renderer ──────────────────────────────────────────────

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigateToPortfolio={handleNavigateToPortfolio}
            onNavigateToBuilding={handleNavigateToBuilding}
            onNavigateToEquipment={handleNavigateToEquipmentDirect}
          />
        );
      case 'portfolio':
        return <PortfolioPage onNavigateToBuilding={handleNavigateToBuilding} />;
      case 'building':
        return selectedBuildingId ? (
          <BuildingPage
            buildingId={selectedBuildingId}
            onBack={handleBackFromBuilding}
            onNavigateToEquipment={handleNavigateToEquipment}
            onNavigateToBuilding={handleNavigateToBuilding}
          />
        ) : null;
      case 'equipment':
        return selectedBuildingId && selectedEquipmentId ? (
          <EquipmentPage
            buildingId={selectedBuildingId}
            equipmentId={selectedEquipmentId}
            onBack={handleBackFromEquipment}
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
        onNavigate={handleNavigate}
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
    </div>
  );
}

export default App;
