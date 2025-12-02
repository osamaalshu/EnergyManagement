import { useState } from 'react';
import Sidebar, { type NavigationKey } from './components/Sidebar';
import TopBar from './components/TopBar';
import DashboardPage from './components/DashboardPage';
import SavingsPage from './components/SavingsPage';

type PageKey = 'dashboard' | 'savings';

function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleNavigate = (key: NavigationKey) => {
    if (key === 'dashboard' || key === 'savings') {
      setActivePage(key);
      if (key !== 'dashboard') {
        setIsEditMode(false);
      }
    }
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-surface-dark text-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePage={activePage}
        onNavigate={handleNavigate}
      />
      <div className="flex flex-1 flex-col">
        <TopBar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isEditMode={isEditMode}
          onEditModeChange={setIsEditMode}
          activePage={activePage}
        />
        <main className="flex-1 px-6 pb-16 pt-8">
          {activePage === 'dashboard' ? <DashboardPage isEditMode={isEditMode} /> : <SavingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
