import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { TokenType } from '@prisma/client';

const ENCLAVE_URL = process.env.ENCLAVE_URL || 'http://127.0.0.1:5000';

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

    // Get transaction from database for reference
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

    // Get or create subaccount ID
    let subaccount = await prisma.subaccount.findFirst({
      where: {
        walletId: transaction.walletId,
        address: claimAddress,
      },
    });

    if (!subaccount) {
      subaccount = await prisma.subaccount.create({
        data: {
          walletId: transaction.walletId,
          address: claimAddress,
          label: `Auto-${claimAddress.slice(0, 6)}`,
        },
      });
    }

    // Call enclave to perform the claim
    const enclaveResponse = await fetch(`${ENCLAVE_URL}/pass/wallets/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        deposit_id: transactionHash, // Use transaction hash as deposit ID
        subaccount_id: subaccount.id,
      }),
    });

    if (!enclaveResponse.ok) {
      const errorData = await enclaveResponse.json();
      throw new Error(errorData.error || 'Failed to claim in enclave');
    }

    // Mark as claimed in database for UI purposes
    await prisma.inboxTransaction.update({
      where: { transactionHash },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error claiming transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
