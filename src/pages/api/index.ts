export interface PassAccount {
    address: string;
    name: string;
    owners: string[];
    createdAt: string;
    assets: Asset[];
  }
  
  export interface Asset {
    symbol: string;
    name: string;
    balance: string;
    value: string;
    icon?: string;
  }
  
  export interface Transaction {
    hash: string;
    type: 'send' | 'receive';
    amount: string;
    timestamp: string;
    from: string;
    to: string;
    asset: string;
  }