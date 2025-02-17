import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  base,
  mainnet,
  sepolia,
} from 'wagmi/chains';

console.log(process.env.NEXT_PUBLIC_PROJECT_ID);

export const config = getDefaultConfig({
  appName: 'PassWallet',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || 'none',
  chains: [
    sepolia,
    mainnet,
    base,
    arbitrum,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  ssr: true,
});