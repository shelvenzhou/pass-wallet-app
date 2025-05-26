import { useState, useEffect } from 'react';

interface AssetBalanceDisplayProps {
  address: string;
}

const AssetBalanceDisplay = ({ address }: AssetBalanceDisplayProps) => {
  const [balances, setBalances] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const response = await fetch(`/api/account/${address}`);
        const data = await response.json();
        setBalances(data.assets || []);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      }
    };

    // Initial fetch
    fetchBalances();

    // Listen for balance updates
    const handleBalanceUpdate = (event: CustomEvent) => {
      if (event.detail.address === address) {
        console.log('Refreshing balances due to update');
        fetchBalances();
      }
    };

    window.addEventListener('assetBalanceUpdate', handleBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('assetBalanceUpdate', handleBalanceUpdate as EventListener);
    };
  }, [address]);

  return (
    <div style={{ 
      border: '1px solid #ccc', 
      padding: '15px', 
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3>Asset Balances</h3>
      <p style={{ fontSize: '12px', color: '#666' }}>
        Last updated: {lastUpdate}
      </p>
      
      {balances.length === 0 ? (
        <p>No assets found</p>
      ) : (
        <div>
          {balances.map((asset, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: index < balances.length - 1 ? '1px solid #eee' : 'none'
            }}>
              <span>{asset.symbol}</span>
              <span>{asset.balance}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssetBalanceDisplay; 