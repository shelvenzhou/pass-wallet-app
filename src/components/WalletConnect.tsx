import { useState } from 'react';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletConnectModal = ({ isOpen, onClose }: WalletConnectModalProps) => {
  const [uri, setUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleConnect = async () => {
    if (!uri.trim()) {
      setError('Please enter a WalletConnect URI');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/account/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uri }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to establish WalletConnect session');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <h2>Connect with WalletConnect</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Please paste your WalletConnect URI below
        </p>
        
        <textarea
          style={inputStyle}
          placeholder="wc:..."
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          rows={4}
        />

        {error && (
          <p style={{ color: '#dc3545', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ ...buttonStyle, backgroundColor: '#666' }} 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            style={buttonStyle} 
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletConnectModal;
