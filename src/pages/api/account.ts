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
        // Use enclave to list wallet addresses
        const enclaveResponse = await fetch(`${ENCLAVE_URL}/pass/wallets`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!enclaveResponse.ok) {
          console.error('Enclave response not ok:', enclaveResponse.status, enclaveResponse.statusText);
          // Return empty array instead of throwing error
          return res.status(200).json([]);
        }

        const enclaveData = await enclaveResponse.json();
        console.log('Enclave response:', enclaveData);
        const walletAddresses = enclaveData.wallets || [];
        console.log('Wallet addresses:', walletAddresses);
        
        // Get full wallet details from database for UI
        const wallets = await prisma.passWallet.findMany({
          where: {
            address: {
              in: walletAddresses
            }
          }
        });
        
        console.log('Database wallets:', wallets);
        return res.status(200).json(wallets);
      } catch (error) {
        console.error('Failed to fetch wallets:', error);
        // Return empty array instead of error object
        return res.status(200).json([]);
      }

    case 'POST':
      try {
        const { name, owner } = req.body;
        
        if (!name || !owner) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Call the enclave API to create a new PASS wallet
        console.log('calling URL: ', `${ENCLAVE_URL}/pass/wallets`);
        const enclaveResponse = await fetch(`${ENCLAVE_URL}/pass/wallets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            owner,
          }),
        });

        if (!enclaveResponse.ok) {
          const errorText = await enclaveResponse.text();
          console.error('Enclave response error:', errorText);
          throw new Error(`Failed to create wallet in enclave: ${errorText}`);
        }

        const walletData = await enclaveResponse.json();
        
        // Also create a record in database for UI purposes (optional)
        const newWallet = await prisma.passWallet.create({
          data: {
            address: walletData.wallet_address,
            name,
            owner: owner,
          },
        });

        return res.status(201).json(newWallet);
      } catch (error) {
        console.error('Failed to create wallet:', error);
        return res.status(500).json({ error: 'Failed to create passwallet' });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 