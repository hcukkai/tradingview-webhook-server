const axios = require('axios');

const JUPITER_BASE = 'https://api.jup.ag';

class JupiterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
  }

  async getQuote({ inputMint, outputMint, amount, slippageBps = 50, onlyDirectRoutes = false }) {
    const { data } = await axios.get(`${JUPITER_BASE}/swap/v2/quote`, {
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
    const { data } = await axios.post(`${JUPITER_BASE}/swap/v2/build`, {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol,
      prioritizationFeeLamports
    }, { headers: this.headers });
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

  async getPrice(mint) {
    const { data } = await axios.get(`${JUPITER_BASE}/price/v2`, {
      headers: this.headers,
      params: { ids: mint }
    });
    return data.data[mint];
  }

  async getTokenInfo(mint) {
    const { data } = await axios.get(`${JUPITER_BASE}/tokens/v1/token/${mint}`, {
      headers: this.headers
    });
    return data;
  }
}

module.exports = JupiterClient;
