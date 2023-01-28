import { Badge, Button, Link, Loading } from '@nextui-org/react';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { chain as chains, useNetwork } from 'wagmi';
import { useUserData } from '../state/queries/useUserData';
import useStore from '../state/stores/globalStore';
import { sendTransaction } from '../actions';
import { useQueryClient } from '@tanstack/react-query';
import { userDataKey } from '../state/queries/useUserData';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';

export const connectButtonCSS = {
  fontFamily: 'var(--rk-fonts-body)',
  fontWeight: 700,
  fontSize: '100%',
  borderRadius: '12px',
  backgroundColor: '$connectButtonBackground',
  color: '$connectButtonColor',
  boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
  '&:hover': {
    transform: 'scale(1.03)'
  },
  border: 'none',
  marginRight: '10px',
}

export const ProxyButton = () => {
  const [error, setError] = useState('');
  const { chain } = useNetwork();
  const addRecentTransaction = useAddRecentTransaction();
  const queryClient = useQueryClient();

  const fiat = useStore((state) => state.fiat);
  const user = useStore((state) => state.user);
  const explorerUrl = useStore((state) => state.explorerUrl);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state) => state.transactionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, user ?? '');
  const { proxies } = userData as any;

  const createProxy = async (fiat: any, user: string) => {
    const response = await sendTransaction(
      fiat, false, '', 'createProxy', fiat.getContracts().proxyRegistry, 'deployFor', user
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create Proxy account' });
    // Refetch User data query to get proxy
    queryClient.invalidateQueries(userDataKey.all);
  }

  if (user === null || !fiat || !proxies) {
    return <Skeleton count={2} />
  }

  if (proxies.length > 0) {
    return (
      <Badge
        css={connectButtonCSS}      
      >
        <Link
          target='_blank'
          href={`${explorerUrl}/address/${proxies[0]}`}
          isExternal={true}
          css={{
            color: '$connectButtonColor',
          }}
        >
          Proxy: {`${proxies[0].substring(0,4)}...${proxies[0].slice(-4)}`}&nbsp;
        </Link>
      </Badge>

    )
  }

  return (
    <Button
      onPress={async () => {
        if (user === null) {
          console.warn('ProxyButton requires a user');
        } else {
          try {
            setError('');
            await createProxy(fiat, user);
          } catch (e: any) {
            setError(e.message);
          }
        }
      }}
      disabled={disableActions}
      style={{marginRight: '10px'}} 
      icon={
        [
          'createProxy',
        ].includes(transactionData.action || '') && disableActions ? (
          <Loading size='xs' />
        ) : null
      }
      css={{
        fontFamily: 'var(--rk-fonts-body)',
        fontWeight: 700,
        fontSize: '100%',
        borderRadius: '12px',
        backgroundColor: '$connectButtonBackground',
        color: '$connectButtonColor',
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          transform: 'scale(1.03)'
        },
        width: 'var(--nextui-space-60)',
      }}
    >
      {error === '' ? 'Create Proxy Account'
      : (
        'Error, please refresh the page'
      )}
    </Button>
  );
};
