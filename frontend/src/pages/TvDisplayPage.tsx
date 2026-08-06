import PublicTvDisplay from '../components/PublicTvDisplay'

export default function TvDisplayPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#090d16', overflow: 'hidden' }}>
      <PublicTvDisplay isOpen={true} onClose={() => window.history.back()} />
    </div>
  )
}
