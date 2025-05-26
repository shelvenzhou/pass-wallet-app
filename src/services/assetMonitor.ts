import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});


// ERC20 Transfer event ABI
const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export class AssetMonitor {
  private watchedAddresses: Set<string> = new Set();

  async startMonitoring(passAccountAddress: string) {
    this.watchedAddresses.add(passAccountAddress.toLowerCase());

    // Watch for ETH transfers
    this.watchEthTransfers(passAccountAddress);
    
    // Watch for ERC20 token transfers
    this.watchTokenTransfers(passAccountAddress);
  }

  private logEvent(type: string, data: any) {
    console.log(`[AssetMonitor] ${type}:`, data);
    
    // Also dispatch a custom event for the test page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('assetMonitorLog', {
        detail: { type, data, timestamp: new Date().toISOString() }
      }));
    }
  }

  private async watchEthTransfers(address: string) {
    this.logEvent('WATCH_ETH_START', { address });
    
    publicClient.watchBlocks({
      onBlock: async (block) => {
        this.logEvent('NEW_BLOCK', { blockNumber: block.number, hash: block.hash });
        
        const blockWithTransactions = await publicClient.getBlock({
          blockHash: block.hash!,
          includeTransactions: true
        });

        for (const tx of blockWithTransactions.transactions) {
          if (tx.to?.toLowerCase() === address.toLowerCase() && tx.value > BigInt(0)) {
            this.logEvent('ETH_TRANSFER_DETECTED', {
              to: tx.to,
              value: tx.value.toString(),
              hash: tx.hash
            });
            await this.handleIncomingEth(address, tx);
          }
        }
      }
    });
  }

  private async watchTokenTransfers(address: string) {
    this.logEvent('WATCH_TOKENS_START', { address });
    
    publicClient.watchEvent({
      event: transferEventAbi,
      args: {
        to: address as `0x${string}`
      },
      onLogs: (logs) => {
        this.logEvent('TOKEN_TRANSFER_DETECTED', { logsCount: logs.length });
        logs.forEach(log => {
          this.logEvent('TOKEN_TRANSFER_LOG', log);
          this.handleIncomingToken(address, log);
        });
      }
    });
  }

  private async handleIncomingEth(address: string, transaction: any) {
    console.log(`Incoming ETH to ${address}:`, {
      amount: transaction.value,
      from: transaction.from,
      hash: transaction.hash
    });

    // Update database
    await this.updateAssetBalance(address, 'ETH', transaction.value);
    
    // Trigger UI update
    await this.notifyBalanceUpdate(address);
  }

  private async handleIncomingToken(address: string, log: any) {
    console.log(`Incoming token to ${address}:`, log);

    // Get token info
    const tokenInfo = await this.getTokenInfo(log.address);
    
    // Update database
    await this.updateAssetBalance(address, tokenInfo.symbol, log.args.value);
    
    // Trigger UI update
    await this.notifyBalanceUpdate(address);
  }

  private async getTokenInfo(tokenAddress: string) {
    // Get token symbol and decimals
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [parseAbiItem('function symbol() view returns (string)')],
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [parseAbiItem('function decimals() view returns (uint8)')],
        functionName: 'decimals'
      })
    ]);

    return { symbol, decimals };
  }

  private async updateAssetBalance(address: string, symbol: string, amount: bigint) {
    // Call your API to update the database
    await fetch('/api/assets/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        symbol,
        amount: amount.toString()
      })
    });
  }

  private async notifyBalanceUpdate(address: string) {
    // Trigger a refresh of the account data
    window.dispatchEvent(new CustomEvent('assetBalanceUpdate', { 
      detail: { address } 
    }));
  }
} 