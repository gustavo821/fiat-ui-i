import { Badge, Button, Link } from '@nextui-org/react';
import Skeleton from 'react-loading-skeleton';

interface ProxyCardProps {
  createProxy: (fiat: any, user: string) => any;
  proxies: Array<string>;
  explorerUrl: null | string;
  fiat: any;
  user: null | string;
  disableActions: boolean;
}

export const ProxyButton = (props: ProxyCardProps) => {
  if (!props.user|| !props.fiat) {
    return <Skeleton count={2} />
  }
  if (props.proxies.length > 0) {
    
    return (
      <Badge
        style={{marginRight: '10px'}} 
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
          }
        }}      
      >
        <Link
          target='_blank'
          href={`${props.explorerUrl}/address/${props.proxies[0]}`}
          isExternal={true}
          css={{
            color: '$connectButtonColor',
          }}
        >
          {`${props.proxies[0].substring(0,4)}...${props.proxies[0].slice(-4)}`}&nbsp;
        </Link>
      </Badge>

    )
  }
  return (
    <Button
      onPress={() => props.createProxy(props.fiat, props.user!)}
      disabled={props.disableActions}
      style={{marginRight: '10px'}} 
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
        }
      }}
    >
      Setup a new Proxy account
    </Button>
  );
};
