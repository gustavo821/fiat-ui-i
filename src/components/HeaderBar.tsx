import React from 'react';
import { Badge, Button, Link, Text, Tooltip } from '@nextui-org/react';
import { InfoIcon } from './icons/Info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';
import { queryMeta } from '@fiatdao/sdk';
import { useBlockNumber } from 'wagmi';

interface BlockSyncStatus {
  subgraphBlockNumber: number;
  providerBlockNumber: number;
  blockDiff: number;
  status: 'success' | 'warning' | 'error' | undefined;
  message: string;
}

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);
  const [syncStatus, setSyncStatus] = React.useState<BlockSyncStatus>();
  const {data: providerBlockNumber, refetch} = useBlockNumber();

  const queryBlockNumber = React.useCallback(async () => {
    if (!props.contextData?.fiat) return;
    if (!providerBlockNumber) return;
    const fiat = props.contextData.fiat;
    const { _meta } = await fiat.query(queryMeta);
    const subgraphBlockNumber = _meta?.block.number;
    const blockDiff = providerBlockNumber - subgraphBlockNumber;
    const status = blockDiff > 5 ? 'error' : blockDiff > 0 ? 'warning' : 'success';
    const message = blockDiff === 0 ? 'Synced' : `Syncing (${blockDiff} block${(blockDiff === 1) ? '' : 's'} behind)`
    setSyncStatus({
      subgraphBlockNumber,
      providerBlockNumber,
      blockDiff,
      status,
      message,
    });
  }, [props.contextData.fiat, providerBlockNumber])

  React.useEffect(() => {
    queryBlockNumber();
    const timer = setInterval(() => {
      refetch();
      queryBlockNumber();
    }, 10000);
    return () => clearInterval(timer);
  }, [props.contextData.fiat, queryBlockNumber, refetch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        padding: '6px 20px 6px 12px',
        borderBottom: '1px solid var(--nextui-colors-border)',
        width: '100%',
        justifyContent: 'space-between'
      }}>
        <Link href={'https://fiatdao.com'} target='_blank' rel='noreferrer noopener' >
         <Text size="$xs">FIAT DAO - FIAT I</Text>
        </Link>
        <Tooltip content={syncStatus?.message} placement='left' css={{ whiteSpace: 'nowrap' }}>
          <Badge color={syncStatus?.status ?? 'default'} variant="dot" css={{ alignSelf: 'center', marginRight: '3px' }}/>
          <Text size="$xs">
            {syncStatus?.subgraphBlockNumber}
          </Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 0 }}>
        <div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
          <div style={{ display: 'flex', height: '40px' }}>
            <Button 
              auto
              icon={<InfoIcon fill='var(--rk-colors-connectButtonText)' width='20' height='20'/>}
              css={connectButtonCSS}
              onPress={()=>setShowResourcesModal(true)}
            />
            <ProxyButton
              {...props.contextData}
              createProxy={props.createProxy}
              disableActions={props.disableActions}
              transactionData={props.transactionData}
            />
            {(props.contextData?.fiatBalance) && 
              <Badge css={connectButtonCSS} >
                <Link
                  href={'https://app.balancer.fi/#/ethereum/pool/0x178e029173417b1f9c8bc16dcec6f697bc32374600000000000000000000025d'}
                  target='_blank'
                  rel='noreferrer noopener'
                  color="text"
                  >
                    {props.contextData.fiatBalance}
                </Link>
              </Badge>
            }
            <div className='connectWrapper'>
              <ConnectButton showBalance={false} />
            </div>
          </div>
          <ResourcesModal 
            open={showResourcesModal}
            onClose={() => setShowResourcesModal(false)}
          />
        </div>
      </div>
    </div>
  );
}
