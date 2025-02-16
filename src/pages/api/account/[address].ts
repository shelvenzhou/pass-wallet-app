import type { NextApiRequest, NextApiResponse } from 'next';

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

  // For now, return mock data
  // In a real implementation, you would fetch this data from your blockchain/database
  const accountData: AccountData = {
    name: 'Main Account',
    balance: '2.5 ETH',
    owner: address as string,
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
}
