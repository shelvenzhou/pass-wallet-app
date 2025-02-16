// services/sign-client.ts
import { SignClient } from '@walletconnect/sign-client';
import { SignClientInstance } from './types';

const globalForSignClient = global as unknown as { signClient: SignClientInstance };

class SignClientService {
  private static instance: SignClientService;
  private signClient: SignClientInstance = {
    client: null,
    initialized: false
  };

  private constructor() {}

  public static getInstance(): SignClientService {
    if (!SignClientService.instance) {
      SignClientService.instance = new SignClientService();
    }
    return SignClientService.instance;
  }

  public async initialize() {
    if (this.signClient.initialized) return this.signClient.client;

    try {
      const client = await SignClient.init({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: 'Your App Name',
          description: 'Your App Description',
          url: window.location.host,
          icons: []
        }
      });

      this.signClient = {
        client,
        initialized: true
      };

      if (process.env.NODE_ENV !== 'production') {
        globalForSignClient.signClient = this.signClient;
      }

      return client;
    } catch (error) {
      console.error('Failed to initialize SignClient:', error);
      throw error;
    }
  }

  public getClient() {
    if (!this.signClient.initialized) {
      throw new Error('SignClient not initialized. Call initialize() first.');
    }
    return this.signClient.client;
  }
}

export const signClientService = SignClientService.getInstance();