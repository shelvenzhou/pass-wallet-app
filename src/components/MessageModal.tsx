import { useState } from 'react';
import { MessageRequest } from '../types';
interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: () => Promise<void>;
  onReject: () => Promise<void>;
  messageRequest: MessageRequest;
}

const MessageModal = ({ 
  isOpen, 
  onClose,
  onSign,
  onReject,
  messageRequest
}: MessageModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSign = async () => {
    setIsProcessing(true);
    try {
      await onSign();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

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
    maxHeight: '90vh',
    overflow: 'auto',
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

  return (
    <div style={modalOverlayStyle} onClick={isProcessing ? undefined : onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        {messageRequest?.type === 'proposal' ? (
          <>
            <h2>Session Proposal</h2>
            <p>Connection request from: {messageRequest?.dappUrl}</p>
          </>
        ) : (
          <>
            <h2>Message Signature Request</h2>
            {messageRequest?.dappUrl && (
              <p style={{ 
                margin: '1rem 0', 
                color: '#666', 
                fontSize: '0.9rem',
                wordBreak: 'break-all' 
              }}>
                From: {messageRequest?.dappUrl}
              </p>
            )}
            <div style={{ 
              margin: '1.5rem 0', 
              padding: '1rem',
              background: '#f5f5f5',
              borderRadius: '8px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap'
            }}>
              {messageRequest?.message.split('\n').map((paragraph: string, index: number) => (
                <p key={index} style={{ margin: 0, fontSize: '1.1rem' }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ ...buttonStyle, backgroundColor: '#666' }} 
            onClick={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? 'Rejecting...' : 'Reject'}
          </button>
          <button 
            style={buttonStyle} 
            onClick={handleSign}
            disabled={isProcessing}
          >
            {isProcessing ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;