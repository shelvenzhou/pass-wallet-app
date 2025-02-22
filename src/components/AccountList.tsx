import { useState } from 'react';
import { useRouter } from 'next/router';

interface PassAccount {
  address: string;
  name: string;
  owners: string[];
  createdAt: string;
}

// TODO: change this to the actual PASS Wallet address
const PASS_WALLET_ADDRESS = process.env.NEXT_PUBLIC_PASS_WALLET_ADDRESS || "";

const AccountsList = () => {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PassAccount[]>([
    {
      address: PASS_WALLET_ADDRESS,
      name: 'Main Account',
      owners: ['0xabcd...efgh'],
      createdAt: '2024-02-17',
    },
  ]);

  const accountCardStyle = {
    padding: '20px',
    border: '1px solid #eaeaea',
    borderRadius: '12px',
    marginBottom: '16px',
    width: '100%',
    maxWidth: '600px',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    }
  };

  const buttonStyle = {
    padding: '12px 24px',
    backgroundColor: '#0d76fc',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '20px',
  };

  const handleCreateNewAccount = () => {
    // Implement account creation logic here
    console.log('Creating new account...');
  };

  const handleAccountClick = (address: string) => {
    router.push(`/account/${address}`);
  };

  return (
    <div style={{ width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={handleCreateNewAccount}
          style={buttonStyle}
        >
          + Create New Account
        </button>
      </div>

      {accounts.map((account, index) => (
        <div 
          key={index} 
          style={accountCardStyle}
          onClick={() => handleAccountClick(account.address)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: '0' }}>{account.name}</h3>
            <span style={{ color: '#666' }}>Created: {account.createdAt}</span>
          </div>
          
          <div style={{ marginTop: '12px', color: '#666' }}>
            <p style={{ margin: '4px 0' }}>Address: {account.address}</p>
            <p style={{ margin: '4px 0' }}>Owners: {account.owners.length}</p>
          </div>
        </div>
      ))}

      {accounts.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
          <p>You don't have any PASS accounts yet.</p>
          <p>Create your first account to get started!</p>
        </div>
      )}
    </div>
  );
};

export default AccountsList;