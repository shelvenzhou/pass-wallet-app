# PassWallet App Prototype

By Jay Yu


## Overview
PassWallet is a decentralized wallet application that enables secure key management through a simulated Trusted Execution Environment (TEE). It combines Next.js, RainbowKit, and WalletConnect for the frontend with a AWS Nitro Enclave TEE for key management and signing. This is a demo application based on recent work on key encumbrance techniques and TEE-based wallet platforms such as [Liquefaction](https://github.com/key-encumbrance/liquefaction).

## Features

- **Multi-Account Support**: Create and manage multiple Ethereum accounts
- **WalletConnect Integration**: Connect and interact with dApps using WalletConnect v2
- **Message Signing**: Sign messages securely through the enclave
- **Transaction History**: View transaction history and signed message records
- **Asset Management**: View and transfer assets (ETH, USDC, etc.)
- **Secure Key Management**: Keys are encumbered and managed in a secure TEE enclave, currently deployed using AWS Nitro Enclaves. We also provide a Python server that simulates a secure enclave. This encumbrance ensures that all signing logic is handled by pre-defined rules, cannot be overwritten arbitrarily by account owner

## Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/jayyu23/pass-wallet-app
```

2. **Install dependencies**
```bash
# Install frontend dependencies
npm install

# Install Python enclave dependencies
cd py-kms-sim
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

3. **Set up environment variables**

Create `.env`:
```
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id
DATABASE_URL="file:./dev.db"
```

Create `py-kms-sim/.env`:
```
ENCLAVE_SECRET=your_secure_enclave_secret
```

4. **Initialize the database**
```bash
npx prisma db push
```

5. **Start the services**

Run backend:

See `nitro-enclave` folder for instructions to setup AWS Nitro server

For Flask simulation of enclave, run:
```bash
npm run enclave-py
```

Run frontend:
```bash
npm run dev
```


Visit `http://localhost:3000` to use the application.

## Development

### Architecture

```
├── src/                  # Frontend application
│   ├── components/       # React components
│   ├── pages/           # Next.js pages & API routes
│   ├── styles/          # CSS modules
│   └── types/           # TypeScript definitions
├── py-kms-sim/          # Python Key Management System Simulation
│   ├── enclave_api.py   # REST API endpoints
│   ├── enclave_kms.py   # Core KMS logic
│   └── venv/            # Python virtual environment
├── nitro-enclave/       # AWS Nitro Enclave implementation
└── prisma/              # Database schema
```

### Key Components

- **Frontend**: Next.js + RainbowKit for wallet connections and UI
- **Backend**: Next.js API routes for business logic
- **Enclave**: AWS Nitro Enclave (nitro-enclave) or Python service simulating a TEE for key operations (py-kms-sim)
- **Database**: SQLite via Prisma for wallet metadata


## Security Considerations

> ⚠️ **Warning**: This implementation is for demonstration purposes only.

For production use:

- Replace simulated TEE with real hardware security (AWS Nitro Enclaves, Intel SGX)
- Implement key rotation and secure backup procedures
- Add comprehensive access controls and audit logging
- Use secure channels between components
- Regular security audits

## License

This project is licensed under the MIT License.

## Acknowledgments

This project is inspired by the [Liquefaction](https://github.com/key-encumbrance/liquefaction) paper by IC3 researchers James Austgen, Andrés Fábrega, Mahimna Kelkar, Dani Vilardell, Sarah Allen, Kushal Babel, Jay Yu, and Ari Juels.

Built with:
- [RainbowKit](https://rainbowkit.com) - Wallet connection UI
- [wagmi](https://wagmi.sh) - React Hooks for Ethereum
- [Next.js](https://nextjs.org) - React Framework
- [WalletConnect v2](https://walletconnect.com) - Web3 Messaging Protocol
- [eth-account](https://github.com/ethereum/eth-account) - Ethereum Key Management
