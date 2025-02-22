# Enclave Key Management System

## Overview

- Simulates a key management system inside of a secure enclave or Trusted Execution Environment (TEE) such as AWS Nitro EC2 instance.

- Uses the `eth-account` library to generate Ethereum accounts and encrypt/decrypt them with a secret. The encrypted keys are stored in a local file.

- The secret is stored in the environment variable `ENCLAVE_SECRET` that simulates the root of trust for the enclave.

- Called through the Backend API in Next.js PassWallet app.

- Note that this is a simple implementation and is not intended to be used in production. It is only a local simulation for the PassWallet app.

## Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

