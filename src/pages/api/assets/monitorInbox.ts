import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { TokenType } from '@prisma/client';

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 11155111; // Sepolia Testnet

const ENCLAVE_URL = process.env.ENCLAVE_URL || 'http://127.0.0.1:5000';

interface MonitorResult {
  success: boolean;
  newTransactions: number;
  ethTransactions: number;
  erc20Transactions: number;
  erc721Transactions: number;
  erc1155Transactions: number;
  currentBlock: string;
}

interface EtherscanTransaction {
  hash: string;
  blockNumber: string;
  from: string;
  to: string;
  value: string;
  contractAddress?: string;
  tokenType: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  tokenID?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MonitorResult | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet, fromBlock = '0' } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Verify wallet exists in database
    const passWallet = await prisma.passWallet.findUnique({
      where: { address: wallet }
    });

    if (!passWallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get current block number
    const currentBlockUrl = new URL(ETHERSCAN_BASE);
    currentBlockUrl.searchParams.set('chainid', CHAIN_ID.toString());
    currentBlockUrl.searchParams.set('module', 'proxy');
    currentBlockUrl.searchParams.set('action', 'eth_blockNumber');
    currentBlockUrl.searchParams.set('apikey', ETHERSCAN_API_KEY);
    
    const currentBlockResponse = await fetch(currentBlockUrl.toString());
    const currentBlockData = await currentBlockResponse.json();
    const currentBlock = parseInt(currentBlockData.result, 16).toString();
    
    let newTransactions = 0;
    let ethTransactions = 0;
    let erc20Transactions = 0;
    let erc721Transactions = 0;
    let erc1155Transactions = 0;

    // Monitor ETH transfers
    console.log('Monitoring ETH transfers');
    const ethTxs = await monitorEthTransfers(wallet, fromBlock, currentBlock, passWallet.id);
    ethTransactions = ethTxs;
    newTransactions += ethTxs;

    // Monitor ERC20 transfers
    console.log('Monitoring ERC20 transfers');
    const erc20Txs = await monitorERC20Transfers(wallet, fromBlock, currentBlock, passWallet.id);
    erc20Transactions = erc20Txs;
    newTransactions += erc20Txs;

    // Monitor ERC721 transfers
    console.log('Monitoring ERC721 transfers');
    const erc721Txs = await monitorERC721Transfers(wallet, fromBlock, currentBlock, passWallet.id);
    erc721Transactions = erc721Txs;
    newTransactions += erc721Txs;

    // Monitor ERC1155 transfers
    console.log('Monitoring ERC1155 transfers');
    const erc1155Txs = await monitorERC1155Transfers(wallet, fromBlock, currentBlock, passWallet.id);
    erc1155Transactions = erc1155Txs;
    newTransactions += erc1155Txs;

    return res.status(200).json({
      success: true,
      newTransactions,
      ethTransactions,
      erc20Transactions,
      erc721Transactions,
      erc1155Transactions,
      currentBlock
    });
  } catch (error) {
    console.error('Error monitoring inbox:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function monitorEthTransfers(
  walletAddress: string, 
  fromBlock: string, 
  toBlock: string, 
  walletId: number
): Promise<number> {
  let newTransactions = 0;
  
  try {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', CHAIN_ID.toString());
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', walletAddress);
    url.searchParams.set('startblock', fromBlock);
    url.searchParams.set('endblock', toBlock);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('apikey', ETHERSCAN_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === '1' && data.result) {
      for (const tx of data.result) {
        // Only process incoming ETH transactions with value > 0
        if (
          tx.to?.toLowerCase() === walletAddress.toLowerCase() && 
          tx.value !== '0' &&
          tx.isError === '0'
        ) {

          // Check if ether as an Asset exists
          let asset = await prisma.asset.findFirst({
            where: { 
              walletId: walletId,
              tokenType: TokenType.ETH,
              contractAddress: null
            }
          });

          if (!asset) {
            asset = await prisma.asset.create({
              data: {
                walletId: walletId,
                tokenType: TokenType.ETH,
                contractAddress: null,
                symbol: 'ETH',
                name: 'Ethereum',
                decimals: 18
              }
            });
          }

          // Check if transaction already exists
          const existingTx = await prisma.inboxTransaction.findUnique({
            where: { transactionHash: tx.hash }
          });

          if (!existingTx) {
            await prisma.inboxTransaction.create({
              data: {
                walletId,
                assetId: asset.id,
                transactionHash: tx.hash,
                blockNumber: tx.blockNumber,
                amount: tx.value,
                fromAddress: tx.from,
                toAddress: tx.to,
              }
            });

            // Also send to enclave
            try {
              await fetch(`${ENCLAVE_URL}/pass/wallets/deposits`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  wallet_address: walletAddress,
                  asset_id: 'eth_mainnet',
                  amount: parseInt(tx.value),
                  deposit_id: tx.hash,
                  transaction_hash: tx.hash,
                  block_number: tx.blockNumber,
                  from_address: tx.from,
                  to_address: tx.to,
                }),
              });
            } catch (enclaveError) {
              console.error('Failed to send deposit to enclave:', enclaveError);
            }

            console.log('ETH Transfer saved:', tx.hash);
            newTransactions++;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring ETH transfers:', error);
  }

  return newTransactions;
}

async function monitorERC20Transfers(
  walletAddress: string,
  fromBlock: string,
  toBlock: string,
  walletId: number
): Promise<number> {
  let newTransactions = 0;

  try {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', CHAIN_ID.toString());
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('address', walletAddress);
    url.searchParams.set('startblock', fromBlock);
    url.searchParams.set('endblock', toBlock);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('apikey', ETHERSCAN_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();
    const transactions = data.result;

    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        // Only process incoming ERC20 transfers
        if (tx.to?.toLowerCase() === walletAddress.toLowerCase()) {
          
          // Check if ERC20 asset exists
          let asset = await prisma.asset.findFirst({
            where: { 
              walletId: walletId,
              tokenType: TokenType.ERC20,
              contractAddress: tx.contractAddress
            }
          });

          if (!asset) {
            asset = await prisma.asset.create({
              data: {
                walletId: walletId,
                tokenType: TokenType.ERC20,
                contractAddress: tx.contractAddress,
                symbol: tx.tokenSymbol || 'UNKNOWN',
                name: tx.tokenName || 'Unknown Token',
                decimals: parseInt(tx.tokenDecimal || '18')
              }
            });
          }

          // Check if transaction already exists
          const existingTx = await prisma.inboxTransaction.findUnique({
            where: { transactionHash: tx.hash }
          });

          if (!existingTx) {
            await prisma.inboxTransaction.create({
              data: {
                walletId,
                assetId: asset.id,
                transactionHash: tx.hash,
                blockNumber: tx.blockNumber,
                amount: tx.value,
                fromAddress: tx.from,
                toAddress: tx.to,
              }
            });
            console.log('ERC20 Transfer saved:', tx.hash);
            newTransactions++;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring ERC20 transfers:', error);
  }

  return newTransactions;
}

async function monitorERC721Transfers(
  walletAddress: string,
  fromBlock: string,
  toBlock: string,
  walletId: number
): Promise<number> {
  let newTransactions = 0;

  try {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', CHAIN_ID.toString());
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokennfttx');
    url.searchParams.set('address', walletAddress);
    url.searchParams.set('startblock', fromBlock);
    url.searchParams.set('endblock', toBlock);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('apikey', ETHERSCAN_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();
    const transactions = data.result;

    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        // Only process incoming ERC721 transfers
        if (tx.to?.toLowerCase() === walletAddress.toLowerCase()) {
          
          // Check if ERC721 asset exists (unique by contract + tokenId)
          let asset = await prisma.asset.findFirst({
            where: { 
              walletId: walletId,
              tokenType: TokenType.ERC721,
              contractAddress: tx.contractAddress,
              tokenId: tx.tokenID
            }
          });

          if (!asset) {
            asset = await prisma.asset.create({
              data: {
                walletId: walletId,
                tokenType: TokenType.ERC721,
                contractAddress: tx.contractAddress,
                tokenId: tx.tokenID,
                symbol: tx.tokenSymbol || 'NFT',
                name: tx.tokenName || 'Unknown NFT',
                decimals: 0
              }
            });
          }

          // Check if transaction already exists
          const existingTx = await prisma.inboxTransaction.findUnique({
            where: { transactionHash: tx.hash }
          });

          if (!existingTx) {
            await prisma.inboxTransaction.create({
              data: {
                walletId,
                assetId: asset.id,
                transactionHash: tx.hash,
                blockNumber: tx.blockNumber,
                amount: '1',
                fromAddress: tx.from,
                toAddress: tx.to,
              }
            });
            console.log('ERC721 Transfer saved:', tx.hash);
            newTransactions++;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring ERC721 transfers:', error);
  }

  return newTransactions;
}

async function monitorERC1155Transfers(
  walletAddress: string,
  fromBlock: string,
  toBlock: string,
  walletId: number
): Promise<number> {
  let newTransactions = 0;

  try {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', CHAIN_ID.toString());
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'token1155tx');
    url.searchParams.set('address', walletAddress);
    url.searchParams.set('startblock', fromBlock);
    url.searchParams.set('endblock', toBlock);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('apikey', ETHERSCAN_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();
    const transactions = data.result;

    if (Array.isArray(transactions)) {
      for (const tx of transactions) {
        // Only process incoming ERC1155 transfers
        if (tx.to?.toLowerCase() === walletAddress.toLowerCase()) {
          
          // Check if ERC1155 asset exists (unique by contract + tokenId)
          let asset = await prisma.asset.findFirst({
            where: { 
              walletId: walletId,
              tokenType: TokenType.ERC1155,
              contractAddress: tx.contractAddress,
              tokenId: tx.tokenID
            }
          });

          if (!asset) {
            asset = await prisma.asset.create({
              data: {
                walletId: walletId,
                tokenType: TokenType.ERC1155,
                contractAddress: tx.contractAddress,
                tokenId: tx.tokenID,
                symbol: tx.tokenSymbol || 'ERC1155',
                name: tx.tokenName || 'ERC1155 Token',
                decimals: 0
              }
            });
          }

          // Check if transaction already exists
          const existingTx = await prisma.inboxTransaction.findUnique({
            where: { transactionHash: tx.hash }
          });

          if (!existingTx) {
            await prisma.inboxTransaction.create({
              data: {
                walletId,
                assetId: asset.id,
                transactionHash: tx.hash,
                blockNumber: tx.blockNumber,
                amount: tx.tokenValue || '0',
                fromAddress: tx.from,
                toAddress: tx.to,
              }
            });
            console.log('ERC1155 Transfer saved:', tx.hash);
            newTransactions++;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring ERC1155 transfers:', error);
  }

  return newTransactions;
} 