import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface DomainTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: string; // Account Address
  fromAddress: string; // From address is the current logged in user address (not account address)
}

const DomainTransferModal = ({ isOpen, onClose, account, fromAddress }: DomainTransferModalProps) => {
  const [newOwner, setNewOwner] = useState('');
  const [domainUrl, setDomainUrl] = useState('https://www.tally.xyz'); // Example domain name
  const [isLoading, setIsLoading] = useState(false);

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

  const handleTransfer = async () => {
    if (!newOwner) {
      toast.error('Please enter a new owner address');
      return;
    }
    if (!domainUrl || !domainUrl.startsWith('https://')) {
      toast.error('Please enter a valid domain name');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/transferDomain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passAccountAddress: account,
          fromAddress: fromAddress, // From address is the current logged in user address (not account address)
          toAddress: newOwner,
          domainUrl: domainUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to transfer domain');
      }

      toast.success('Domain transfer initiated successfully');
      onClose();
    } catch (error) {
      console.error('Error transferring domain:', error);
      toast.error('Failed to transfer domain');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <h2>Transfer Domain</h2>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Account: {account}</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>From: {fromAddress}</p>
          <input
            type="text"
            placeholder="Enter domain URL"
            value={domainUrl}
            onChange={(e) => setDomainUrl(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Enter new owner address"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...buttonStyle, backgroundColor: '#666' }}
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DomainTransferModal;