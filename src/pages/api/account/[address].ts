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
    blockNumber: string;
    tokenType: string;
    value: string;
    from: string;
    to: string;
    tokenSymbol: string;
    tokenName: string;
    tokenDecimal: string;
    contractAddress?: string;
    tokenID?: string;
    claimed: boolean;
    createdAt: string;
  }>;
  signedMessages: Array<{
    message: string;
    signer: string;
    domainUrl: string;
    signature: string;
    sessionId: string | null;
    createdAt: string;
  }>;
};

// Simple in-memory cache for ETH balances
const balanceCache = new Map<string, { balance: string; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountData>
) {
  const { address, connectedAddress } = req.query;

  try {
    let ethBalance = '0.0000';
    
    // Check cache first
    const cached = balanceCache.get(address as string);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      ethBalance = cached.balance;
      // console.log('Using cached ETH balance:', ethBalance);
    } else {
      // Try to fetch from Etherscan
      try {
        const etherscanResponse = await fetch(
          `https://api.etherscan.io/v2/api?chainid=11155111&module=account&action=balance&address=${address}&tag=latest&apikey=${process.env.ETHERSCAN_API_KEY || ''}`
        );
        
        const etherscanData = await etherscanResponse.json();
        console.log("etherscanData", etherscanData);
        
        if (etherscanData.status === '1') {
          ethBalance = (parseInt(etherscanData.result) / Math.pow(10, 18)).toFixed(4);
          // Cache the successful result
          balanceCache.set(address as string, { balance: ethBalance, timestamp: now });
        } else if (cached) {
          // Use stale cache if API fails but we have cached data
          ethBalance = cached.balance;
          console.log('Etherscan API failed, using stale cache:', ethBalance);
        }
      } catch (fetchError) {
        console.error('Etherscan API error:', fetchError);
        if (cached) {
          // Use stale cache if fetch fails
          ethBalance = cached.balance;
          console.log('Fetch failed, using stale cache:', ethBalance);
        }
      }
    }

    // Fetch wallet data from database
    const wallet = await prisma.passWallet.findUnique({
      where: {
        address: address as string,
      },
      include: {
        signedMessages: true,
        inboxTransactions: {
          include: {
            asset: true,
          },
          orderBy: {
            blockNumber: 'desc',
          },
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({
        name: 'Unknown Account',
        balance: `${ethBalance} ETH`,
        owner: address as string,
        assets: [],
        transactions: [],
        signedMessages: [],
      });
    }

    const accountData: AccountData = {
      name: wallet.name,
      balance: `${ethBalance} ETH`,
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
      transactions: (wallet?.inboxTransactions || [])
        .map((tx: any) => ({
          hash: tx.transactionHash,
          blockNumber: tx.blockNumber,
          tokenType: tx.asset?.tokenType || 'ETH',
          value: tx.amount,
          from: tx.fromAddress,
          to: tx.toAddress,
          tokenSymbol: tx.asset?.symbol || 'ETH',
          tokenName: tx.asset?.name || 'Ethereum',
          tokenDecimal: tx.asset?.decimals?.toString() || '18',
          contractAddress: tx.asset?.contractAddress,
          tokenID: tx.asset?.tokenId,
          claimed: tx.claimed,
          createdAt: tx.createdAt.toISOString(),
        })),
      signedMessages: (wallet?.signedMessages || [])
        .filter((msg: any) => 
          connectedAddress ? 
            msg.signer.toLowerCase() === (connectedAddress as string).toLowerCase() : 
            true
        )
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((msg: any) => ({
          message: msg.message,
          signer: msg.signer,
          domainUrl: msg.domainUrl,
          signature: msg.signature,
          sessionId: msg.sessionId,
          createdAt: msg.createdAt.toISOString(),
        })),
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
      signedMessages: [],
    });
  }
}
