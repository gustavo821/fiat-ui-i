import React from 'react';
import { Text, Spacer, Card, Button, Link } from '@nextui-org/react';
import { TransactionStatus } from '../pages';

interface ProxyCardProps {
  proxies: Array<string>,
  explorerUrl: null | string,
  fiat: any,
  setTransactionStatus: (status: TransactionStatus) => void,
  user: null | string,
}

export const ProxyCard = (props: ProxyCardProps) => {
  const createProxy = async () => {
    const { proxyRegistry } = props.fiat.getContracts();
    try {
      props.setTransactionStatus('sent')
      const response = await props.fiat.dryrun(proxyRegistry, 'deployFor', props.user);
      console.log('create proxy response: ', response);
      props.setTransactionStatus('confirmed')
    } catch (e) {
      console.error('Error creating proxy');
      props.setTransactionStatus('error');
    }
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
              <Button onPress={() => createProxy()}>
                Setup a new Proxy account
              </Button>
            </>
          )
        }
      </Card.Body>
    </Card>
  );
};
