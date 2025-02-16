import { SignClient } from '@walletconnect/sign-client';
import { IWalletKit } from '@reown/walletkit';

export interface WalletKitInstance {
  client: IWalletKit | null;
  initialized: boolean;
}

export interface SignClientInstance {
  client: InstanceType<typeof SignClient> | null;
  initialized: boolean;
}