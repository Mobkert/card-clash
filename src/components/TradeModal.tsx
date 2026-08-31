import './TradeModal.css'

interface TradeModalProps {
  onChoose: (mode: 'damage' | 'cooldown') => void
  onClose: () => void
}

export function TradeModal({ onChoose, onClose }: TradeModalProps) {
  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Trade — Pick Your Deal</h3>
        <p>For the next 3 rounds, choose one:</p>
        <div className="trade-modal__options">
          <button type="button" className="trade-modal__option trade-modal__option--damage" onClick={() => onChoose('damage')}>
            <strong>1.5× Damage</strong>
            <span>Deal and take 1.5× damage</span>
          </button>
          <button type="button" className="trade-modal__option trade-modal__option--cooldown" onClick={() => onChoose('cooldown')}>
            <strong>−1 Cooldowns</strong>
            <span>Abilities cooldown 1 turn faster, but take 1.75× damage</span>
          </button>
        </div>
      </div>
    </div>
  )
}
