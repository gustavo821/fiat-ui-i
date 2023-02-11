import { createTheme, NextUIProvider } from '@nextui-org/react';
import {
  connectorsForWallets, darkTheme, getDefaultWallets, lightTheme, RainbowKitProvider, Wallet
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { argentWallet, ledgerWallet, trustWallet } from '@rainbow-me/rainbowkit/wallets';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Chain, chain, configureChains, createClient, useNetwork, WagmiConfig } from 'wagmi';
import { MockConnector } from 'wagmi/connectors/mock';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/global.css';
import devStore from '../src/state/stores/devStore';
import { useEffect, useState } from 'react';
import axios from 'axios';

const APP_NAME = 'FIAT I UI';
const USE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';
const USE_GANACHE = process.env.NEXT_PUBLIC_GANACHE_FORK === 'true' && process.env.NODE_ENV === 'development';
const USE_TENDERLY = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true' && process.env.NODE_ENV === 'development';
const USE_FORK = USE_GANACHE || USE_TENDERLY;

let chainConfig: Chain[], providerConfig, connectors, provider: any, webSocketProvider: any, chains: any[];

const TENDERLY_USER = process.env.NEXT_PUBLIC_TENDERLY_USER;
const TENDERLY_PROJECT = process.env.NEXT_PUBLIC_TENDERLY_PROJECT;
const TENDERLY_FORK_API = `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`;
const TENDERLY_ACCESS_KEY = process.env.NEXT_PUBLIC_TENDERLY_ACCESS_KEY;

let forkRequestInFlight = false;
const createTenderlyFork = async () => {
  if (!USE_TENDERLY || forkRequestInFlight) return;
  const cachedForkId = window.sessionStorage.getItem('tenderly-fork-id');
  if (cachedForkId) return cachedForkId;

  const opts = { headers: { 'X-Access-Key': TENDERLY_ACCESS_KEY as string } };
  const body = { 'network_id': '1' }

  try {
    forkRequestInFlight = true;
    const response = await axios.post(TENDERLY_FORK_API, body, opts);
    const forkId = response.data.simulation_fork.id;
    window.sessionStorage.setItem('tenderly-fork-id', forkId);
    forkRequestInFlight = false;
    return forkId;
  } catch (error) {
    console.error({error})
    forkRequestInFlight = false;
    return '';
  }
}

const nextLightTheme = createTheme({
  type: 'light',
  theme: {
    colors: {
      connectButtonBackground: '#FFF',
      connectButtonColor: '#25292e',
    },
    transitions: {
      default: 'all 125ms ease',
    },
  }
})
const nextDarkTheme = createTheme({
  type: 'dark',
  theme: {
    colors: {
      connectButtonBackground: '#1a1b1f'
    },
    transitions: {
      default: 'all 125ms ease',
    },
  }
})

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  const [wagmiClient, setWagmiClient] = useState<any>();
  const impersonateAddress = devStore((state) => state.impersonateAddress);

  useEffect(() => {
    if (USE_FORK === false) {
      chainConfig = ((USE_TESTNETS) ? [chain.mainnet, chain.goerli] : [chain.mainnet]);
      providerConfig = [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY })];
      ({ chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig));
      const { wallets } = getDefaultWallets({ appName: APP_NAME, chains });
      connectors = connectorsForWallets([
        ...wallets,
        { groupName: 'Other', wallets: [argentWallet({ chains }), trustWallet({ chains }), ledgerWallet({ chains })] }
      ]);
      setWagmiClient(createClient({
        autoConnect: true,
        connectors,
        provider,
        webSocketProvider,
      }));
    } else {
      const configureForkedEnv = async () => {
        let tenderlyForkId: string;
        if (USE_TENDERLY) {
          tenderlyForkId = await createTenderlyFork();
          if (!tenderlyForkId) return;
          console.log({tenderlyForkId})
        }
        chainConfig = [chain.localhost];
        providerConfig = (USE_GANACHE)
          ? [jsonRpcProvider({ rpc: () => ({ http: 'http://127.0.0.1:8545' })})]
          : [jsonRpcProvider({
            rpc: () => ({ http: `https://rpc.tenderly.co/fork/${tenderlyForkId}` })
          })];
        ({ chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig));
        const signer = impersonateAddress ? provider(({chainId: 1337}))?.getSigner(impersonateAddress) : undefined;
        const mockWallet = (): Wallet => ({
          createConnector: () => ({
            connector: new MockConnector({
              chains: [chain.localhost],
              options: {
                chainId: chain.localhost.id,
                flags: {
                  failConnect: false,
                  failSwitchChain: false,
                  isAuthorized: true,
                  noSwitchChain: false,
                },
                signer,
              },
            }),
          }),
          id: 'mock',
          iconBackground: 'tomato',
          iconUrl: 'http://placekitten.com/100/100',
          name: 'Mock Wallet',
        });
        connectors = connectorsForWallets([
          { groupName: 'Fork And Impersonate', wallets: [mockWallet()] }
          ]);
        setWagmiClient(createClient({
          autoConnect: signer ? true : false,
          connectors,
          provider,
          webSocketProvider,
        }));
      }

      configureForkedEnv().catch(console.error);
    }

  }, [impersonateAddress]);

  useEffect(() => {
    const address = window.sessionStorage.getItem('ImpersonatingAddress');
    if (address) devStore.getState().setImpersonateAddress(address);
  }, []);

  if (!wagmiClient) return <></>;

  return (
    <>
      <Head>
        <title>FIAT I</title>
      </Head>
      <QueryClientProvider client={queryClient}>
        <WagmiConfig client={wagmiClient}>
          <RainbowKitProvider
            appInfo={{ appName: APP_NAME }}
            chains={chains}
            theme={{ lightMode: lightTheme(), darkMode: darkTheme(), }}
            showRecentTransactions={true}
          >
            <NextThemesProvider
              defaultTheme='system'
              attribute='class'
              value={{ light: nextLightTheme.className, dark: nextDarkTheme.className }}
            >
              <NextUIProvider>
                <Component {...pageProps} />
              </NextUIProvider>
            </NextThemesProvider>
          </RainbowKitProvider>
        </WagmiConfig>
      </QueryClientProvider>
    </>
  );
}

export default MyApp;
