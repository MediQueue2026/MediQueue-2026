import { useCallback, useMemo } from 'react'
import { Particles, ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions } from '@tsparticles/engine'

// loadSlim must be a stable reference — defined outside the component
async function particlesInit(engine: Parameters<typeof loadSlim>[0]) {
  await loadSlim(engine)
}

function ParticlesCanvas() {
  const options: ISourceOptions = useMemo(() => ({
    fullScreen: { enable: false },
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    particles: {
      number: { value: 72, density: { enable: true } },
      color: { value: { r: 0, g: 150, b: 105 } },
      links: {
        enable: true,
        distance: 125,
        color: '#009669',
        opacity: 0.72,
        width: 1.5,
      },
      move: {
        enable: true,
        speed: 1.18,
        outModes: { default: 'bounce' },
      },
      size: { value: { min: 2.5, max: 4.5 } },
      opacity: { value: 1 },
      shape: { type: 'circle' },
      paint: [{
        fill: {
          enable: true,
          color: { value: '#009669' },
          opacity: 1,
        },
      }],
    },
    interactivity: {
      events: {
        onHover: { enable: false, mode: 'grab' },
        onClick: { enable: false },
      },
      modes: {
        grab: { distance: 140, links: { opacity: 0.5 } },
      },
    },
    detectRetina: true,
  }), [])

  return (
    <Particles
      id="molecular-particles"
      options={options}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}

export default function MolecularParticles() {
  const init = useCallback(particlesInit, [])

  return (
    <ParticlesProvider init={init}>
      <ParticlesCanvas />
    </ParticlesProvider>
  )
}
