import React from 'react';
import { Text, Spacer, Card, Button, Link } from '@nextui-org/react';
import { TransactionStatus } from '../pages';
import { useMutation } from 'wagmi';
import toast from 'react-hot-toast';

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

  // TODO: toasts are just an example of what react-query can do. we can clean this up significantly by having the sdk generate typechain types and implementing react-query-typechain
  // https://github.com/element-fi/frontend-monorepo/tree/fa382bcbff2b491444c84cbcda16c206063ea014/packages/react-query-typechain
  const { mutate } = useMutation(createProxy, {
    onMutate: () => {
      toast("Transaction sent");
    },
    onSuccess: () => {
      toast.success("Transaction successful");
    },
    onError: (e) => {
      toast.error(`Transaction reverted. Error: ${e}`);
    },
  });

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
              <Button onPress={() => mutate()}>
                Setup a new Proxy account
              </Button>
            </>
          )
        }
      </Card.Body>
    </Card>
  );
};
