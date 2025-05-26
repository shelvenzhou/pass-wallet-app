import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, symbol, amount } = req.body;

    // Find the PassWallet
    const wallet = await prisma.passWallet.findUnique({
      where: { address }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Update or create asset balance
    // You'll need to add an Asset model to your Prisma schema
    await prisma.asset.upsert({
      where: {
        walletId_symbol: {
          walletId: wallet.id,
          symbol
        }
      },
      update: {
        balance: amount
      },
      create: {
        walletId: wallet.id,
        symbol,
        balance: amount,
        name: symbol // You might want to fetch the actual name
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating asset balance:', error);
    res.status(500).json({ error: 'Failed to update asset balance' });
  }
} 