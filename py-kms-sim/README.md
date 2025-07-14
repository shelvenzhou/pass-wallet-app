# Python Simulation - Enclave Key Management System

## Overview

- Uses a Python Flask server to simulate a key management system inside of a secure enclave or Trusted Execution Environment (TEE) such as AWS Nitro EC2 instance. Placeholder environment for actual TEE.

- Uses the `eth-account` library to generate Ethereum accounts and encrypt/decrypt them with a secret. The encrypted keys are stored in a local file.

- The secret is stored in the environment variable `ENCLAVE_SECRET` that simulates the root of trust for the enclave.

- Called through the Backend API in Next.js PassWallet app on `http://localhost:5000`

- Note that this is a simple implementation and is not intended to be used in production. It is only a local simulation for the PassWallet app (in the absence of a live TEE environment)

## Setup

Create virtualenv in this dir:
```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run virtualenv and Flask Server
```bash
python3 enclave_api.py
```

Or use in parent dir:
```bash
npm run enclave-py
```
