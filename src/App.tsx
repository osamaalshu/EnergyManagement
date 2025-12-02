import { useEffect, useState } from 'react';
import Sidebar, { type NavigationKey } from './components/Sidebar';
import TopBar from './components/TopBar';
import DashboardPage from './components/DashboardPage';
import SavingsPage from './components/SavingsPage';

type PageKey = 'dashboard' | 'savings';
type ThemeMode = 'light' | 'dark';

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getDefaultSidebarState = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.innerWidth >= 1024;
};

function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => getDefaultSidebarState());
  const [isEditMode, setIsEditMode] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getPreferredTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const handleNavigate = (key: NavigationKey) => {
    if (key === 'dashboard' || key === 'savings') {
      setActivePage(key);
    }
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

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
          isEditMode={isEditMode}
          onEditModeChange={setIsEditMode}
          activePage={activePage}
          theme={theme}
          onThemeToggle={toggleTheme}
        />
        <main className="flex-1 px-6 pb-16 pt-8">
          {activePage === 'dashboard' ? <DashboardPage isEditMode={isEditMode} /> : <SavingsPage isEditMode={isEditMode} />}
        </main>
      </div>
    </div>
  );
}

export default App;
