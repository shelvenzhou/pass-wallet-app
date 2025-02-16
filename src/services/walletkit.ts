import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';
import { WalletKitInstance } from './types';
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
      accounts: [] // Will be populated during initialization
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
        projectId: process.env.NEXT_PUBLIC_WALLETKIT_PROJECT_ID
      });

      const client = await WalletKit.init({
        core,
        metadata: {
          name: 'Pass Wallet',
          description: 'Pass Wallet',
          url: 'https://arxiv.org/abs/2412.02634',
          icons: []
        }
      });

      // Update supported namespaces with provided addresses
      this.supportedNamespaces.eip155.accounts = addresses;
      
      this.setupEventListeners(client);
      
      this.walletKit = {
        client,
        initialized: true
      };

      if (process.env.NODE_ENV !== 'production') {
        globalForWalletKit.walletKit = this.walletKit;
      }

      return client;
    } catch (error) {
      console.error('Failed to initialize WalletKit:', error);
      throw error;
    }
  }

  private setupEventListeners(client: IWalletKit) {
    client.on('session_proposal', this.handleSessionProposal);
    client.on('session_request', this.handleSessionRequest);
  }

  private handleSessionProposal = async (proposal: any) => {
    if (!this.walletKit.client) throw new Error('WalletKit not initialized');
    // Implementation remains the same as your original code
  };

  private handleSessionRequest = async (event: any) => {
    if (!this.walletKit.client) throw new Error('WalletKit not initialized');
    // Implementation remains the same as your original code
  };

  public getClient() {
    if (!this.walletKit.initialized) {
      throw new Error('WalletKit not initialized. Call initialize() first.');
    }
    return this.walletKit.client;
  }
}

export const walletKitService = WalletKitService.getInstance();