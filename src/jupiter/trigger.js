const JupiterClient = require('./client');

class JupiterTrigger {
  constructor({ apiKey, publicKey, paperTrading = true }) {
    this.client = new JupiterClient(apiKey);
    this.publicKey = publicKey;
    this.paperTrading = paperTrading;
  }

  async createLimitOrder({ inputMint, outputMint, inAmount, outAmount, expiredAt }) {
    if (this.paperTrading) {
      return {
        status: 'paper',
        orderId: `paper_trigger_${Date.now()}`,
        inputMint,
        outputMint,
        inAmount,
        outAmount,
        maker: this.publicKey,
        message: 'Paper limit order created - no real order placed'
      };
    }

    const order = await this.client.createTriggerOrder({
      maker: this.publicKey,
      inputMint,
      outputMint,
      inAmount: String(inAmount),
      outAmount: String(outAmount),
      expiredAt
    });

    return {
      status: 'success',
      orderId: order.orderId || order.id,
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      maker: this.publicKey,
      raw: order
    };
  }

  async createDCA({ inputMint, outputMint, inAmount, outAmount, cycleFrequency, numberOfCycles }) {
    if (this.paperTrading) {
      return {
        status: 'paper',
        orderId: `paper_dca_${Date.now()}`,
        inputMint,
        outputMint,
        inAmount,
        outAmount,
        cycleFrequency,
        numberOfCycles,
        message: 'Paper DCA order created - no real order placed'
      };
    }

    const order = await this.client.createRecurringOrder({
      user: this.publicKey,
      inputMint,
      outputMint,
      inAmount: String(inAmount),
      outAmount: String(outAmount),
      cycleFrequency,
      numberOfCycles
    });

    return {
      status: 'success',
      orderId: order.orderId || order.id,
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      cycleFrequency,
      numberOfCycles,
      raw: order
    };
  }
}

module.exports = JupiterTrigger;
