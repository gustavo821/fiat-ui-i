import { Button, Card, Link, Loading, Spacer, Text } from '@nextui-org/react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useState } from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import { useSigner } from 'wagmi';
import { ErrorTooltip } from './ErrorTooltip';

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
  const [error, setError] = useState('');

  return (
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
                  onPress={async () => {
                    // If no address available, prompt user to connect when they click the button
                    if (!props.user) {
                      if (openConnectModal) {
                        // prompt to connect
                        openConnectModal();
                      }
                    } else {
                      try {
                        setError('');
                        await props.createProxy(props.fiat, props.user)
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }
                  }}
                  disabled={props.disableActions}
                >
                  {props.disableActions ? <Loading /> : 'Setup a new Proxy account'}
                </Button>
                { error === ''
                  ? null
                  :(
                    <>
                      <Spacer y={0.5} />
                      <ErrorTooltip error={error} />
                    </>
                  )
                }
              </>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
};
