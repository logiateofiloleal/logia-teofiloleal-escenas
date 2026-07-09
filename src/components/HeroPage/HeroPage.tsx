'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollEngineProvider } from '@/context/ScrollEngine';
import { SceneSnapProvider } from '@/context/SceneSnap';
import { FinalGateProvider, useFinalGate } from '@/context/FinalGate';
import Canvas from '@/components/Canvas/Canvas';
import Preloader from '@/components/Preloader/Preloader';
import BrandSeal from '@/components/BrandSeal/BrandSeal';
import Header from '@/components/Header/Header';
import NavDots from '@/components/NavDots/NavDots';
import Hero from '@/components/Hero/Hero';
import Cierre from '@/components/Cierre/Cierre';
import UmbralOverlay from '@/components/UmbralOverlay/UmbralOverlay';
import S4AtmosOverlay from '@/components/S4AtmosOverlay/S4AtmosOverlay';

const FINAL_HOLD_MS = 4000;

// Reserved response to "Tocar la puerta" — no longer reachable by scroll.
// Locks background scroll for FINAL_HOLD_MS, then navigates to /aspirantes.
function FinalGateOverlay() {
  const { open } = useFinalGate();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => router.push('/aspirantes'), FINAL_HOLD_MS);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, router]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800 }}>
      <Cierre />
    </div>
  );
}

export default function HeroPage() {
  return (
    <ScrollEngineProvider>
      <SceneSnapProvider>
        <FinalGateProvider>
          <Preloader />
          {/* Fixed canvas — z-index:0, behind all DOM overlays */}
          <Canvas />
          {/* Fixed copy for Escena 1 — spans s1 station + t1 transition */}
          <UmbralOverlay />
          {/* Atmospheric treatment for s4 — blurs and dims canvas during La Puerta */}
          <S4AtmosOverlay />
          {/* Persistent institutional seal — fixed medio-izquierda, same spot in every scene */}
          <BrandSeal />
          {/* Fixed UI chrome — always on top */}
          <Header />
          <NavDots />
          {/* Scrollable content — Cierre no longer mounts here; it's the
              reserved response rendered by FinalGateOverlay on demand. */}
          <main>
            <Hero />
          </main>
          <FinalGateOverlay />
        </FinalGateProvider>
      </SceneSnapProvider>
    </ScrollEngineProvider>
  );
}
