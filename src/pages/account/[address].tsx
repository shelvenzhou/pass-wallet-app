import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/Home.module.css';
import Navbar from '../../components/Navbar';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import TransferModal from '../../components/TransferModal';


interface Transaction {
  hash: string;
  type: 'send' | 'receive';
  amount: string;
  timestamp: string;
}

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  icon?: string;
}

const AccountDetailsPage: NextPage = () => {
  const router = useRouter();
  const { address: accountAddress } = router.query;
  const { isConnected } = useAccount();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [accountDetails, setAccountDetails] = useState<{
    name: string;
    balance: string;
    owner: string;
    assets: Asset[];
    transactions: Transaction[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAccountDetails = async () => {
      if (!accountAddress) return;
      
      try {
        setIsLoading(true);
        // Update the API path to match your file structure
        const response = await fetch(`/api/account/${accountAddress}`);
        const data = await response.json();
        
        if (response.ok) {
          setAccountDetails(data);
        } else {
          console.error('Failed to fetch account details:', data);
        }
      } catch (error) {
        console.error('Error fetching account details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountDetails();
  }, [accountAddress]);

  const cardStyle = {
    padding: '24px',
    border: '1px solid #eaeaea',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'white',
    marginBottom: '24px',
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
    marginRight: '12px',
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Account Details - PASS Wallet</title>
        <meta name="description" content="View account details" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {!isConnected ? (
          <div className={styles.connectContainer}>
            <p>Please connect your wallet to view account details</p>
          </div>
        ) : isLoading ? (
          <div className={styles.loadingContainer}>
            <p>Loading account details...</p>
          </div>
        ) : accountDetails ? (
          <>
            <div style={{ width: '100%', maxWidth: '800px' }}>
              <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className={styles.title}>{accountDetails.name}</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button style={buttonStyle}>WalletConnect Login</button>
                  <button 
                    style={buttonStyle}
                    onClick={() => setIsTransferModalOpen(true)}
                  >
                    PASS Transfer
                  </button>
                </div>
              </div>

              <div style={cardStyle}>
                <h2>Account Overview</h2>
                <p>Address: {accountAddress}</p>
                <p>Balance: {accountDetails.balance}</p>
                <p>Owner: {accountDetails.owner}</p>
              </div>

              <div style={cardStyle}>
                <h2>Assets</h2>
                {accountDetails.assets.map((asset, index) => (
                  <div key={index} style={{ 
                    padding: '16px 0',
                    borderBottom: index < accountDetails.assets.length - 1 ? '1px solid #eaeaea' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {asset.icon && (
                        <img 
                          src={asset.icon} 
                          alt={asset.symbol} 
                          style={{ width: '32px', height: '32px' }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: '500' }}>{asset.name}</div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>{asset.balance} {asset.symbol}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{asset.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={cardStyle}>
                <h2>Recent Transactions</h2>
                {accountDetails.transactions.map((tx, index) => (
                  <div key={index} style={{ 
                    padding: '12px 0',
                    borderBottom: index < accountDetails.transactions.length - 1 ? '1px solid #eaeaea' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ color: tx.type === 'send' ? '#dc3545' : '#28a745' }}>
                        {tx.type === 'send' ? '↑' : '↓'} {tx.amount}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>{tx.timestamp}</div>
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      {tx.hash}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <TransferModal
              isOpen={isTransferModalOpen}
              onClose={() => setIsTransferModalOpen(false)}
              assets={accountDetails.assets}
            />
          </>
        ) : (
          <div className={styles.errorContainer}>
            <p>Failed to load account details</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountDetailsPage;