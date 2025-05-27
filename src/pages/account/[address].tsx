import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/Home.module.css';
import Navbar from '../../components/Navbar';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import TransferModal from '../../components/TransferModal';
import MessageModal from '../../components/MessageModal';
import { MessageRequest } from '../../types';
import DomainTransferModal from '../../components/DomainTransferModal';

import { toast } from 'react-hot-toast';
import { Core } from '@walletconnect/core';
import { IWalletKit, WalletKit } from '@reown/walletkit';

import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { ProposalTypes } from '@walletconnect/types';
import { SUPPORTED_CHAINS, SUPPORTED_METHODS, SUPPORTED_EVENTS, CHAIN_NAME_MAP } from '../../constants';
import { hexToString } from 'viem';

// FontAwesome imports
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser, 
  faLink, 
  faMapMarkerAlt, 
  faWallet, 
  faCrown, 
  faCopy,
  faSync
} from '@fortawesome/free-solid-svg-icons';

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

interface SignedMessage {
  message: string;
  signer: string;
  domainUrl: string;
  signature: string;
  sessionId: string | null;
  createdAt: string;
}

interface InboxTransaction {
  hash: string;
  blockNumber: string;
  tokenType: 'ETH' | 'ERC20' | 'ERC721' | 'ERC1155';
  amount: string;
  fromAddress: string;
  toAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress?: string;
  tokenId?: string;
  createdAt: string;
}

// Add these helper functions before the component
const getTokenTypeColor = (tokenType: string) => {
  switch (tokenType) {
    case 'ETH':
      return '#627eea';
    case 'ERC20':
      return '#f7931a';
    case 'ERC721':
      return '#9c27b0';
    case 'ERC1155':
      return '#4caf50';
    default:
      return '#666';
  }
};

const formatAmount = (amount: string, decimals: number, symbol: string) => {
  if (decimals === 0) {
    return `${amount} ${symbol}`;
  }
  
  const divisor = Math.pow(10, decimals);
  const formattedAmount = (parseFloat(amount) / divisor).toFixed(6);
  return `${formattedAmount} ${symbol}`;
};

const AccountDetailsPage: NextPage = () => {
  const router = useRouter();
  const { address: accountAddress } = router.query;
  const { isConnected, address: connectedAddress } = useAccount();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isDomainTransferModalOpen, setIsDomainTransferModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'inbox'>('messages');
  const [accountDetails, setAccountDetails] = useState<{
    name: string;
    balance: string;
    owner: string;
    assets: Asset[];
    transactions: Transaction[];
    signedMessages: SignedMessage[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [proposalParams, setProposalParams] = useState<ProposalTypes.Struct | null>(null);

  const [walletKit, setWalletKit] = useState<IWalletKit | null>(null);
  const [messageRequest, setMessageRequest] = useState<MessageRequest | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [inboxTransactions, setInboxTransactions] = useState<InboxTransaction[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);

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
          accounts: [`eip155:11155111:${accountAddress}`, `eip155:1:${accountAddress}`],
        },
      },
    });

    await walletKit.approveSession({
      id: parseInt(proposalParams!.id.toString()),
      namespaces: approvedNamespaces,
    });
    
    // Update the active sessions list
    updateActiveSessions(walletKit);
    toast.success("Session approved");
    setIsProposalModalOpen(false);
  }

  const handleRejectProposal = async () => {
    console.log("Reject proposal");
    await walletKit?.rejectSession({
      id: proposalParams!.id,
      reason: getSdkError("USER_REJECTED")
    });
    toast.success("Reject proposal successful");
    setIsProposalModalOpen(false);
    updateActiveSessions(walletKit);
  }

  const handleApproveSignRequest = async () => {
    console.log("Approve sign request");
    if (!messageRequest?.message || !accountAddress || !walletKit) {
      toast.error("Invalid message or account address");
      setIsMessageModalOpen(false);
      updateActiveSessions(walletKit);
      return;
    }
    // Call backend Sign API
    try {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageRequest.message,
          address: accountAddress,
          signerAddress: connectedAddress,
          domainUrl: messageRequest.dappUrl || 'unknown',
          sessionId: messageRequest.topic || null
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to sign message');
      }
  
      const { signature } = await response.json();
  
      if (!messageRequest.topic) {
        toast.error("Error: No topic found");
        return;
      }
      
      // Send signature back to DApp
      await walletKit.respondSessionRequest({
        topic: messageRequest.topic,
        response: {
          id: messageRequest.id,
          result: signature,
          jsonrpc: "2.0",
        },
      });
      
    } catch (error) {
      console.error('Error signing message:', error);
      toast.error("Failed to sign message");
    }
    // OK
    toast.success("Message signed successfully");
    setIsMessageModalOpen(false);
    updateActiveSessions(walletKit);
  }

  const handleRejectRequest = async () => {
    console.log("Reject request");
    if (!messageRequest?.topic) {
      toast.error("Error: No topic found");
      return;
    }
    await walletKit?.respondSessionRequest({
      topic: messageRequest.topic,
      response: {
        id: messageRequest.id,
        error: {
          code: 5000,
          message: "User rejected the request",
        },
        jsonrpc: "2.0",
      },
    });
    toast.success("Reject request successful");
    setIsProposalModalOpen(false);
    updateActiveSessions(walletKit);
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
        const response = await fetch(`/api/account/${accountAddress}?connectedAddress=${connectedAddress}`);
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
  }, [accountAddress, activeSessions]);

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
            url: 'www.example.com',
            icons: []
          }
        });

        setWalletKit(walletKit);
        updateActiveSessions(walletKit);

        // Set up event listeners
        walletKit.on('session_proposal', (proposal) => {
          console.log('Session proposal received:', proposal);
          console.log(proposal.params);
          // toast.success('Session proposal received' + proposal.id);
          setProposalParams(proposal.params);
          setIsProposalModalOpen(true);

          setMessageRequest({
            type: 'proposal',
            message: "",
            dappUrl: proposal.params.proposer.metadata.url,
            id: proposal.id
          });
          updateActiveSessions(walletKit);
        });

        walletKit.on('session_request', (requestEvent) => {
          console.log('Session request received:', requestEvent);
          // toast.success('Session request received');
          console.log("Request event params: " + JSON.stringify(requestEvent.params));

          const message = requestEvent.params.request.params[0];
          const messageString = hexToString(message);
          console.log("Message string: " + messageString);

          // Get URL
          const url = requestEvent.verifyContext?.verified?.origin;
          console.log("URL: " + url);
          
          // TODO: Pass the URL correctly.
          setMessageRequest({
            type: 'request',
            message: messageString,
            dappUrl: url,
            id: requestEvent.id,
            topic: requestEvent.topic
          });
          setIsMessageModalOpen(true);
        });

        walletKit.on('session_delete', (session) => {
          // console.log('Session deleted:', session);
          toast.success('Session deleted');
          updateActiveSessions(walletKit);
        });
      } catch (error) {
        console.error('Failed to initialize WalletKit:', error);
        toast.error('Failed to initialize WalletKit');
      }
    };

    initializeWalletKit();
    // console.log('WalletKit initialized');
    // console.log(walletKit?.getActiveSessions());
  }, []);

  // Update the fetchInboxTransactions function
  useEffect(() => {
    const fetchInboxTransactions = async () => {
      if (!accountAddress) return;
      
      try {
        setIsLoadingInbox(true);
        const response = await fetch('/api/assets/monitorInbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wallet: accountAddress,
            fromBlock: '0'
          }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Map the API response to InboxTransaction format
          const mappedTransactions: InboxTransaction[] = data.transactions.map((tx: any) => ({
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            tokenType: tx.tokenType || 'ETH',
            amount: tx.value,
            fromAddress: tx.from,
            toAddress: tx.to,
            symbol: tx.tokenSymbol || 'ETH',
            name: tx.tokenName || 'Ethereum',
            decimals: parseInt(tx.tokenDecimal || '18'),
            contractAddress: tx.contractAddress,
            tokenId: tx.tokenID,
            createdAt: new Date().toISOString() // API doesn't return this, so use current time
          }));
          
          setInboxTransactions(mappedTransactions);
        } else {
          console.error('Failed to monitor inbox:', data);
        }
      } catch (error) {
        console.error('Error monitoring inbox:', error);
      } finally {
        setIsLoadingInbox(false);
      }
    };

    fetchInboxTransactions();
  }, [accountAddress]);

  const refreshInboxTransactions = async () => {
    if (!accountAddress) return;
    
    try {
      setIsLoadingInbox(true);
      const response = await fetch('/api/assets/monitorInbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet: accountAddress,
          fromBlock: '0'
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Map the API response to InboxTransaction format
        const mappedTransactions: InboxTransaction[] = data.transactions.map((tx: any) => ({
          hash: tx.hash,
          blockNumber: tx.blockNumber,
          tokenType: tx.tokenType || 'ETH',
          amount: tx.value,
          fromAddress: tx.from,
          toAddress: tx.to,
          symbol: tx.tokenSymbol || 'ETH',
          name: tx.tokenName || 'Ethereum',
          decimals: parseInt(tx.tokenDecimal || '18'),
          contractAddress: tx.contractAddress,
          tokenId: tx.tokenID,
          createdAt: new Date().toISOString()
        }));
        
        setInboxTransactions(mappedTransactions);
        toast.success('Inbox refreshed successfully');
      } else {
        toast.error('Failed to monitor inbox');
      }
    } catch (error) {
      console.error('Error refreshing inbox transactions:', error);
      toast.error('Error refreshing inbox transactions');
    } finally {
      setIsLoadingInbox(false);
    }
  };

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

  const tabStyle = {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#666',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    marginRight: '12px',
  };

  const activeTabStyle = {
    ...tabStyle,
    color: '#0d76fc',
    borderBottomColor: '#0d76fc',
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
    // toast.success('WalletConnect session established');
    // Log the active sessions
  };

  // Convert object to array when setting sessions
  const updateActiveSessions = (walletKit: IWalletKit | null) => {
    // clear input field
    if (document.getElementById('walletconnect-uri') as HTMLInputElement) {
      (document.getElementById('walletconnect-uri') as HTMLInputElement).value = '';
    }
    const sessions = walletKit?.getActiveSessions() || {};
    setActiveSessions(Object.values(sessions));
    // Update signed messages history

  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy to clipboard');
    }
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
                  <button 
                    style={{...buttonStyle, backgroundColor: '#4CAF50'}}
                    onClick={() => {
                      setIsDomainTransferModalOpen(true);
                    }}
                  >
                    Transfer Domain
                  </button>
                </div>
              </div>
              
              <div style={{
                ...cardStyle,
                backgroundColor: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                
                <div style={{ position: 'relative', zIndex: 2 }}>
                <h2 style={{ marginBottom: '20px' }}>Account Overview</h2>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '20px',
                    marginBottom: '20px'
                  }}>
                  

                    {/* Account Address Card */}
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e9ecef'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '12px',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#333'
                      }}>
                        <FontAwesomeIcon 
                          icon={faMapMarkerAlt} 
                          style={{ marginRight: '8px', fontSize: '18px' }} 
                        />
                        Account Address
                      </div>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        background: '#e9ecef',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        gap: '8px'
                      }}>
                        <div style={{ 
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          wordBreak: 'break-all',
                          color: '#495057',
                          flex: 1
                        }}>
                          {accountAddress}
                        </div>
                        <button
                          onClick={() => copyToClipboard(accountAddress as string, 'Account address')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            color: '#666',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    </div>
                     {/* Connected User Card */}
                     <div style={{
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e9ecef'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '12px',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#333'
                      }}>
                        <FontAwesomeIcon 
                          icon={faLink} 
                          style={{ marginRight: '8px', fontSize: '18px' }} 
                        />
                        Connected As
                      </div>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        background: '#e9ecef',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        gap: '8px'
                      }}>
                        <div style={{ 
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          wordBreak: 'break-all',
                          color: '#495057',
                          flex: 1
                        }}>
                          {connectedAddress}
                        </div>
                        <button
                          onClick={() => copyToClipboard(connectedAddress || '', 'Connected address')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            color: '#666',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '20px'
                  }}>
                    {/* Balance Card */}
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e9ecef',
                      textAlign: 'center'
                    }}>
                      <div style={{ 
                        fontSize: '32px',
                        marginBottom: '8px',
                      }}>
                        <FontAwesomeIcon icon={faWallet} />
                      </div>
                      <div style={{ 
                        fontSize: '14px',
                        color: '#666',
                        marginBottom: '4px'
                      }}>Balance</div>
                      <div style={{ 
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#333'
                      }}>
                        {accountDetails.balance}
                      </div>
                    </div>

                    {/* Owner Card */}
                    <div style={{
                      background: '#f8f9fa',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '1px solid #e9ecef',
                      textAlign: 'center'
                      
                    }}>
                      <div style={{ 
                        fontSize: '32px',
                        marginBottom: '8px',
                        
                      }}>
                        <FontAwesomeIcon icon={faCrown} />
                      </div>
                      <div style={{ 
                        fontSize: '14px',
                        color: '#666',
                        marginBottom: '4px'
                      }}>Owner</div>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e9ecef',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        gap: '8px'
                      }}>
                        <div style={{ 
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          color: '#495057',
                          flex: 1,
                          textAlign: 'center'
                        }}>
                          {accountDetails.owner}
                        </div>
                        <button
                          onClick={() => copyToClipboard(accountDetails.owner, 'Owner address')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            color: '#666',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={cardStyle}>
                <h2 style={{ marginBottom: '20px' }}>Connection Manager</h2>
                
                {/* Connection Input Section */}
                <div style={{ 
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '16px', 
                    fontWeight: '500',
                    color: '#333'
                  }}>
                    Connect New Session
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <input 
                        style={{
                          ...inputStyle,
                          marginBottom: '0'
                        }} 
                        type="text" 
                        id="walletconnect-uri" 
                        placeholder="Enter WalletConnect URI" 
                      />
                    </div>
                    <button style={buttonStyle} onClick={handleConnect}>
                      Connect
                    </button>
                  </div>
                </div>

                {/* Active Sessions Section */}
                <div>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '16px', 
                    fontWeight: '500',
                    color: '#333'
                  }}>
                    Active Sessions ({activeSessions.length})
                  </h3>
                  {activeSessions.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #e9ecef'
                    }}>
                      No active sessions. Connect to a dApp using the URI above.
                    </div>
                  ) : (
                    <div style={{
                      border: '1px solid #e9ecef',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      {activeSessions.map((session, index) => (
                        <div
                          key={session.topic}
                          style={{
                            padding: '16px',
                            borderBottom: index < activeSessions.length - 1 ? '1px solid #eaeaea' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: 'white'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                              {session.peer.metadata.name}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2px' }}>
                              {session.peer.metadata.url}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.9rem' }}>
                              Chains: {Object.keys(session.namespaces).map(namespace => 
                                session.namespaces[namespace].chains?.map((chain: string) => {
                                  const chainId = chain.split(':')[1];
                                  return CHAIN_NAME_MAP[chainId] || chainId;
                                }).join(', ')
                              ).join(', ')}
                            </div>
                          </div>
                          <button
                            style={{
                              ...buttonStyle,
                              backgroundColor: '#dc3545',
                              padding: '8px 16px'
                            }}
                            onClick={async () => {
                              await walletKit?.disconnectSession({
                                topic: session.topic,
                                reason: getSdkError("USER_DISCONNECTED")
                              });
                              updateActiveSessions(walletKit);
                              toast.success('Session disconnected');
                            }}
                          >
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ borderBottom: '1px solid #eaeaea', marginBottom: '20px' }}>
                  <button
                    style={activeTab === 'messages' ? activeTabStyle : tabStyle}
                    onClick={() => setActiveTab('messages')}
                  >
                    Message Signing History
                  </button>
                  <button
                    style={activeTab === 'inbox' ? activeTabStyle : tabStyle}
                    onClick={() => setActiveTab('inbox')}
                  >
                    Inbox Transactions
                  </button>
                </div>

                {activeTab === 'inbox' && (
                  <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                    <button
                      style={{
                        ...buttonStyle,
                        backgroundColor: '#28a745',
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginLeft: 'auto'
                      }}
                      onClick={refreshInboxTransactions}
                      disabled={isLoadingInbox}
                    >
                      <FontAwesomeIcon 
                        icon={faSync} 
                        spin={isLoadingInbox}
                        style={{ fontSize: '0.8rem' }}
                      />
                      {isLoadingInbox ? 'Loading...' : 'Refresh Inbox'}
                    </button>
                  </div>
                )}

                {activeTab === 'messages' && (
                  <div>
                    {accountDetails.signedMessages.length === 0 ? (
                      <p style={{ color: '#666' }}>No signed messages yet</p>
                    ) : (
                      accountDetails.signedMessages.map((msg, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '16px',
                            borderBottom: index < accountDetails.signedMessages.length - 1 ? '1px solid #eaeaea' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '500' }}>{msg.domainUrl}</div>
                            <div style={{ color: '#666', fontSize: '0.9rem' }}>
                              {new Date(msg.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>
                            Signer: {msg.signer}
                          </div>
                          <div style={{ 
                            background: '#f5f5f5', 
                            padding: '12px', 
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            wordBreak: 'break-all'
                          }}>
                            <div style={{ marginBottom: '8px' }}>Message: {msg.message}</div>
                            <div>Signature: {msg.signature.substring(0, 32)}...</div>
                          </div>
                          {msg.sessionId && (
                            <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>
                              Session ID: {msg.sessionId}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'inbox' && (
                  <div>
                    {isLoadingInbox ? (
                      <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Loading transactions...</p>
                    ) : inboxTransactions.length === 0 ? (
                      <p style={{ color: '#666' }}>No incoming transactions yet</p>
                    ) : (
                      <div style={{ overflowY: 'auto', maxHeight: '1200px' }}>
                        {inboxTransactions.map((tx, index) => (
                          <div
                            key={tx.hash}
                            style={{
                              padding: '16px',
                              borderBottom: index < inboxTransactions.length - 1 ? '1px solid #eaeaea' : 'none',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                <span
                                  style={{
                                    backgroundColor: getTokenTypeColor(tx.tokenType),
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    marginRight: '12px'
                                  }}
                                >
                                  {tx.tokenType}
                                </span>
                                <div style={{ fontWeight: '500', fontSize: '1.1rem' }}>
                                  {formatAmount(tx.amount, tx.decimals, tx.symbol)}
                                </div>
                              </div>
                              
                              <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '4px' }}>
                                <strong>{tx.name}</strong>
                                {tx.tokenId && ` (Token ID: ${tx.tokenId})`}
                              </div>
                              
                              <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '4px' }}>
                                From: <span style={{ fontFamily: 'monospace' }}>{tx.fromAddress}</span>
                              </div>
                              
                              <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '4px' }}>
                                Block: {tx.blockNumber}
                              </div>
                              
                              {tx.contractAddress && (
                                <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '4px' }}>
                                  Contract: <span style={{ fontFamily: 'monospace' }}>{tx.contractAddress}</span>
                                </div>
                              )}
                              
                              <div style={{ color: '#666', fontSize: '0.8rem' }}>
                                {new Date(tx.createdAt).toLocaleString()}
                              </div>
                            </div>
                            
                            <div style={{ marginLeft: '16px' }}>
                              <a
                                href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  ...buttonStyle,
                                  backgroundColor: '#6c757d',
                                  padding: '8px 12px',
                                  fontSize: '0.9rem',
                                  textDecoration: 'none',
                                  display: 'inline-block'
                                }}
                              >
                                View on Etherscan
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
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