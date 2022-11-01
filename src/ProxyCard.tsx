import React from 'react';
import { Text, Spacer, Card, Button, Link } from '@nextui-org/react';

interface ProxyCardProps {
  proxies: Array<string>,
  explorerUrl: null | string,
  user: null | string
  onSendTransaction: (action: string) => void,
}

export const ProxyCard = (props: ProxyCardProps) => {
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
              <Button onPress={() => props.onSendTransaction('setupProxy')}>
                Setup a new Proxy account
              </Button>
            </>
          )
        }
      </Card.Body>
    </Card>
  );
};
