import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { TokenType } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, transactionHash, claimAddress } = req.body;
    console.log("claim api called");
    console.log(walletAddress, transactionHash, claimAddress);

    const wallet = await prisma.passWallet.findUnique({
      where: { address: walletAddress }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    // Check if transaction exists
    const transaction = await prisma.inboxTransaction.findUnique({
      where: { transactionHash }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.claimed) {
      return res.status(400).json({ error: 'Transaction already claimed' });
    }

    // Check if user is allowed to claim
    if (transaction.fromAddress.toLowerCase() !== claimAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Transaction not from wallet' });
    }
    // Get user subaccount
    let subaccount = await prisma.subaccount.findFirst({
        where: {
          walletId: wallet.id,
          address: claimAddress,
        },
      });
  
      if (!subaccount) {
        subaccount = await prisma.subaccount.create({
          data: {
            walletId: wallet.id,
            address: claimAddress,
            label: `Auto-${claimAddress.slice(0, 6)}`,
          },
        });
      }
      
      await prisma.$transaction(async (tx) => {
        // First, ensure the asset exists
        const asset = await tx.asset.findUnique({
          where: { id: transaction.assetId }
        });

        if (!asset) {
          throw new Error(`Asset with id ${transaction.assetId} not found`);
        }

        console.log("asset", asset);
        
        // Check if subaccount balance already exists
        const existingBalance = await tx.subaccountBalance.findFirst({
          where: {
            subaccountId: subaccount!.id,
            assetId: asset.id,
          },
        });

        if (existingBalance) {
          // Update existing balance
          await tx.subaccountBalance.update({
            where: {
              id: existingBalance.id,
            },
            data: {
              amount: (BigInt(existingBalance.amount) + BigInt(transaction.amount)).toString(),
            },
          });
        } else {
          // Create new balance
          await tx.subaccountBalance.create({
            data: {
              subaccountId: subaccount!.id,
              assetId: asset.id,
              amount: transaction.amount,
            },
          });
        }

        // Mark inbox as claimed
        await tx.inboxTransaction.update({
          where: { transactionHash },
          data: {
            claimed: true,
            claimedAt: new Date(),
          },
        });
      });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error claiming transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }}
