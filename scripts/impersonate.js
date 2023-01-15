const WalletConnect = require('@walletconnect/client');
const ethers = require('ethers');

const impersonate = '0xCFFAd3200574698b78f32232aa9D63eABD290703';

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');

const main = async() => {
  // Create connector
  const connector = new WalletConnect.default(
    {
      bridge: 'https://bridge.walletconnect.org', // Required
      uri: process.argv[2]
    },
  );

  // Subscribe to session requests
  connector.on('session_request', (error, payload) => {
    if (error) {
      throw error;
    }
    connector.approveSession({ chainId: 1337, accounts: [impersonate] });
  });

  // Subscribe to call requests
  connector.on('call_request', async (error, payload) => {
    if (error) {
      throw error;
    }
    const signer = provider.getSigner(impersonate);
    const { to, from, data } = payload.params[0];
    const result = await signer.sendTransaction({ to, from, data })
    //const result = await provider.send(payload.methd, payload.params)
    console.log({result})
    connector.approveRequest({
      id: payload.id,
      result: result.hash
    });
    await result.wait();
  });

  connector.on('connect', (error, payload) => {
    console.log('Impersonating address: ', impersonate);
    if (error) {
      throw error;
    }
  });

  connector.on('disconnect', (error, payload) => {
    if (error) {
      throw error;
    }
  });

  if (!connector.connected) {
    await connector.createSession();
  }
}

main();
