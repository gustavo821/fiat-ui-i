const WalletConnect = require('@walletconnect/client');
const ethers = require('ethers');
const fs = require('fs');
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
  const uri = process.argv[2];
  let cachedSession;
  try {
    cachedSession = fs.readFileSync('./cached_session');
  } catch (e) {
    console.log('No cached session');
  }

  if (!cachedSession && !uri) {
    console.log('No cached session or supplied uri');
    return;
  }

  // Create connector and connect to WalletConnect bridge
  const connector = new WalletConnect.default({ 
    bridge: 'https://bridge.walletconnect.org', 
    uri: uri ? process.argv[2] : undefined,
    session: !uri ? JSON.parse(cachedSession) : undefined
  });
  console.log(connector.connected)

  // Subscribe to session requests
  connector.on('session_request', (error) => {
    console.log('Session request');
    if (error) throw error;
    connector.approveSession({ chainId: 1337, accounts: [impersonate] });
  });

  // Subscribe to call requests
  connector.on('call_request', async (error, payload) => {
    console.log('Call request');
    if (error) throw error;
    try {
      const signer = provider.getSigner(impersonate);
      const { to, from, data, gas} = payload.params[0];
      const gasLimit = ethers.BigNumber.from(gas).mul(2);
      const result = await signer.sendTransaction({ to, from, data, gasLimit })
      console.log({ result })
      connector.approveRequest({ id: payload.id, result: result.hash });
    } catch (error) {
      console.log({error})
    }
  });

  connector.on('connect', (error) => {
    console.log('Connect');
    if (error) throw error;
    console.log('Impersonating address: ', impersonate);
    try {
      fs.rmSync('./cached_session');
    } catch (e) {}
      fs.writeFile('./cached_session', JSON.stringify(connector.session), (err) => {
      if (err)
        console.log(err);
      else {
        console.log('Cached wallet connect session');
      }
    });
  });

  connector.on('disconnect', (error) => {
    if (error) throw error;
    console.log('Disconnect');
  });

  if (!connector.connected) {
    console.log('Create session')
    await connector.createSession();
  } else {
    console.log('Session resumed');
  }
})();
