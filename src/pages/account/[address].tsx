import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/Home.module.css';
import Navbar from '../../components/Navbar';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import TransferModal from '../../components/TransferModal';
import MessageModal from '../../components/MessageModal';

import { toast } from 'react-hot-toast';
import { Core } from '@walletconnect/core';
import { IWalletKit, WalletKit } from '@reown/walletkit';

import { buildApprovedNamespaces } from '@walletconnect/utils';
import { ProposalTypes } from '@walletconnect/types';
import { SUPPORTED_CHAINS, SUPPORTED_METHODS, SUPPORTED_EVENTS } from '../../constants';

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

interface MessageRequest {
  type: 'proposal' | 'request';
  message: string;
  dappUrl: string;
  id: number;
}

const AccountDetailsPage: NextPage = () => {
  const router = useRouter();
  const { address: accountAddress } = router.query;
  const { isConnected } = useAccount();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [accountDetails, setAccountDetails] = useState<{
    name: string;
    balance: string;
    owner: string;
    assets: Asset[];
    transactions: Transaction[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [proposalParams, setProposalParams] = useState<ProposalTypes.Struct | null>(null);

  const [walletKit, setWalletKit] = useState<IWalletKit | null>(null);
  const [messageRequest, setMessageRequest] = useState<MessageRequest | null>(null);

  const handleApproveProposal = async () => {
    console.log("Approve proposal");
    if (!walletKit) {
      toast.error('WalletKit not initialized');
      return;
    }
    console.log(proposalParams);
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: proposalParams as ProposalTypes.Struct,
      supportedNamespaces: {
        eip155: {
          chains: SUPPORTED_CHAINS,
          methods: SUPPORTED_METHODS,
          events: SUPPORTED_EVENTS,
          accounts: [`eip155:11155111:${accountAddress}`],
        },
      },
    });
    console.log(approvedNamespaces);

    await walletKit.approveSession({
      id: parseInt(proposalParams!.id.toString()),
      namespaces: approvedNamespaces,
    });
    console.log(walletKit.getActiveSessions());
    toast.success("Session approved");
    setIsProposalModalOpen(false);
  }

  const handleRejectProposal = async () => {
    console.log("Reject proposal");
    toast.error("Reject proposal not implemented");
  }

  const handleApproveSignRequest = async () => {
    console.log("Approve sign request");
    console.log(messageRequest?.message);
    console.log(accountAddress);
    console.log(walletKit);
    if (!messageRequest?.message || !accountAddress || !walletKit) {
      toast.error("Invalid message or account address");
      return;
    }
  
    try {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageRequest.message,
          address: accountAddress,
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to sign message');
      }
  
      const { signature } = await response.json();
      console.log(signature);
      toast.success("Message signed successfully "+signature);
      // Send signature back to DApp
      await walletKit.respondSessionRequest({
        topic: messageRequest.id.toString(),
        response: {
          id: messageRequest.id,
          result: signature,
          jsonrpc: "2.0",
        },
      });
      
      // Close the message modal after successful signing
      setIsMessageModalOpen(false);
      toast.success("Message signed successfully");
      
    } catch (error) {
      console.error('Error signing message:', error);
      toast.error("Failed to sign message");
    }
  }

  const handleRejectRequest = async () => {
    console.log("Reject request");
    toast.error("Reject request not implemented");
  }

  const getMessage = () => {
    return {
      message: "Hello, world!",
      dappUrl: "https://example.com"
    }
  }

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  useEffect(() => {
    const fetchAccountDetails = async () => {
      if (!accountAddress) return;
      
      try {
        setIsLoading(true);
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

  useEffect(() => {
    const initializeWalletKit = async () => {
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

        setWalletKit(walletKit);

        // Set up event listeners
        walletKit.on('session_proposal', (proposal) => {
          console.log('Session proposal received:', proposal);
          console.log(proposal.params);
          toast.success('Session proposal received' + proposal.id);
          setProposalParams(proposal.params);
          setIsProposalModalOpen(true);

          setMessageRequest({
            type: 'proposal',
            message: "A DApp wants to connect to your wallet. Do you want to approve this connection?",
            dappUrl: proposal.params.proposer.metadata.url,
            id: proposal.id
          });
        });

        walletKit.on('session_request', (requestEvent) => {
          console.log('Session request received:', requestEvent);
          toast.success('Session request received');
          console.log(requestEvent.params);

          const message = requestEvent.params.request.params[1];
          
          setMessageRequest({
            type: 'request',
            message: message,
            dappUrl: "https://example.com",
            id: requestEvent.id
          });
          setIsMessageModalOpen(true);
        });

        walletKit.on('session_delete', (session) => {
          console.log('Session deleted:', session);
          toast.success('Session deleted');
        });
      } catch (error) {
        console.error('Failed to initialize WalletKit:', error);
        toast.error('Failed to initialize WalletKit');
      }
    };

    initializeWalletKit();
    console.log('WalletKit initialized');
    console.log(walletKit?.getActiveSessions());
  }, []);

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

  const inputStyle = {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #eaeaea',
    borderRadius: '8px',
    width: '100%',
    marginBottom: '12px',
  };

  const handleConnect = async () => {
    const uri = (document.getElementById('walletconnect-uri') as HTMLInputElement).value;
    if (!walletKit) {
      toast.error('WalletKit not initialized');
      return;
    }
    await walletKit.pair({ uri });
    toast.success('WalletConnect session established');
    // Log the active sessions
    console.log(walletKit.getActiveSessions());      
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
                <input style={inputStyle} type="text" id="walletconnect-uri" placeholder="Enter Walletconnect URI" />
                <button style={buttonStyle} onClick={handleConnect}>Walletconnect Login</button>
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
            <MessageModal
              isOpen={isMessageModalOpen}
              onClose={() => setIsMessageModalOpen(false)}
              onSign={handleApproveSignRequest}
              onReject={handleRejectRequest}
              message={messageRequest?.message}
              dappUrl={messageRequest?.dappUrl}
            />
            <MessageModal
              isOpen={isProposalModalOpen}
              onClose={() => setIsProposalModalOpen(false)}
              onSign={handleApproveProposal}
              onReject={handleRejectProposal}
              message={messageRequest?.message}
              dappUrl={messageRequest?.dappUrl}
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