import type { NextApiRequest, NextApiResponse } from 'next';
import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';
import { privateKeyToAccount } from 'viem/accounts';

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

    try {
      switch (methodRequest.method) {
        case 'personal_sign':
          const [messageHex, account] = methodRequest.params;
          console.log('Signing request:', { messageHex, account });

          try {
            const privateKey = process.env.NEXT_PUBLIC_PASS_WALLET_PRIVATE_KEY;
            if (!privateKey) {
              throw new Error('Private key not found in environment variables');
            }

            // Create an account from the private key
            const account = privateKeyToAccount(privateKey as `0x${string}`);
            
            // Sign the message
            const signature = await account.signMessage({ message: messageHex });
            console.log('Generated signature:', signature);

            await walletKit.respondSessionRequest({
              topic,
              response: { 
                id, 
                result: signature,
                jsonrpc: '2.0' 
              }
            });
            console.log('Successfully signed message');
          } catch (error) {
            console.error('Error signing message:', error);
            throw error;
          }
          break;

        case 'eth_sendTransaction':
          // Handle transaction requests
          const [transaction] = methodRequest.params;
          // Here you would implement your transaction logic
          const txHash = '0x...'; // Your transaction implementation
          await walletKit.respondSessionRequest({
            topic,
            response: { id, result: txHash, jsonrpc: '2.0' }
          });
          break;

        default:
          throw new Error(`Unsupported method: ${methodRequest.method}`);
      }
    } catch (error) {
      console.error('Request handling error:', error);
      await walletKit.respondSessionRequest({
        topic,
        response: {
          id,
          error: {
            code: 5000,
            message: 'User rejected.'
          },
          jsonrpc: '2.0'
        }
      });
    }
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
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: 'WalletConnect URI is required' });
    }

    // Initialize WalletKit only once
    if (!walletKit) {
      walletKit = await WalletKit.init({
        core,
        metadata: {
          name: 'Pass Wallet',
          description: 'Pass Wallet',
          url: 'https://arxiv.org/abs/2412.02634',
          icons: []
        }
      });

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
    }

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
