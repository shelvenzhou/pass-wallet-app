import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

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
        const { address, name, owners } = req.body;
        
        if (!address || !name || !owners) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const newWallet = await prisma.passWallet.create({
          data: {
            address,
            name,
            owners: JSON.stringify(owners),
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