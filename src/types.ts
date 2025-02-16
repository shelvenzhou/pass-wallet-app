// Account Types
export interface PassAccount {
  address: string;
  name: string;
  owners: string[];
  createdAt: string;
  assets?: Asset[];
}

export interface AccountData {
  name: string;
  balance: string;
  owner: string;
  assets: Asset[];
  transactions: Transaction[];
}

// Asset Types
export interface Asset {
  symbol: string;
  name: string;
  balance: string;
  value?: string;
}

// Transaction Types
export interface Transaction {
  hash: string;
  type: 'send' | 'receive';
  amount: string;
  timestamp: string;
}

// Modal Types
export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: Asset[];
}

export interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// API Response Types
export interface TransferResponse {
  success: boolean;
  transactionHash: string;
}

export interface WalletConnectResponse {
  success: boolean;
  error?: string;
}
