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

    // Pair with the provided URI
    await walletKit.pair({ uri });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('WalletConnect error:', error);
    res.status(500).json({ 
      error: 'Failed to establish WalletConnect session' 
    });
  }
}
