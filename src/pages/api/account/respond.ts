import type { NextApiRequest, NextApiResponse } from 'next';
import { privateKeyToAccount } from 'viem/accounts';
import { walletKitService } from '../../../services/walletkit';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { approved, request, signature } = req.body;

  try {
    const walletKit = walletKitService.getWalletKit();

    if (approved) {
      if (request.params.request.method === 'personal_sign') {
        const privateKey = process.env.NEXT_PUBLIC_PASS_WALLET_PRIVATE_KEY;
        if (!privateKey) {
          throw new Error('Private key not found');
        }

        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const signature = await account.signMessage({ 
          message: request.params.request.params[0] 
        });

        await walletKit.respondSessionRequest({
          topic: request.topic,
          response: { 
            id: request.id, 
            result: signature,
            jsonrpc: '2.0' 
          }
        });
      }
    } else {
      await walletKit.respondSessionRequest({
        topic: request.topic,
        response: {
          id: request.id,
          error: {
            code: 5000,
            message: 'User rejected.'
          },
          jsonrpc: '2.0'
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error responding to request:', error);
    res.status(500).json({ error: 'Failed to respond to request' });
  }
} 