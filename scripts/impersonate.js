const WalletConnect = require('@walletconnect/client');
const ethers = require('ethers');

const impersonate = process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT;
const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');

(async () => {
  // Create connector and connect to WalletConnect bridge
  const connector = new WalletConnect.default({ bridge: 'https://bridge.walletconnect.org', uri: process.argv[2] });

  // Subscribe to session requests
  connector.on('session_request', (error) => {
    if (error) throw error;
    connector.approveSession({ chainId: 1337, accounts: [impersonate] });
  });

  // Subscribe to call requests
  connector.on('call_request', async (error, payload) => {
    if (error) throw error;
    const signer = provider.getSigner(impersonate);
    const { to, from, data } = payload.params[0];
    const result = await signer.sendTransaction({ to, from, data })
    console.log({ result })
    connector.approveRequest({ id: payload.id, result: result.hash });
    await result.wait();
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
