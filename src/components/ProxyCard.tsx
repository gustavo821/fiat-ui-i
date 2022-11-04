import React from 'react';
import { Text, Spacer, Card, Button, Link, Loading } from '@nextui-org/react';
import { TransactionStatus } from '../../pages';

interface ProxyCardProps {
  createProxy: (fiat: any, user: string) => any,
  proxies: Array<string>,
  explorerUrl: null | string,
  fiat: any,
  user: null | string,
  disableActions: boolean
}

export const ProxyCard = (props: ProxyCardProps) => {
  if (props.user === null || props.fiat === null) {
    // TODO
    // return <Loading/>;
    return null;
  }

  return (
    <Card css={{ mw: '450px' }}>
      <Card.Body>
        <Text b size={18}>Proxy</Text>
        {(props.proxies.length > 0)
          ? (
            <Link
              target='_blank'
              href={`${props.explorerUrl}/address/${props.proxies[0]}`}
              isExternal={true}
            >
              {props.proxies[0]}
            </Link>)
          : (
            <>
              <Spacer y={1} />
              <Button onPress={() => props.createProxy(props.fiat, props.user!)} disabled={props.disableActions}>
                Setup a new Proxy account
              </Button>
            </>
          )
        }
      </Card.Body>
    </Card>
  );
};
