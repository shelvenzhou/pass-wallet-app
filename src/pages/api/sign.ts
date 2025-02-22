import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

const ENCLAVE_URL = process.env.ENCLAVE_URL || 'http://127.0.0.1:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, address, signerAddress, domainUrl, sessionId } = req.body;

    if (!message || !address || !signerAddress) {
      return res.status(400).json({ error: 'Message, address, and signer address are required' });
    }

    // Verify ownership through database
    const wallet = await prisma.passWallet.findUnique({
      where: { address }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    // TODO: More complex rule handling
    if (wallet.owner !== signerAddress) {
      return res.status(403).json({ error: 'Not authorized to sign for this wallet' });
    }

    // Call the enclave API to sign the message
    const enclaveResponse = await fetch(`${ENCLAVE_URL}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        message,
      }),
    });

    if (!enclaveResponse.ok) {
      const error = await enclaveResponse.json();
      throw new Error(error.error || 'Failed to sign message in enclave');
    }

    const data = await enclaveResponse.json();
    console.log('Enclave response:', data);

    // Record the sign transaction with sessionId
    await prisma.signTransaction.create({
      data: {
        passAccount: {
          connect: { id: wallet.id }
        },
        signer: signerAddress,
        domainUrl: domainUrl || 'unknown',
        message: message,
        signature: data.signature,
        sessionId: sessionId || null
      }
    });

    return res.status(200).json({ 
      signature: data.signature,
      address 
    });

  } catch (error) {
    console.error('Signing error:', error);
    return res.status(500).json({ 
      error: 'Failed to sign message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}