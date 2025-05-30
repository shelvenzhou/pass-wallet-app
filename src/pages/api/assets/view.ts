import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

interface AssetBalance {
  id: number;
  symbol: string;
  name: string;
  tokenType: string;
  contractAddress: string | null;
  tokenId: string | null;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

interface ViewAssetsResponse {
  walletAddress: string;
  subaccountAddress: string;
  subaccountLabel: string;
  assets: AssetBalance[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ViewAssetsResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, subaccountAddress } = req.body;

    if (!walletAddress || !subaccountAddress) {
      return res.status(400).json({ 
        error: 'Both walletAddress and subaccountAddress are required' 
      });
    }

    // Find the wallet
    const wallet = await prisma.passWallet.findUnique({
      where: { address: walletAddress }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Find the subaccount
    const subaccount = await prisma.subaccount.findFirst({
      where: {
        walletId: wallet.id,
        address: subaccountAddress,
      },
    });

    if (!subaccount) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }

    // Get all asset balances for this subaccount
    const balances = await prisma.subaccountBalance.findMany({
      where: {
        subaccountId: subaccount.id,
      },
      include: {
        asset: true,
      },
      orderBy: {
        asset: {
          symbol: 'asc'
        }
      }
    });

    // Format the response
    const assets: AssetBalance[] = balances.map(balance => {
      const asset = balance.asset;
      const rawBalance = balance.amount;
      
      // Format balance based on decimals
      let formattedBalance: string;
      if (asset.decimals === 0) {
        formattedBalance = `${rawBalance} ${asset.symbol}`;
      } else {
        const divisor = Math.pow(10, asset.decimals);
        const numericBalance = parseFloat(rawBalance) / divisor;
        formattedBalance = `${numericBalance.toFixed(6)} ${asset.symbol}`;
      }

      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        tokenType: asset.tokenType,
        contractAddress: asset.contractAddress,
        tokenId: asset.tokenId,
        decimals: asset.decimals,
        balance: rawBalance,
        formattedBalance,
      };
    });

    const response: ViewAssetsResponse = {
      walletAddress,
      subaccountAddress,
      subaccountLabel: subaccount.label,
      assets,
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error viewing assets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
