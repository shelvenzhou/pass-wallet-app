import type { NextApiRequest, NextApiResponse } from 'next';
import { PassAccount } from '../../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PassAccount[]>
) {
  // TODO: Replace this with actual blockchain/database query
  const defaultAccount = "0xdeadbeef"
  const accounts: PassAccount[] = [
    {
      address: process.env.PASS_WALLET_ADDRESS || defaultAccount,
      name: "Main Account",
      owners: ["0xabcd...efgh"],
      createdAt: "2024-02-17",
    },
    // Add more accounts as needed
  ];

  res.status(200).json(accounts);
}