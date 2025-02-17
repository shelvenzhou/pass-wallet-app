import type { NextApiRequest, NextApiResponse } from 'next';
import { Core } from '@walletconnect/core';
import { WalletKit, IWalletKit } from '@reown/walletkit';

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

    console.log("WalletConnect URI:", uri);

    if (!uri) {
      return res.status(400).json({ error: 'WalletConnect URI is required' });
    }

    // Initialize WalletKit
    const core = new Core({
      projectId: process.env.WALLETKIT_PROJECT_ID,
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

    // Add event listeners before pairing
    walletKit.on('session_proposal', async (proposal) => {
      try {
        await walletKit.approveSession({
          id: proposal.id,
          namespaces: {
            eip155: {
              chains: ["eip155:1", "eip155:137"],
              methods: ["eth_sendTransaction", "personal_sign"],
              events: ["accountsChanged", "chainChanged"],
              accounts: []
            }
          }
        });
      } catch (error) {
        console.error('Failed to approve session:', error);
      }
    });

    // Now pair with the URI
    await walletKit.pair({ uri });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('WalletConnect error:', error);
    res.status(500).json({ 
      error: 'Failed to establish WalletConnect session' 
    });
  }
}
