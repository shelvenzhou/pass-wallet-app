import { createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';

let walletKit: any = null;
let walletAccount: `0x${string}` | null = null;

export const getWalletClient = async () => {
  if (!window.ethereum) {
    throw new Error('No Ethereum provider found');
  }
  
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    return createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum)
    });
  } catch (error) {
    console.error('User denied account access');
    throw error;
  }
};

export const getWalletKit = () => walletKit;
export const setWalletKit = (kit: any) => { walletKit = kit; };
export const getWalletAccount = () => walletAccount;
export const setWalletAccount = (account: `0x${string}`) => { walletAccount = account; };
export const getAddress = () => walletAccount;