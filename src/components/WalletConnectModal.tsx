import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWalletStore } from '../store/walletStore';
import { getWalletKit, setWalletKit } from '../store/walletStore';
import { IWalletKit, WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletKitInitialize = () => {
  const { setData, setActiveSessions } = useWalletStore();

  // useEffect(() => {
  //   setActiveSessions(walletkit.getActiveSessions());

  //   if (walletkit) {
  //     walletkit.on("session_proposal", onSessionProposal);
  //     walletkit.on("session_request", onSessionRequest);
  //     walletkit.on("session_delete", () => {
  //       setActiveSessions(walletkit.getActiveSessions());
  //     });

  //     return () => {
  //       walletkit.off("session_proposal", onSessionProposal);
  //       walletkit.off("session_request", onSessionRequest);
  //       walletkit.off("session_delete", () => {
  //         setActiveSessions(walletkit.getActiveSessions());
  //       });
  //     };
  //   }
  // }, [onSessionProposal, onSessionRequest, walletkit]);


  useEffect(() => {
    const initialiseWalletKit = async () => {
      try {
        const core = new Core({
          projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
        });

        // Initialize the walletkit
        const walletKit = await WalletKit.init({
          core,
          metadata: {
            name: 'PassWallet',
            description: 'PassWallet',
            url: 'blockchain.stanford.edu',
            icons: []
          }
        });

        // Set up event listeners
        walletKit.on('session_proposal', (proposal) => {
          console.log('Session proposal received:', proposal);
          toast.success('Session proposal received' + proposal.id);
          
          setData({ proposal });
        });

        walletKit.on('session_request', (requestEvent) => {
          console.log('Session request received:', requestEvent);
          toast.success('Session request received');
          setData({ requestEvent });
        });

        walletKit.on('session_delete', (session) => {
          console.log('Session deleted:', session);
          toast.success('Session deleted');
        });

        setWalletKit(walletKit);
      } catch (error) {
        console.error('Failed to initialize WalletKit:', error);
        toast.error('Failed to initialize WalletKit');
      }
    };

    initialiseWalletKit();
    console.log('WalletKit initialized');
  }, [setData]);

  return null;
};

const WalletConnectModal = ({ isOpen, onClose }: WalletConnectModalProps) => {
  const [uri, setUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setActiveSessions } = useWalletStore();
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

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
      toast.error('Please enter a WalletConnect URI');
      return;
    }

    const walletKit = getWalletKit();
    if (!walletKit) {
      setError('WalletKit not initialized');
      toast.error('WalletKit not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await walletKit.pair({ uri });
      
      // After successful pairing, update the active sessions
      setActiveSessions(walletKit.getActiveSessions());
      toast.success('WalletConnect session established');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProposal = () => {
    console.log('Approve Proposal');
  }

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

export { WalletConnectModal, WalletKitInitialize};