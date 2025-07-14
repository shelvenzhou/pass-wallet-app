import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

const ENCLAVE_URL = process.env.ENCLAVE_URL || 'http://127.0.0.1:5000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case 'GET':
      try {
        const wallets = await prisma.passWallet.findMany();
        return res.status(200).json(wallets);
      } catch (error) {
        console.error('Failed to fetch wallets:', error);
        return res.status(500).json({ error: 'Failed to fetch passwallets' });
      }

    case 'POST':
      try {
        const { name, owner } = req.body;
        
        if (!name || !owner) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Call the enclave API to generate a new account
        console.log('calling URL: ', `${ENCLAVE_URL}/generate`);
        const enclaveResponse = await fetch(`${ENCLAVE_URL}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        });

        if (!enclaveResponse.ok) {
          const errorText = await enclaveResponse.text();
          console.error('Enclave response error:', errorText);
          throw new Error(`Failed to generate account in enclave: ${errorText}`);
        }

        const { address } = await enclaveResponse.json();

        // Create wallet record in database
        const newWallet = await prisma.passWallet.create({
          data: {
            address,
            name,
            owner: owner,
          },
        });

        return res.status(201).json(newWallet);
      } catch (error) {
        console.error('Failed to create wallet:', error);
        return res.status(500).json({ error: 'Failed to create passwallet' });
      }

    case 'DELETE':
      try {
        const { address } = req.query;
        
        if (!address) {
          return res.status(400).json({ error: 'Address is required' });
        }

        await prisma.passWallet.delete({
          where: { address: address as string },
        });

        return res.status(200).json({ message: 'Passwallet deleted successfully' });
      } catch (error) {
        console.error('Failed to delete wallet:', error);
        return res.status(500).json({ error: 'Failed to delete passwallet' });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 