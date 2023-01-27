import React from 'react';
import { Dropdown} from '@nextui-org/react';
import useStore from '../state/stores/globalStore';
import {USE_FORK, USE_GANACHE} from './HeaderBar';
import { useProvider } from 'wagmi';
import { hexValue } from 'ethers/lib/utils';

const SESSION_STORAGE_KEY = 'fiat-ui-snapshotIds';

const SECONDS_PER_DAY = 60 * 60 * 24;
const SECONDS_PER_WEEK = SECONDS_PER_DAY * 7;
const SECONDS_PER_MONTH = SECONDS_PER_DAY * 31;
const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

const fastForwardOptions = [{
  label: 'Forward By 1 Day',
  value: SECONDS_PER_DAY
}, {
  label: 'Forward By 1 Week',
  value: SECONDS_PER_WEEK
}, {
  label: 'Forward By 1 Month',
  value: SECONDS_PER_MONTH
}, {
  label: 'Forward By 1 Year',
  value: SECONDS_PER_YEAR
}];

interface SnapshotId {
  time: number;
  id: string;
}

export const ForkControls = () => {

  const [snapshotIds, setSnapshotIds] = React.useState<SnapshotId[]>([]);
  const provider = useProvider() as any;
  const ganacheTime = useStore((state) => state.ganacheTime);
  const getGanacheTime = useStore((state) => state.getGanacheTime);

  const handleFastForward = async (time: number) => {
    if (!USE_FORK) return;
    await handleSnapshot();
    if (USE_GANACHE) {
      await provider.send('evm_increaseTime', [time]);
      await provider.send('evm_mine', [{blocks: 1}]);
    } else {
      const increaseTimeParams = [hexValue(time)];
      await provider.send('evm_increaseTime', increaseTimeParams)
      const increaseBlocksParams = [hexValue(1)];
      await provider.send('evm_increaseBlocks', increaseBlocksParams);
    }
    await getGanacheTime();
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
    const index = snapshotIds.findIndex((item) => snapshotId === item.id);
    const newSnapshotIds = index > -1 ? snapshotIds.slice(0, index) : [];
    setSnapshotIds(newSnapshotIds);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSnapshotIds));
  }

  React.useEffect(() => {
    if (!USE_FORK) return;
    getGanacheTime();
    const resultString = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!resultString) return;
    setSnapshotIds(JSON.parse(resultString));
  }, [getGanacheTime]);

  if (!USE_FORK) return null;

  return (    
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
  );
}