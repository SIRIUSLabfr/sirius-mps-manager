import { createContext, useContext, useState, ReactNode } from 'react';

interface ActiveProjectContextType {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
}

const ActiveProjectCtx = createContext<ActiveProjectContextType>({
  activeProjectId: null,
  setActiveProjectId: () => {},
});

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  return (
    <ActiveProjectCtx.Provider value={{ activeProjectId, setActiveProjectId }}>
      {children}
    </ActiveProjectCtx.Provider>
  );
}

export const useActiveProject = () => useContext(ActiveProjectCtx);
