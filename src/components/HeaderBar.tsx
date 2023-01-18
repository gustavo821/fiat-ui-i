import React from 'react';
import { Badge, Button, Dropdown, Input, Link, Text, Tooltip } from '@nextui-org/react';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';
import { queryMeta } from '@fiatdao/sdk';
import { chain as chains, useAccount, useBlockNumber, useNetwork, useProvider } from 'wagmi';
import { useFiatBalance } from '../state/queries/useFiatBalance';
import useStore from '../state/stores/globalStore';

interface BlockSyncStatus {
  subgraphBlockNumber: number;
  providerBlockNumber: number;
  blockDiff: number;
  status: 'success' | 'warning' | 'error' | undefined;
  message: string;
}

const SECONDS_PER_MONTH = 60 * 60 * 24 * 31;

export const USE_FORK = (process.env.NEXT_PUBLIC_GANACHE_LOCAL === 'true' || process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true') && process.env.NODE_ENV === 'development';

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);
  const [manualSnapshotId, setManualSnapshotId] = React.useState<string>();
  const [syncStatus, setSyncStatus] = React.useState<BlockSyncStatus>();
  const [snapshotIds, setSnapshotIds] = React.useState<string[]>([]);
  const {data: providerBlockNumber, refetch} = useBlockNumber();
  const provider = useProvider() as any;

  const fiat = useStore((state) => state.fiat);
  const getGanacheTime = useStore((state) => state.getGanacheTime);
  const ganacheTime = useStore((state) => state.ganacheTime);

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: fiatBalance } = useFiatBalance(fiat, chain?.id ?? chains.mainnet.id, address ?? '');

  const handleFastForward = async () => {
    await provider.send('evm_increaseTime', [SECONDS_PER_MONTH])
    await provider.send('evm_mine', [{blocks: 1}]);
    getGanacheTime();
  }

  const handleSnapshot = async () => {
    const result = await provider.send('evm_snapshot')
    setSnapshotIds([...snapshotIds, result]);
  }

  const handleRevert = async (snapshotId: string) => {
    if (!snapshotId) return;
    await provider.send('evm_revert', [snapshotId])
    getGanacheTime();
  }

  const handleSnapshotInput = (e: any) => {
    if (e?.target.value === null) return;
    setManualSnapshotId(e?.target.value);
  }

  const queryBlockNumber = React.useCallback(async () => {
    if (!fiat) return;
    if (!providerBlockNumber) return;
    if (USE_FORK) {
      const subgraphBlockNumber = providerBlockNumber;
      const blockDiff = 0;
      const status = 'success';
      const message = 'Ganache Fork'
      setSyncStatus({
        subgraphBlockNumber,
        providerBlockNumber,
        blockDiff,
        status,
        message,
      });
    } else {
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
    }
  }, [fiat, providerBlockNumber])

  React.useEffect(() => {
    queryBlockNumber();
    const timer = setInterval(() => {
      refetch();
      queryBlockNumber();
    }, 10000);
    return () => clearInterval(timer);
  }, [fiat, queryBlockNumber, refetch, ganacheTime])

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
         <Text size='$xs'>FIAT DAO - FIAT I</Text>
        </Link>
        <Tooltip content={syncStatus?.message} placement='left' css={{ whiteSpace: 'nowrap' }}>
          <Badge color={syncStatus?.status ?? 'default'} variant='dot' css={{ alignSelf: 'center', marginRight: '3px' }}/>
          <Text size='$xs'css={{ alignSelf: 'center'}}>
            {syncStatus?.subgraphBlockNumber}
          </Text>
          { USE_FORK && (
            <>
              <Button onPress={handleFastForward} size='xs' css={{ marginLeft: '5px' }}>Forward</Button>
              <Dropdown closeOnSelect={false}>
                <Dropdown.Button size='xs' css={{ marginLeft: '3px' }}>Snapshots</Dropdown.Button>
                <Dropdown.Menu disabledKeys={['input']} aria-label="Snapshots" onAction={(e) => e === 'take-snapshot' ? handleSnapshot() : handleRevert(e as string)}>
                  {[<Dropdown.Item key='take-snapshot'>Take Snapshot</Dropdown.Item>, 
                  ...snapshotIds.map((item) => (<Dropdown.Item key={item}>{item}</Dropdown.Item>))]}
                </Dropdown.Menu>
              </Dropdown> 
              <Input 
                aria-label="Snapshot Input" 
                key="use-snapshot-input" 
                placeholder='0x1' 
                type='text' 
                size='xs' 
                css={{ marginLeft: '3px' }}
                width='150px'
                onChange={handleSnapshotInput}
                contentRight={<Button onPress={() => handleRevert(manualSnapshotId ?? '')} size='xs'>Revert</Button>}
                contentRightStyling={false}
              />
            </>
          )}
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 0 }}>
        <div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
          <div style={{ display: 'flex', height: '40px' }}>
            <Button 
              auto
              icon={'...'}
              css={{...connectButtonCSS, maxWidth: '40px'}}
              onPress={()=>setShowResourcesModal(true)}
            />
            <ProxyButton
              createProxy={props.createProxy}
            />
            {(fiatBalance) && 
              <Badge css={connectButtonCSS} >
                <Link
                  href={'https://app.balancer.fi/#/ethereum/pool/0x178e029173417b1f9c8bc16dcec6f697bc32374600000000000000000000025d'}
                  target='_blank'
                  rel='noreferrer noopener'
                  color='text'
                  >
                    {fiatBalance}
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
