'use client';

import { ScrollEngineProvider } from '@/context/ScrollEngine';
import Canvas from '@/components/Canvas/Canvas';
import Preloader from '@/components/Preloader/Preloader';
import Header from '@/components/Header/Header';
import NavDots from '@/components/NavDots/NavDots';
import Hero from '@/components/Hero/Hero';
import Cierre from '@/components/Cierre/Cierre';
import UmbralOverlay from '@/components/UmbralOverlay/UmbralOverlay';

export default function HeroPage() {
  return (
    <ScrollEngineProvider>
      <Preloader />
      {/* Fixed canvas — z-index:0, behind all DOM overlays */}
      <Canvas />
      {/* Fixed copy for Escena 1 — spans s1 station + t1 transition */}
      <UmbralOverlay />
      {/* Fixed UI chrome — always on top */}
      <Header />
      <NavDots />
      {/* Scrollable content */}
      <main>
        <Hero />
        <Cierre />
      </main>
    </ScrollEngineProvider>
  );
}
