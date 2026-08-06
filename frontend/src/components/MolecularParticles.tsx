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
      number: { value: 55, density: { enable: true } },
      color: { value: '#14b8a6' },
      links: {
        enable: true,
        distance: 130,
        color: '#14b8a6',
        opacity: 0.22,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.6,
        outModes: { default: 'bounce' },
      },
      size: { value: { min: 1, max: 3 } },
      opacity: { value: { min: 0.25, max: 0.5 } },
    },
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
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
