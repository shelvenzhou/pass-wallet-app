import { useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { hexToString } from 'viem';

interface RequestModalProps {
  onClose: () => void;
}

const RequestModal = ({ onClose }: RequestModalProps) => {
  const { data, setData } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);

  if (!data.requestEvent) return null;

  const getRequestDetails = () => {
    const method = data.requestEvent?.params.request.method;
    if (method === 'personal_sign') {
      const message = hexToString(data.requestEvent?.params.request.params[0]);
      return {
        type: 'Signature Request',
        message,
      };
    }
    return {
      type: 'Unknown Request',
      message: 'Unsupported request type',
    };
  };

  const handleResponse = async (approved: boolean) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/account/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approved,
          request: data.requestEvent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to respond to request');
      }

      // Clear the request from the store
      setData({ requestEvent: undefined });
      onClose();
    } catch (error) {
      console.error('Error responding to request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const { type, message } = getRequestDetails();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{type}</h2>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-2">Message:</p>
          <div className="bg-gray-100 p-3 rounded break-all">
            {message}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={() => handleResponse(false)}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reject
          </button>
          <button
            onClick={() => handleResponse(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestModal; 