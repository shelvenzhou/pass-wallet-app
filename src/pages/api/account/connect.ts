import type { NextApiRequest, NextApiResponse } from 'next';
import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';

const address = process.env.NEXT_PUBLICPASS_WALLET_ADDRESS;

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

    // console.log("WalletConnect URI:", uri);

    if (!uri) {
      return res.status(400).json({ error: 'WalletConnect URI is required' });
    }

    // Initialize WalletKit
    const core = new Core({
      projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
    });

    const walletKit = await WalletKit.init({
      core,
      metadata: {
        name: 'Pass Wallet',
        description: 'Pass Wallet',
        url: 'https://arxiv.org/abs/2412.02634',
        icons: []
      }
    });

    // Create a promise to wait for the session proposal
    const sessionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session proposal timeout'));
      }, 30000); // 30 second timeout

      walletKit.on('session_proposal', async (proposal) => {
        clearTimeout(timeout);
        try {
          await walletKit.approveSession({
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
          resolve(proposal);
        } catch (error) {
          reject(error);
        }
      });
    });
    await walletKit.pair({ uri });
    const session = await sessionPromise;
    console.log("Session:", session);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('WalletConnect error:', error);
    res.status(500).json({ 
      error: 'Failed to establish WalletConnect session' 
    });
  }
}
