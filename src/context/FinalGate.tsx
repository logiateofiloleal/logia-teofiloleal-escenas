'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';

interface FinalGateCtx {
  open: boolean;
  trigger: () => void;
}

const Ctx = createContext<FinalGateCtx | null>(null);

export function FinalGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);

  const trigger = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setOpen(true);
  }, []);

  return <Ctx.Provider value={{ open, trigger }}>{children}</Ctx.Provider>;
}

export function useFinalGate(): FinalGateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFinalGate must be inside FinalGateProvider');
  return ctx;
}
