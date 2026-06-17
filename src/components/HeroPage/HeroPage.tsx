'use client';

import { ScrollEngineProvider } from '@/context/ScrollEngine';
import { SceneSnapProvider } from '@/context/SceneSnap';
import Canvas from '@/components/Canvas/Canvas';
import Preloader from '@/components/Preloader/Preloader';
import Header from '@/components/Header/Header';
import NavDots from '@/components/NavDots/NavDots';
import Hero from '@/components/Hero/Hero';
import Cierre from '@/components/Cierre/Cierre';
import UmbralOverlay from '@/components/UmbralOverlay/UmbralOverlay';
import S4AtmosOverlay from '@/components/S4AtmosOverlay/S4AtmosOverlay';

export default function HeroPage() {
  return (
    <ScrollEngineProvider>
      <SceneSnapProvider>
        <Preloader />
        {/* Fixed canvas — z-index:0, behind all DOM overlays */}
        <Canvas />
        {/* Fixed copy for Escena 1 — spans s1 station + t1 transition */}
        <UmbralOverlay />
        {/* Atmospheric treatment for s4 — blurs and dims canvas during La Puerta */}
        <S4AtmosOverlay />
        {/* Fixed UI chrome — always on top */}
        <Header />
        <NavDots />
        {/* Scrollable content */}
        <main>
          <Hero />
          <Cierre />
        </main>
      </SceneSnapProvider>
    </ScrollEngineProvider>
  );
}
