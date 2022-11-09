import { Button, Card, Link, Spacer, Text } from '@nextui-org/react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { useSigner } from 'wagmi';

interface ProxyCardProps {
  createProxy: (fiat: any, user: string) => any;
  proxies: Array<string>;
  explorerUrl: null | string;
  fiat: any;
  user: null | string;
  disableActions: boolean;
}

export const ProxyCard = (props: ProxyCardProps) => {
  const { openConnectModal } = useConnectModal();
  const { data: signerData, isFetching: isFetchingSigner } = useSigner();

  return (
    <SkeletonTheme baseColor='#202020' highlightColor='#444'>
      <Card
        css={{
          mw: '450px',
        }}
      >
        <Card.Body>
          {!signerData && isFetchingSigner ? (
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
                    onPress={() => {
                      // If no address available, prompt user to connect when they click the button
                      if (!props.user) {
                        if (openConnectModal) {
                          // prompt to connect
                          openConnectModal();
                        }
                      } else {
                        props.createProxy(props.fiat, props.user)
                      }
                    }}
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
