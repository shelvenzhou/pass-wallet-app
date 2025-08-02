import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      walletAddress, 
      connectedAddress, 
      assetId, 
      amount, 
      destination,
      gas_price,
      gas_limit,
      chain_id = 1
    } = req.body;

    if (!walletAddress || !connectedAddress || !assetId || !amount || !destination) {
      return res.status(400).json({ 
        error: 'Missing required fields: walletAddress, connectedAddress, assetId, amount, destination' 
      });
    }

    // Find the connected subaccount
    const subaccount = await prisma.subaccount.findFirst({
      where: {
        walletAddress: walletAddress,
        address: connectedAddress
      }
    });

    if (!subaccount) {
      return res.status(404).json({ error: 'Subaccount not found' });
    }

    // Prepare the withdrawal request for the enclave
    const withdrawalRequest = {
      wallet_address: walletAddress,
      subaccount_id: subaccount.id.toString(),
      asset_id: assetId,
      amount: parseInt(amount),
      destination: destination,
      chain_id: chain_id
    };

    // Add optional gas parameters
    if (gas_price) {
      withdrawalRequest.gas_price = parseInt(gas_price);
    }
    if (gas_limit) {
      withdrawalRequest.gas_limit = parseInt(gas_limit);
    }

    // Get enclave URL from environment
    const enclaveUrl = process.env.NEXT_PUBLIC_ENCLAVE_URL || 'http://localhost:5000';

    // Call the enclave withdrawal endpoint
    const enclaveResponse = await fetch(`${enclaveUrl}/pass/wallets/withdrawals/external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(withdrawalRequest),
    });

    if (!enclaveResponse.ok) {
      let errorMessage = 'Enclave withdrawal failed';
      try {
        const errorData = await enclaveResponse.text();
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.error || errorMessage;
      } catch {
        errorMessage = `Enclave returned status ${enclaveResponse.status}`;
      }
      
      return res.status(enclaveResponse.status).json({ 
        error: errorMessage 
      });
    }

    const enclaveData = await enclaveResponse.json();

    if (enclaveData.success) {
      // Return the signed transaction data
      return res.status(200).json({
        success: true,
        data: {
          signed_raw_transaction: enclaveData.data.signed_raw_transaction,
          wallet_address: enclaveData.data.wallet_address,
          subaccount_id: enclaveData.data.subaccount_id,
          subaccount_address: connectedAddress,
          asset_id: enclaveData.data.asset_id,
          amount: enclaveData.data.amount,
          destination: enclaveData.data.destination,
          chain_id: enclaveData.data.chain_id,
          nonce: enclaveData.data.nonce,
          gas_price: enclaveData.data.gas_price,
          gas_limit: enclaveData.data.gas_limit
        }
      });
    } else {
      return res.status(400).json({ 
        error: enclaveData.error || 'Withdrawal failed' 
      });
    }

  } catch (error: any) {
    console.error('Withdrawal API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}