import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Recharts ResponsiveContainer requires a sized parent in jsdom.
vi.mock('recharts', async (importOriginal) => {
  const recharts = await importOriginal<typeof import('recharts')>();
  return {
    ...recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => children,
  };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
