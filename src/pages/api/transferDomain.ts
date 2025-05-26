// Transfer domain permission to another account

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Delegates domainURL fromAddress to toAddress
    const { passAccountAddress, fromAddress, toAddress, domainUrl } = req.body;

    if (!passAccountAddress || !fromAddress || !toAddress || !domainUrl) {
      return res.status(400).json({
        error: 'Missing required fields: passAccountAddress, fromAddress, toAddress, and domainUrl are required'
      });
    }
    const wallet = await prisma.passWallet.findUnique({
        where: { address: passAccountAddress }
      });
    
    // console.log('passAccountAddress', passAccountAddress);
    // console.log('fromAddress', fromAddress);
    // console.log('toAddress', toAddress);
    // console.log('domainUrl', domainUrl);

    if (!wallet) {
      return res.status(404).json({ error: 'PASS account not found' });
    }

    // Find existing permission
    const existingPermission = await prisma.signDomainPermission.findFirst({
      where: {
        passAccountId: wallet.id,
        domainUrl: domainUrl,
      }
    });
    const allowedSigner = existingPermission?.allowedSigner || wallet.owner;

    if (allowedSigner !== fromAddress) {
      console.log('allowedSigner not equal to fromAddress', allowedSigner, fromAddress);
      return res.status(403).json({ error: 'Not authorized to transfer domain permission' });
    }

    // Create new permission for destination wallet
    const newPermission = await prisma.signDomainPermission.create({
      data: {
        passAccount: {
          connect: { id: wallet.id }
        },
        domainUrl: domainUrl,
        allowedSigner: toAddress
      }
    });

    // Delete the old permission if exists
    if (existingPermission) {
      await prisma.signDomainPermission.delete({
        where: { id: existingPermission?.id }
      });
    }

    return res.status(200).json({
      message: 'Domain permission transferred successfully',
      permission: newPermission
    });

  } catch (error) {
    console.error('Error transferring domain permission:', error);
    return res.status(500).json({
      error: 'Failed to transfer domain permission',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


