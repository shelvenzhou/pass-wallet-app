import { useState } from 'react';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: () => void;
  onReject: () => void;
}

const MessageModal = ({ 
  isOpen, 
  onClose,
  onSign,
  onReject
}: MessageModalProps) => {
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
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <h2>Message Signature Request</h2>
        <p style={{ margin: '1.5rem 0', fontSize: '1.1rem' }}>Hello World</p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            style={{ ...buttonStyle, backgroundColor: '#666' }} 
            onClick={onReject}
          >
            Reject
          </button>
          <button 
            style={buttonStyle} 
            onClick={onSign}
          >
            Sign
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageModal;