import { Button, Card, Link, Spacer, Text } from '@nextui-org/react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';

interface ProxyCardProps {
  createProxy: (fiat: any, user: string) => any;
  proxies: Array<string>;
  explorerUrl: null | string;
  fiat: any;
  user: null | string;
  disableActions: boolean;
}

export const ProxyCard = (props: ProxyCardProps) => {
  return (
    <SkeletonTheme baseColor='#202020' highlightColor='#444'>
      <Card
        css={{
          mw: '450px',
        }}
      >
        <Card.Body>
          {props.user === null || props.fiat === null ? (
            <Skeleton count={2} />
          ) : (
            <>
              <Text b size={18}>
                Proxy
              </Text>
              {props.proxies.length > 0 ? (
                <Link
                  target='_blank'
                  href={`${props.explorerUrl}/address/${props.proxies[0]}`}
                  isExternal={true}
                >
                  {props.proxies[0]}
                </Link>
              ) : (
                <>
                  <Spacer y={1} />
                  <Button
                    onPress={() => props.createProxy(props.fiat, props.user!)}
                    disabled={props.disableActions}
                  >
                    Setup a new Proxy account
                  </Button>
                </>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </SkeletonTheme>
  );
};
