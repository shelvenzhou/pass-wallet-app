import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import styles from '../../styles/Home.module.css';
import Navbar from '../../components/Navbar';

interface MonitorResult {
  wallet: string;
  fromBlock: string;
  toBlock: string;
  newTransactions: number;
  ethTransactions: number;
  erc20Transactions: number;
  erc721Transactions: number;
  erc1155Transactions: number;
}

const TestMonitorPage: NextPage = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [fromBlock, setFromBlock] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/assets/monitorInbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet: walletAddress,
          fromBlock: fromBlock || '0'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to monitor inbox');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const cardStyle = {
    padding: '24px',
    border: '1px solid #eaeaea',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '600px',
    backgroundColor: 'white',
    marginBottom: '24px',
  };

  const inputStyle = {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #eaeaea',
    borderRadius: '8px',
    width: '100%',
    marginBottom: '12px',
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
    width: '100%',
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Test Monitor Inbox - PASS Wallet</title>
        <meta name="description" content="Test the monitor inbox API endpoint" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <h1 className={styles.title}>Test Monitor Inbox API</h1>
        
        <div style={cardStyle}>
          <h2>Monitor Wallet Transactions</h2>
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="walletAddress" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Wallet Address *
              </label>
              <input
                id="walletAddress"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                style={inputStyle}
                required
              />
            </div>
            
            <div>
              <label htmlFor="fromBlock" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                From Block (optional, defaults to 0)
              </label>
              <input
                id="fromBlock"
                type="text"
                value={fromBlock}
                onChange={(e) => setFromBlock(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !walletAddress}
              style={isLoading || !walletAddress ? disabledButtonStyle : buttonStyle}
            >
              {isLoading ? 'Monitoring...' : 'Monitor Inbox'}
            </button>
          </form>
        </div>

        {error && (
          <div style={{
            ...cardStyle,
            backgroundColor: '#fee',
            borderColor: '#fcc',
            color: '#c33'
          }}>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div style={cardStyle}>
            <h3>Monitor Results</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <strong>Wallet:</strong> {result.wallet}
              </div>
              <div>
                <strong>From Block:</strong> {result.fromBlock}
              </div>
              <div>
                <strong>To Block:</strong> {result.toBlock}
              </div>
              <div>
                <strong>Total New Transactions:</strong> {result.newTransactions}
              </div>
            </div>
            
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <h4>Transaction Breakdown</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div>ETH Transfers: <strong>{result.ethTransactions}</strong></div>
                <div>ERC20 Transfers: <strong>{result.erc20Transactions}</strong></div>
                <div>ERC721 Transfers: <strong>{result.erc721Transactions}</strong></div>
                <div>ERC1155 Transfers: <strong>{result.erc1155Transactions}</strong></div>
              </div>
            </div>
            
            <div style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
              <p><strong>Note:</strong> Check the browser console or server logs to see the detailed transaction data that would be saved to the database.</p>
            </div>
          </div>
        )}

        <div style={{
          ...cardStyle,
          backgroundColor: '#f0f8ff',
          borderColor: '#b3d9ff'
        }}>
          <h3>Instructions</h3>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Enter a wallet address that exists in your database</li>
            <li>Optionally specify a starting block number (defaults to 0)</li>
            <li>Click "Monitor Inbox" to scan for transactions</li>
            <li>Check the browser console or server logs for detailed transaction data</li>
            <li>The results will show counts of different transaction types found</li>
          </ol>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '6px' }}>
            <strong>⚠️ Note:</strong> This will scan from the specified block to the latest block, which could take time for large block ranges.
          </div>
        </div>
      </main>
    </div>
  );
};

export default TestMonitorPage; 