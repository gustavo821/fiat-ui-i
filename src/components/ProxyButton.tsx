import { Badge, Button, Link, Loading } from '@nextui-org/react';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { chain as chains, useNetwork } from 'wagmi';
import { useUserData } from '../state/queries/useUserData';

interface ProxyCardProps {
  explorerUrl: null | string;
  fiat: any;
  user: null | string;
  disableActions: boolean;
  transactionData: any;
  createProxy: (fiat: any, user: string) => any;
}

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

export const ProxyButton = (props: ProxyCardProps) => {
  const [error, setError] = useState('');
  const { chain } = useNetwork();
  const { data: userData } = useUserData(props.fiat, chain?.id ?? chains.mainnet.id, props.user ?? '');
  const { proxies } = userData as any;

  if (props.user === null || !props.fiat || !proxies) {
    return <Skeleton count={2} />
  }

  if (proxies.length > 0) {
    return (
      <Badge
        css={connectButtonCSS}      
      >
        <Link
          target='_blank'
          href={`${props.explorerUrl}/address/${proxies[0]}`}
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
        if (props.user === null) {
          console.warn('ProxyButton requires a user');
        } else {
          try {
            setError('');
            await props.createProxy(props.fiat, props.user);
          } catch (e: any) {
            setError(e.message);
          }
        }
      }}
      disabled={props.disableActions}
      style={{marginRight: '10px'}} 
      icon={
        [
          'createProxy',
        ].includes(props.transactionData.action || '') && props.disableActions ? (
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
