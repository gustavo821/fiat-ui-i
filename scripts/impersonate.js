/* eslint-disable @typescript-eslint/no-var-requires */
const WalletConnect = require('@walletconnect/client');
const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const WALLET_CONNECT_URI = process.argv[2];

(async () => {
  const provider = new ethers.providers.JsonRpcProvider((process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true')
    ? `https://rpc.tenderly.co/fork/${process.env.NEXT_PUBLIC_TENDERLY_APY_KEY}`
    : 'http://127.0.0.1:8545'
  );

  if (!process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT || !provider) console.log('Misconfigured environment vars');
  
  let cachedSession;
  try { cachedSession = fs.readFileSync('./cached_session'); } catch (e) { console.log('No cached session'); }
  if (!cachedSession && !WALLET_CONNECT_URI) throw new Error('No cached session or supplied Wallet Connect URI');

  // Create connector and connect to WalletConnect bridge
  const connector = new WalletConnect.default({ 
    bridge: 'https://bridge.walletconnect.org', 
    uri: (WALLET_CONNECT_URI) ? process.argv[2] : undefined,
    session: !(WALLET_CONNECT_URI) ? JSON.parse(cachedSession) : undefined
  });

  // Subscribe to 'connect' events
  connector.on('connect', (error) => {
    console.log('Connect');
    if (error) throw error;
    console.log('Impersonating address: ', process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT);
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

  // Subscribe to 'disconnect' events
  connector.on('disconnect', (error) => {
    if (error) throw error;
    console.log('Disconnect');
  });

  // Create new session if it wasn't cached
  if (!connector.connected) {
    console.log('Create session')
    await connector.createSession();
  } else {
    console.log('Session resumed');
  }

  // Subscribe to session requests
  connector.on('session_request', (error) => {
    console.log('Session request');
    if (error) throw error;
    connector.approveSession({ chainId: 1337, accounts: [process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT] });
  });

  // Subscribe to call requests
  connector.on('call_request', async (error, payload) => {
    console.log('Call request');
    if (error) throw error;
    try {
      const signer = provider.getSigner(process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT);
      const { to, from, data, gas} = payload.params[0];
      const gasLimit = ethers.BigNumber.from(gas).mul(2);
      const result = await signer.sendTransaction({ to, from, data, gasLimit })
      console.log({ result })
      connector.approveRequest({ id: payload.id, result: result.hash });
    } catch (error) {
      console.log({error})
    }
  });
})();
