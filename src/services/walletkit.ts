import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';
import { WalletKitInstance } from './types';
import { useWalletStore } from '../store/walletStore';

const WHITELISTED_ORIGINS = [
  "https://opensea.io", 
  "https://tally.xyz/", 
  "https://app.uniswap.org",
  "https://appkit-lab.reown.com"
];

class WalletKitService {
  private static instance: WalletKitService;
  private walletKit: WalletKitInstance = {
    client: null,
    initialized: false
  };

  private supportedNamespaces = {
    eip155: {
      chains: ["eip155:1", "eip155:137"],
      methods: ["eth_sendTransaction", "personal_sign"],
      events: ["accountsChanged", "chainChanged"],
      accounts: [] as string[]
    }
  };

  private constructor() {}

  public static getInstance(): WalletKitService {
    if (!WalletKitService.instance) {
      WalletKitService.instance = new WalletKitService();
    }
    return WalletKitService.instance;
  }

  public async initialize(addresses: string[]) {
    if (this.walletKit.initialized) return this.walletKit.client;

    try {
      const core = new Core({
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID
      });

      const client = await WalletKit.init({
        core,
        metadata: {
          name: 'PassWallet',
          description: 'Pass Wallet',
          url: 'https://arxiv.org/abs/2412.02634',
          icons: []
        }
      });

      this.supportedNamespaces.eip155.accounts = addresses;
      this.setupEventListeners(client);
      
      this.walletKit = {
        client,
        initialized: true
      };

      return client;
    } catch (error) {
      console.error('Failed to initialize WalletKit:', error);
      throw error;
    }
  }

  private setupEventListeners(client: IWalletKit) {
    console.log('Setting up event listeners...');
    
    client.on('session_proposal', (proposal) => {
      console.log('Received session proposal:', proposal);
      useWalletStore.getState().setData({ proposal });
      this.handleSessionProposal(proposal);
    });
    
    client.on('session_request', (requestEvent) => {
      console.log('Received session request:', requestEvent);
      useWalletStore.getState().setData({ requestEvent });
      this.handleSessionRequest(requestEvent);
    });
    
    client.on('session_authenticate', (authRequest) => {
      console.log('Received authentication request:', authRequest);
      useWalletStore.getState().setData({ authRequest });
      this.handleSessionAuthenticate(authRequest);
    });

    // Track active sessions
    client.on('session_delete', ({ topic }) => {
      const currentSessions = useWalletStore.getState().activeSessions;
      const { [topic]: deletedSession, ...remainingSessions } = currentSessions;
      useWalletStore.getState().setActiveSessions(remainingSessions);
    });

    console.log('Event listeners setup complete');
  }

  private handleSessionProposal = async (proposal: any) => {
    console.log("Inside handleSessionProposal function");
    if (!this.walletKit.client) throw new Error('WalletKit not initialized');

    const { proposer } = proposal.params;
    const origin = proposer.metadata.url;
    console.log("Origin:", origin);

    // if (!WHITELISTED_ORIGINS.includes(origin)) {
    //   await this.walletKit.client.rejectSession({
    //     id: proposal.id,
    //     reason: {
    //       code: 4001,
    //       message: 'Domain not whitelisted'
    //     }
    //   });
    //   return;
    // }

    // try {
    //   await this.walletKit.client.approveSession({
    //     id: proposal.id,
    //     namespaces: this.supportedNamespaces
    //   });
    // } catch (error) {
    //   console.error('Failed to approve session! Error:', error);
    //   throw error;
    // }
  };

  private handleSessionRequest = async (event: any) => {
    console.log("Inside handleSessionRequest function");
    if (!this.walletKit.client) throw new Error('WalletKit not initialized');

    const { request, chainId } = event.params;
    const { method, params } = request;
    console.log('Session request received:', { request, chainId });
    console.log('Method:', method);
    console.log('Params:', params);
    // try {
    //   let response;
    //   switch (method) {
    //     case 'eth_sendTransaction':
    //       response = await this.handleTransaction(params[0]);
    //       break;
    //     case 'personal_sign':
    //       response = await this.handleSignMessage(params);
    //       break;
    //     default:
    //       throw new Error(`Unsupported method: ${method}`);
    //   }

    //   await this.walletKit.client.respond({
    //     topic: event.topic,
    //     response: {
    //       id: event.id,
    //       jsonrpc: '2.0',
    //       result: response
    //     }
    //   });
    // } catch (error) {
    //   await this.walletKit.client.respond({
    //     topic: event.topic,
    //     response: {
    //       id: event.id,
    //       jsonrpc: '2.0',
    //       error: {
    //         code: 4001,
    //         message: 'User rejected the request'
    //       }
    //     }
    //   });
    // }
  };

  private handleSessionAuthenticate = async (event: any) => {
    console.log("Inside handleSessionAuthenticate function");
    if (!this.walletKit.client) throw new Error('WalletKit not initialized');
    console.log('Inside handleSessionAuthenticate function');
    console.log('Full event object:', JSON.stringify(event, null, 2));
    console.log('Session authenticate received:', event);
    console.log('URL:', event?.params?.url);
    
    // try {
    //   await this.walletKit.client.respond({
    //     topic: event.topic,
    //     response: {
    //       id: event.id,
    //       jsonrpc: '2.0',
    //       result: true
    //     }
    //   });
    //   console.log('Authentication response sent successfully');
    // } catch (error) {
    //   console.error('Error responding to authentication:', error);
    // }
  };

  private async handleTransaction(txParams: any) {
    // Implement your transaction handling logic here
    // This should integrate with your wallet's signing mechanism
    throw new Error('Transaction handling not implemented');
  }

  private async handleSignMessage(params: any) {
    // Implement your message signing logic here
    // This should integrate with your wallet's signing mechanism
    throw new Error('Message signing not implemented');
  }

  public getClient() {
    if (!this.walletKit.initialized) {
      throw new Error('WalletKit not initialized. Call initialize() first.');
    }
    return this.walletKit.client;
  }
}

export const walletKitService = WalletKitService.getInstance();