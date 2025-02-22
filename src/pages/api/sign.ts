import { NextApiRequest, NextApiResponse } from "next";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, address, signerAddress } = req.body;

    if (!message || !address || !signerAddress) {
      return res.status(400).json({ error: 'Message, address, and signer address are required' });
    }

    console.log("Message: " + message);
    console.log("Address: " + address);
    console.log("Signer address: " + signerAddress);

    // Get private key from environment
    const privateKey = process.env.NEXT_PUBLIC_PASS_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: 'Private key not configured' });
    }
  
    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create wallet client
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http()
    });

    // Check if the address is whitelisted
    if (address !== account.address) {
      return res.status(400).json({ error: 'Address does not match' });
      
    }
    // Whitelist logic

    // Sign the message
    const signature = await client.signMessage({
      message,
    });

    return res.status(200).json({ 
      signature,
      address: account.address 
    });

  } catch (error) {
    console.error('Signing error:', error);
    return res.status(500).json({ 
      error: 'Failed to sign message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}