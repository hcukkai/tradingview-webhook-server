const axios = require('axios');

const JUPITER_BASE = 'https://api.jup.ag';

class JupiterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
  }

  async getQuote({ inputMint, outputMint, amount, slippageBps = 50, onlyDirectRoutes = false }) {
    const { data } = await axios.get(`${JUPITER_BASE}/swap/v1/quote`, {
      headers: this.headers,
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes
      }
    });
    return data;
  }

  async buildSwap({ quoteResponse, userPublicKey, wrapAndUnwrapSol = true, prioritizationFeeLamports }) {
    const body = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol
    };
    if (prioritizationFeeLamports) body.prioritizationFeeLamports = prioritizationFeeLamports;
    const { data } = await axios.post(`${JUPITER_BASE}/swap/v1/swap`, body, { headers: this.headers });
    return data;
  }

  async createTriggerOrder({ maker, inputMint, outputMint, inAmount, outAmount, expiredAt }) {
    const { data } = await axios.post(`${JUPITER_BASE}/trigger/v1/createOrder`, {
      maker,
      inputMint,
      outputMint,
      params: {
        inAmount: String(inAmount),
        outAmount: String(outAmount),
        ...(expiredAt && { expiredAt })
      }
    }, { headers: this.headers });
    return data;
  }

  async createRecurringOrder({ user, inputMint, outputMint, inAmount, outAmount, cycleFrequency, numberOfCycles }) {
    const { data } = await axios.post(`${JUPITER_BASE}/recurring/v1/createOrder`, {
      user,
      inputMint,
      outputMint,
      params: {
        inAmount: String(inAmount),
        outAmount: String(outAmount),
        cycleFrequency,
        numberOfCycles
      }
    }, { headers: this.headers });
    return data;
  }

  async getPrice(mint, vsMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
    const amount = '1000000000'; // 1 SOL in lamports
    const { data } = await axios.get(`${JUPITER_BASE}/swap/v1/quote`, {
      headers: this.headers,
      params: { inputMint: mint, outputMint: vsMint, amount, slippageBps: 50 }
    });
    const price = parseFloat(data.outAmount) / parseFloat(data.inAmount);
    return { price, vsToken: vsMint, raw: data };
  }

  async getTokenInfo(mint) {
    const { data } = await axios.get(`${JUPITER_BASE}/tokens/v1/token/${mint}`, {
      headers: this.headers
    });
    return data;
  }
}

module.exports = JupiterClient;
