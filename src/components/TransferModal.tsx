import { useState } from 'react';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: Asset[];
}

const TransferModal = ({ 
  isOpen, 
  onClose, 
  assets = [
    { symbol: 'ETH', name: 'Ethereum', balance: '1.5' },
    { symbol: 'USDC', name: 'USD Coin', balance: '1000.00' },
    { symbol: 'PASS', name: 'PASS Token', balance: '100.00' },
  ] 
}: TransferModalProps) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  if (!isOpen) return null;

  const modalOverlayStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    position: 'relative' as const,
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    border: '1px solid #eaeaea',
    fontSize: '1rem',
  };

  const buttonStyle = {
    padding: '12px 24px',
    backgroundColor: '#0d76fc',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
  };

  const handleTransfer = () => {
    // Implement transfer logic here
    console.log({
      asset: selectedAsset,
      amount,
      destinationAddress,
    });
    onClose();
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <h2>Transfer Assets</h2>
        
        <select 
          style={inputStyle}
          value={selectedAsset?.symbol || ''}
          onChange={(e) => {
            const asset = assets.find(a => a.symbol === e.target.value);
            setSelectedAsset(asset || null);
          }}
        >
          <option value="">Select Asset</option>
          {assets.map((asset) => (
            <option key={asset.symbol} value={asset.symbol}>
              {asset.name} ({asset.balance} {asset.symbol})
            </option>
          ))}
        </select>

        <input
          style={inputStyle}
          type="text"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          style={inputStyle}
          type="text"
          placeholder="Destination Address"
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
        />

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ ...buttonStyle, backgroundColor: '#666' }} 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            style={buttonStyle} 
            onClick={handleTransfer}
            disabled={!selectedAsset || !amount || !destinationAddress}
          >
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;