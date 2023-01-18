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

const SESSION_STORAGE_KEY = 'fiat-ui-snapshotIds';

const SECONDS_PER_DAY = 60 * 60 * 24;
const SECONDS_PER_WEEK = SECONDS_PER_DAY * 7;
const SECONDS_PER_MONTH = SECONDS_PER_DAY * 31;
const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

const fastForwardOptions = [{
  label: 'Forward By 1D',
  value: SECONDS_PER_DAY
}, {
  label: 'Forward By 1W',
  value: SECONDS_PER_WEEK
}, {
  label: 'Forward By 1M',
  value: SECONDS_PER_MONTH
}, {
  label: 'Forward By 1Y',
  value: SECONDS_PER_YEAR
}];

export const USE_FORK = (process.env.NEXT_PUBLIC_GANACHE_LOCAL === 'true' || process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true') && process.env.NODE_ENV === 'development';

interface SnapshotId {
  time: number;
  id: string;
}

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);
  const [syncStatus, setSyncStatus] = React.useState<BlockSyncStatus>();
  const [snapshotIds, setSnapshotIds] = React.useState<SnapshotId[]>([]);
  const {data: providerBlockNumber, refetch} = useBlockNumber();
  const provider = useProvider() as any;

  const fiat = useStore((state) => state.fiat);
  const getGanacheTime = useStore((state) => state.getGanacheTime);
  const ganacheTime = useStore((state) => state.ganacheTime);

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: fiatBalance } = useFiatBalance(fiat, chain?.id ?? chains.mainnet.id, address ?? '');

  const handleFastForward = async (time: number) => {
    await provider.send('evm_increaseTime', [time])
    await provider.send('evm_mine', [{blocks: 1}]);
    await getGanacheTime();
    handleSnapshot();
  }

  const handleSnapshot = async () => {
    const result = await provider.send('evm_snapshot')
    const newSnapshotIds = [...snapshotIds, {time: useStore.getState().ganacheTime.getTime(), id: result}];
    setSnapshotIds(newSnapshotIds);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSnapshotIds));
  }

  const handleRevert = async (snapshotId: string) => {
    if (!snapshotId) return;
    await provider.send('evm_revert', [snapshotId])
    getGanacheTime();
    const newSnapshotIds = snapshotIds.filter((item) => parseInt(item.id, 16) < parseInt(snapshotId, 16));
    setSnapshotIds(newSnapshotIds);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSnapshotIds));
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
    if (!USE_FORK) return;
    const resultString = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!resultString) return;
    setSnapshotIds(JSON.parse(resultString));
  }, [])

  React.useEffect(() => {
    queryBlockNumber();
    if (USE_FORK) getGanacheTime();
    const timer = setInterval(() => {
      refetch();
      queryBlockNumber();
    }, 10000);
    return () => clearInterval(timer);
  }, [fiat, queryBlockNumber, refetch, getGanacheTime])

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
              <Dropdown closeOnSelect={false}>
                <Dropdown.Button size='xs' css={{ marginLeft: '3px' }}>{ganacheTime?.toLocaleString().split(',')[0]}</Dropdown.Button>
                <Dropdown.Menu disabledKeys={['input']} aria-label="Fast Forward" onAction={(e) => handleFastForward(parseInt(e as string))}>
                  {fastForwardOptions.map((item) => (<Dropdown.Item key={item.value}>{item.label}</Dropdown.Item>))}
                </Dropdown.Menu>
              </Dropdown> 
              <Dropdown closeOnSelect={false}>
                <Dropdown.Button size='xs' css={{ marginLeft: '3px' }}>Snapshots</Dropdown.Button>
                <Dropdown.Menu disabledKeys={['input']} aria-label="Snapshots" onAction={(e) => handleRevert(e as string)}>
                  { snapshotIds.map((item) => (<Dropdown.Item key={item.id}>{`Revert to ${new Date(item.time).toLocaleDateString()}`}</Dropdown.Item>)) }
                </Dropdown.Menu>
              </Dropdown>
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
