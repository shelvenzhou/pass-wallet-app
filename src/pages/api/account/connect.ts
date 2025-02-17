import type { NextApiRequest, NextApiResponse } from 'next';
import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';
import { privateKeyToAccount } from 'viem/accounts';
import { useWalletStore } from '../../../store/walletStore';
import { walletKitService } from '../../../services/walletkit';

const address = process.env.NEXT_PUBLICPASS_WALLET_ADDRESS;
const WHITELISTED_ORIGINS = ["https://opensea.io", "https://www.tally.xyz"];

// Create singleton instances
const core = new Core({
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
});

let walletKit: IWalletKit | null = null;
let activeSession: any = null;

// Add request handling
const handleSessionRequests = (walletKit: IWalletKit) => {
  walletKit.on('session_request', async (request) => {
    const { topic, params, id } = request;
    const { request: methodRequest } = params;
    
    console.log('Received request:', methodRequest);

    // Store the request in the global state for frontend to handle
    useWalletStore.getState().setData({ 
      requestEvent: request,
      requestSession: activeSession
    });

    // The actual signing/transaction will be handled when the frontend calls back
    // to a new API endpoint with the approval
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const walletKit = await walletKitService.initialize([address!]);
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: 'WalletConnect URI is required' });
    }

    // Add the request handler
    handleSessionRequests(walletKit);

    // Set up persistent event listeners
    walletKit.on('session_proposal', async (proposal) => {
      const origin = proposal.params.proposer.metadata.url.trim();
      
      if (!WHITELISTED_ORIGINS.includes(origin)) {
        console.log(`Rejecting session from non-whitelisted origin: ${origin}`);
        await walletKit!.rejectSession({
          id: proposal.id,
          reason: {
            code: 1,
            message: 'Origin not whitelisted'
          }
        });
        return;
      }

      try {
        const session = await walletKit!.approveSession({
          id: proposal.id,
          namespaces: {
            eip155: {
              chains: ["eip155:11155111"],
              methods: ["eth_sendTransaction", "personal_sign"],
              events: ["accountsChanged", "chainChanged"],
              accounts: [`eip155:11155111:${address}`],
            }
          }
        });
        activeSession = session;
        console.log("Session established:", session);
      } catch (error) {
        console.error('Failed to approve session:', error);
      }
    });

    // Handle session deletion
    walletKit.on('session_delete', () => {
      console.log('Session deleted');
      activeSession = null;
    });

    // If we already have an active session, return it
    if (activeSession) {
      return res.status(200).json({ 
        success: true, 
        message: 'Using existing session',
        session: activeSession 
      });
    }

    // Create a promise to wait for the session proposal
    const sessionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session proposal timeout'));
      }, 30000); // 30 second timeout

      const checkSession = setInterval(() => {
        if (activeSession) {
          clearTimeout(timeout);
          clearInterval(checkSession);
          resolve(activeSession);
        }
      }, 1000);
    });

    await walletKit.pair({ uri });
    const session = await sessionPromise;
    
    res.status(200).json({ 
      success: true,
      message: 'New session established',
      session 
    });
  } catch (error) {
    console.error('WalletConnect error:', error);
    res.status(500).json({ 
      error: 'Failed to establish WalletConnect session' 
    });
  }
}
