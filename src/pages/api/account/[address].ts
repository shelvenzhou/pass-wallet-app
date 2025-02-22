import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

type AccountData = {
  name: string;
  balance: string;
  owner: string;
  assets: Array<{
    symbol: string;
    name: string;
    balance: string;
    value: string;
    icon?: string;
  }>;
  transactions: Array<{
    hash: string;
    type: 'send' | 'receive';
    amount: string;
    timestamp: string;
  }>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountData>
) {
  const { address } = req.query;

  try {
    // Fetch wallet data from database
    const wallet = await prisma.passWallet.findUnique({
      where: {
        address: address as string,
      },
    });

    if (!wallet) {
      return res.status(404).json({
        name: 'Unknown Account',
        balance: '0 ETH',
        owner: address as string,
        assets: [],
        transactions: [],
      });
    }

    const accountData: AccountData = {
      name: wallet.name,
      balance: '0.0 ETH', // Mock data
      owner: wallet.owner,
      assets: [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          balance: '1.5',
          value: '$3,450.00',
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          balance: '1,000.00',
          value: '$1,000.00',
        },
        {
          symbol: 'WETH',
          name: 'Wrapped Ethereum',
          balance: '0.5',
          value: '$1,150.00',
        }
      ],
      transactions: [
        {
          hash: '0x123...abc',
          type: 'send',
          amount: '0.1 ETH',
          timestamp: '2024-02-17 14:30',
        },
        {
          hash: '0x456...def',
          type: 'receive',
          amount: '0.5 ETH',
          timestamp: '2024-02-17 12:15',
        },
      ],
    };

    res.status(200).json(accountData);
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      name: 'Error',
      balance: '0 ETH',
      owner: address as string,
      assets: [],
      transactions: [],
    });
  }
}
