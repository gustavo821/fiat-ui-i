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
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { createTenderlyFork, useEnabledControls, useImpersonatingAddress } from 'react-tenderly-fork-controls';

interface wagmiClientConfig {
  useTenderly?: boolean;
  useGanache?: boolean;
  useTestnets?: boolean;
  impersonateAddress?: string;
  appName?: string;
  alchemyAPIKey?: string;
  tenderlyAccessKey?: string;
  tenderlyUser?: string;
  tenderlyProject?: string;
}

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const APP_NAME = 'FIAT I UI';
const USE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';
const USE_GANACHE = process.env.NEXT_PUBLIC_GANACHE_FORK === 'true' && process.env.NODE_ENV === 'development';
const USE_TENDERLY = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true' && process.env.NODE_ENV === 'development';

let chainConfig: Chain[], providerConfig, connectors, provider: any, webSocketProvider: any, chains: any[];

const TENDERLY_USER = process.env.NEXT_PUBLIC_TENDERLY_USER;
const TENDERLY_PROJECT = process.env.NEXT_PUBLIC_TENDERLY_PROJECT;
const TENDERLY_FORK_API = `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`;
const TENDERLY_ACCESS_KEY = process.env.NEXT_PUBLIC_TENDERLY_ACCESS_KEY;

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

const configureLiveNetwork = (config: wagmiClientConfig) => {
  const chainConfig = ((config.useTestnets) ? [chain.mainnet, chain.goerli] : [chain.mainnet]);
  const { chains, provider, webSocketProvider } = configureChains(
    chainConfig, 
    [alchemyProvider({ apiKey: config.alchemyAPIKey ?? "" })]
  );
  const { wallets } = getDefaultWallets({ appName: config.appName ?? "My Dapp", chains });
  const connectors = connectorsForWallets([
    ...wallets,
    { 
      groupName: 'Other',
      wallets: [argentWallet({ chains }), 
      trustWallet({ chains }), 
      ledgerWallet({ chains })] 
    }
  ]);
  return {
    client: createClient({
      autoConnect: false,
      connectors,
      provider,
      webSocketProvider,
    }),
    chains
  }
}

const configureTenderly = async (config: wagmiClientConfig) => {
  if (!config.tenderlyAccessKey || !config.tenderlyProject || !config.tenderlyUser) {
    console.error('Requires tenderly api access configuration');
    return null;
  }
  const tenderlyForkId = await createTenderlyFork(config.tenderlyAccessKey, config.tenderlyUser, config.tenderlyProject);
  if (!tenderlyForkId) return;
  const providerConfig = [jsonRpcProvider({
    rpc: () => ({ http: `https://rpc.tenderly.co/fork/${tenderlyForkId}` })
  })];
  return providerConfig;
}

const configureGanache = () => {
  return [jsonRpcProvider({ rpc: () => ({ http: 'http://127.0.0.1:8545' })})]
}

const configureForkedEnv = async (config: wagmiClientConfig) => {
  const chainConfig = [chain.localhost] as Chain[];
  const providerConfig = config.useTenderly ? await configureTenderly(config) : configureGanache();
  if (!providerConfig) return;
  const { chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig);
  const providerInstance = provider(({chainId: 1337})) as any;
  const signer = config.impersonateAddress ? providerInstance?.getSigner(config.impersonateAddress) : undefined;
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
  const connectors = connectorsForWallets([
    { groupName: 'Fork And Impersonate', wallets: [mockWallet()] }
    ]);
  return  {
    client: createClient({
      autoConnect: signer ? true : false,
      connectors,
      provider,
      webSocketProvider,
    }),
    chains,
  }
}

export const useWagmiClient = (config: wagmiClientConfig) => {
  const [wagmiClient, setWagmiClient] = React.useState<any>({client: null, chains:[]});

  React.useEffect(() => {
    if (!config.useTenderly && !config.useGanache && config.alchemyAPIKey) {
      const {client, chains} = configureLiveNetwork(config)
      setWagmiClient({client, chains});
    } else {
      configureForkedEnv(config)
        .then(setWagmiClient)
        .catch(console.error);
    }
  }, [config]);

  return wagmiClient;
}

function MyApp({ Component, pageProps }: AppProps) {

  const impersonatingAddress = useImpersonatingAddress();
  const enabledControls = useEnabledControls();

  const config = React.useMemo(() => ({
    useTenderly: false,
    useGanache: enabledControls,
    useTestnets: false,
    impersonateAddress: impersonatingAddress,
    appName: APP_NAME,
    alchemyAPIKey: ALCHEMY_API_KEY,
    tenderlyAccessKey: TENDERLY_ACCESS_KEY,
    tenderlyUser: TENDERLY_USER,
    tenderlyProject: TENDERLY_PROJECT
  }), [impersonatingAddress, enabledControls]);

  const {client: wagmiClient, chains} = useWagmiClient(config);

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
