import { Transaction } from "../types";
import { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { create } from "zustand";
import { IWalletKit } from "@reown/walletkit";
import { createWalletClient, custom, WalletClient } from "viem";
import { sepolia } from "viem/chains";

interface ModalData {
  proposal?: SignClientTypes.EventArguments["session_proposal"];
  requestEvent?: SignClientTypes.EventArguments["session_request"];
  requestSession?: SessionTypes.Struct;
  loadingMessage?: string;
  authRequest?: SignClientTypes.EventArguments["session_authenticate"];
  txnData?: Transaction;
}

export interface WalletState {
  // Modal and session data
  data: ModalData;
  activeSessions: Record<string, SessionTypes.Struct>;
  
  // Wallet instances
  walletKit: IWalletKit | null;
  walletClient: WalletClient | null;
  walletAccount: `0x${string}` | null;
  
  // Actions
  setData: (data: ModalData) => void;
  setActiveSessions: (sessions: Record<string, SessionTypes.Struct>) => void;
  clearData: () => void;
  setWalletKit: (kit: IWalletKit | null) => void;
  setWalletAccount: (account: `0x${string}` | null) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  data: {},
  activeSessions: {},
  walletKit: null,
  walletClient: null,
  walletAccount: null,
  
  // Actions
  setData: (data) => set((state) => ({ 
    data: { ...state.data, ...data } 
  })),
  
  setActiveSessions: (sessions) => set({ 
    activeSessions: sessions 
  }),
  
  clearData: () => set({ 
    data: {} 
  }),
  
  setWalletKit: (kit) => set({ 
    walletKit: kit 
  }),
  
  setWalletAccount: (account) => set({ 
    walletAccount: account 
  }),
}));

// Helper functions that use the store
export const getWalletKit = () => useWalletStore.getState().walletKit;
export const getWalletAccount = () => useWalletStore.getState().walletAccount;
export const getAddress = () => useWalletStore.getState().walletAccount; 
export const getWalletClient = () => useWalletStore.getState().walletClient;
export const setWalletKit = (kit: IWalletKit | null) => useWalletStore.getState().setWalletKit(kit);