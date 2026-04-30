const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
const bs58 = require('bs58');
const JupiterClient = require('./client');

class JupiterSwap {
  constructor({ rpcUrl, privateKey, apiKey, paperTrading = true }) {
    this.paperTrading = paperTrading;
    this.client = new JupiterClient(apiKey);

    if (!paperTrading && privateKey) {
      this.connection = new Connection(rpcUrl, 'confirmed');
      this.keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      this.publicKey = this.keypair.publicKey.toBase58();
    } else {
      this.publicKey = 'PAPER_MODE_NO_REAL_WALLET';
    }
  }

  async executeMarketSwap({ inputMint, outputMint, amount, slippageBps = 50 }) {
    if (this.paperTrading) {
      return {
        status: 'paper',
        txSignature: `paper_${Date.now()}`,
        inputMint,
        outputMint,
        amount,
        slippageBps,
        message: 'Paper trade executed - no real transaction sent'
      };
    }

    // 1. Get quote
    const quote = await this.client.getQuote({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps
    });

    // 2. Build transaction
    const swapData = await this.client.buildSwap({
      quoteResponse: quote,
      userPublicKey: this.publicKey,
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: 'auto'
    });

    // 3. Deserialize and sign
    const txBuffer = Buffer.from(swapData.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([this.keypair]);

    // 4. Send
    const txSignature = await this.connection.sendTransaction(transaction, {
      maxRetries: 3,
      skipPreflight: false
    });

    // 5. Confirm
    const latestBlockhash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      signature: txSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });

    return {
      status: 'success',
      txSignature,
      inputMint,
      outputMint,
      amount,
      slippageBps,
      quote
    };
  }

  async getTokenDecimals(mint) {
    if (this.paperTrading) return 9;
    const info = await this.connection.getParsedAccountInfo({ pubkey: { toBase58: () => mint } });
    return info.value?.data?.parsed?.info?.decimals || 9;
  }
}

module.exports = JupiterSwap;
