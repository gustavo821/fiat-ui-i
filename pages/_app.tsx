import { createTheme, NextUIProvider } from '@nextui-org/react';
import {
  connectorsForWallets, darkTheme, getDefaultWallets, lightTheme, RainbowKitProvider
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { argentWallet, ledgerWallet, trustWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/global.css';

const APP_NAME = 'FIAT I UI';
const USE_TESTNETS = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';
const USE_GANACHE = process.env.NEXT_PUBLIC_GANACHE_FORK === 'true' && process.env.NODE_ENV === 'development';
const USE_TENDERLY = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true' && process.env.NODE_ENV === 'development';
const USE_FORK = USE_GANACHE || USE_TENDERLY;

let chainConfig, providerConfig, connectors, provider, webSocketProvider, chains: any[];

if (USE_FORK === false) {
  chainConfig = ((USE_TESTNETS) ? [chain.mainnet, chain.goerli] : [chain.mainnet]);
  providerConfig = [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY })];
  ({ chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig));
  const { wallets } = getDefaultWallets({ appName: APP_NAME, chains });
  connectors = connectorsForWallets([
    ...wallets,
    { groupName: 'Other', wallets: [argentWallet({ chains }), trustWallet({ chains }), ledgerWallet({ chains })] }
  ]);
} else {
  chainConfig = [chain.localhost];
  providerConfig = (USE_GANACHE)
    ? [jsonRpcProvider({ rpc: () => ({ http: 'http://127.0.0.1:8545' })})]
    : [jsonRpcProvider({
      rpc: () => ({ http: `https://rpc.tenderly.co/fork/${process.env.NEXT_PUBLIC_TENDERLY_RPC_API_KEY}` })
    })];
  ({ chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig));
  connectors = connectorsForWallets([
    { groupName: 'Fork And Impersonate', wallets: [walletConnectWallet({ chains })] }
  ]);
}

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

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

const queryClient = new QueryClient()

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FIAT I</title>
      </Head>
      <WagmiConfig client={wagmiClient}>
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </WagmiConfig>
    </>
  );
}

export default MyApp;
