import { useState, useEffect } from 'react';
import { AssetMonitor } from '../services/assetMonitor';
import { useAccount } from 'wagmi';
import Navbar from '../components/Navbar';

const TestAssetsPage = () => {
  const { address, isConnected } = useAccount();
  const [monitoredAddress, setMonitoredAddress] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [assetMonitor] = useState(() => new AssetMonitor());
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // Listen for asset balance updates
    const handleBalanceUpdate = (event: CustomEvent) => {
      console.log('Balance update received:', event.detail);
      setEvents(prev => [...prev, {
        type: 'balance_update',
        timestamp: new Date().toISOString(),
        data: event.detail
      }]);
    };

    window.addEventListener('assetBalanceUpdate', handleBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('assetBalanceUpdate', handleBalanceUpdate as EventListener);
    };
  }, []);

  const startMonitoring = async () => {
    if (!monitoredAddress) return;
    
    try {
      await assetMonitor.startMonitoring(monitoredAddress);
      setIsMonitoring(true);
      setEvents(prev => [...prev, {
        type: 'monitoring_started',
        timestamp: new Date().toISOString(),
        data: { address: monitoredAddress }
      }]);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const testEthTransfer = () => {
    // Simulate an ETH transfer event for testing
    window.dispatchEvent(new CustomEvent('assetBalanceUpdate', {
      detail: {
        address: monitoredAddress,
        symbol: 'ETH',
        amount: '1000000000000000000', // 1 ETH in wei
        type: 'incoming'
      }
    }));
  };

  const testTokenTransfer = () => {
    // Simulate a token transfer event for testing
    window.dispatchEvent(new CustomEvent('assetBalanceUpdate', {
      detail: {
        address: monitoredAddress,
        symbol: 'USDC',
        amount: '1000000', // 1 USDC (6 decimals)
        type: 'incoming'
      }
    }));
  };

  return (
    <div style={{ padding: '20px' }}>
      <Navbar />
      <h1>Asset Monitoring Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Monitor Address</h2>
        <input
          type="text"
          placeholder="Enter address to monitor (0x...)"
          value={monitoredAddress}
          onChange={(e) => setMonitoredAddress(e.target.value)}
          style={{ width: '400px', padding: '10px', marginRight: '10px' }}
        />
        <button 
          onClick={startMonitoring}
          disabled={!monitoredAddress || isMonitoring}
          style={{ padding: '10px 20px' }}
        >
          {isMonitoring ? 'Monitoring...' : 'Start Monitoring'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Events (Simulation)</h2>
        <button onClick={testEthTransfer} style={{ padding: '10px 20px', marginRight: '10px' }}>
          Simulate ETH Transfer
        </button>
        <button onClick={testTokenTransfer} style={{ padding: '10px 20px' }}>
          Simulate Token Transfer
        </button>
      </div>

      <div>
        <h2>Events Log</h2>
        <div style={{ 
          border: '1px solid #ccc', 
          padding: '10px', 
          height: '400px', 
          overflowY: 'scroll',
          backgroundColor: '#f5f5f5'
        }}>
          {events.length === 0 ? (
            <p>No events yet...</p>
          ) : (
            events.map((event, index) => (
              <div key={index} style={{ 
                marginBottom: '10px', 
                padding: '10px', 
                backgroundColor: 'white',
                borderRadius: '5px'
              }}>
                <strong>{event.type}</strong> - {event.timestamp}
                <pre style={{ marginTop: '5px', fontSize: '12px' }}>
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TestAssetsPage; 