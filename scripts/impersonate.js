const WalletConnect = require('@walletconnect/client');
const ethers = require('ethers');
require('dotenv').config({ path: '.env.local' });

const impersonate = process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT;
const useTenderly = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true';
const tenderlyKey = process.env.NEXT_PUBLIC_TENDERLY_APY_KEY;
const forkURL = useTenderly ? `https://rpc.tenderly.co/fork/${tenderlyKey}` : 'http://127.0.0.1:8545';
const provider = new ethers.providers.JsonRpcProvider(forkURL);

(async () => {
  if (!impersonate || !provider) {
    console.log('Misconfigured environment vars');
  }

  // Create connector and connect to WalletConnect bridge
  const connector = new WalletConnect.default({ bridge: 'https://bridge.walletconnect.org', uri: process.argv[2] });

  // Subscribe to session requests
  connector.on('session_request', (error) => {
    console.log('Session request');
    if (error) throw error;
    connector.approveSession({ chainId: 1337, accounts: [impersonate] });
  });

  // Subscribe to call requests
  connector.on('call_request', async (error, payload) => {
    if (error) throw error;
    try {
      const signer = provider.getSigner(impersonate);
      const { to, from, data, gas} = payload.params[0];
      const gasLimit = ethers.BigNumber.from(gas).mul(2);
      const result = await signer.sendTransaction({ to, from, data, gasLimit })
      console.log({ result })
      connector.approveRequest({ id: payload.id, result: result.hash });
      //await result.wait();
    } catch (error) {
      console.log({error})
    }
  });

  connector.on('connect', (error) => {
    if (error) throw error;
    console.log('Connect');
    console.log('Impersonating address: ', impersonate);
  });

  connector.on('disconnect', (error) => {
    if (error) throw error;
    console.log('Disconnect');
  });

  if (!connector.connected) {
    await connector.createSession();
  }
})();
