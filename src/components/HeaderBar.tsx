import React from 'react';
import Image from 'next/image';
import { Badge, Button, Text, Tooltip } from '@nextui-org/react';
import { InfoIcon } from './Icons/info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';
import { queryMeta } from '@fiatdao/sdk';
import { useBlockNumber } from 'wagmi';
import { useTheme } from '@nextui-org/react';

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
  const { theme } = useTheme();
  const darkTheme = theme?.colors.background.value != '#ffffff';

  const queryBlockNumber = React.useCallback(async () => {
    if (!props.contextData?.fiat) return;
    if (!providerBlockNumber) return;
    const fiat = props.contextData.fiat;
    const { _meta } = await fiat.query(queryMeta);
    const subgraphBlockNumber = _meta?.block.number;
    const blockDiff = providerBlockNumber - subgraphBlockNumber;
    const status = blockDiff > 5 ? 'error' : blockDiff > 0 ? 'warning' : 'success';
    const message = blockDiff === 0 ? 'Blocks are synced' : `Syncing (subgraph ${blockDiff} blocks behind`
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
    }, 5000);
    return () => clearInterval(timer);
  }, [props.contextData.fiat, queryBlockNumber, refetch])

  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <div style={{display: 'flex', padding: '6px 20px 6px 12px', borderBottom: '1px solid var(--nextui-colors-border)', width: '100%', justifyContent: 'end'}}>
        <Tooltip content={syncStatus?.message} placement='left' css={{whiteSpace: 'nowrap'}}>
          <Badge color={syncStatus?.status ?? 'default'} variant="dot" css={{alignSelf: 'center'}}/>
          <Text size="$xs">
            {syncStatus?.subgraphBlockNumber}
          </Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 0 }}>
        { darkTheme ? 
          (<div style={{ marginLeft: 12 }} >
            <Image alt="" src="/logo-dark.png" layout="fixed" objectFit={'contain'} width={140} height={69} />
          </div>)
          :
          (<div style={{ margin: 12 }} >
            <Image alt="" src="/logo-white.png" layout="fixed" objectFit={'contain'} width={140} height={45} />
          </div>)
        }
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
          <div style={{ display: 'flex', height: '40px' }}>
            <Button 
              auto
              icon={<InfoIcon fillColor='var(--rk-colors-connectButtonText)'/>}
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
              <Badge 
                css={connectButtonCSS}
              >
                {props.contextData.fiatBalance}
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
