import { createTheme, NextUIProvider } from '@nextui-org/react';
import {
  connectorsForWallets,
  darkTheme,
  getDefaultWallets,
  lightTheme,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { argentWallet, ledgerWallet, trustWallet } from '@rainbow-me/rainbowkit/wallets';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/global.css';

const useGanache = process.env.NEXT_PUBLIC_GANACHE_LOCAL === 'true' && process.env.NODE_ENV === 'development';
const useTenderly = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true' && process.env.NODE_ENV === 'development';
const useTestNets = process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

const chainConfig = useGanache ? [chain.localhost] : (useTestNets ? [chain.mainnet, chain.goerli] : [chain.mainnet]);

const providerConfig = useGanache ? 
  [jsonRpcProvider({
    rpc: () => ({
      http: 'http://127.0.0.1:8545',
    }),
  })] : useTenderly ? 
  [jsonRpcProvider({
    rpc: () => ({
      http: 'https://rpc.tenderly.co/fork/82e30c17-2931-498c-8b2e-cf38052dd6d9',
    }),
  })] : 
  [alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY })];

const { chains, provider, webSocketProvider } = configureChains(chainConfig, providerConfig);

const { wallets } = getDefaultWallets({
  appName: 'FIAT I UI',
  chains,
});

const demoAppInfo = {
  appName: 'FIAT I UI',
};

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: 'Other',
    wallets: [
      argentWallet({ chains }),
      trustWallet({ chains }),
      ledgerWallet({ chains }),
    ],
  },
]);

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
            appInfo={demoAppInfo}
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
