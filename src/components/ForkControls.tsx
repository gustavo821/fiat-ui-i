import React from 'react';
import { Button, Dropdown, Input, Modal, Text } from '@nextui-org/react';
import useStore from '../state/stores/globalStore';
import {USE_FORK, USE_GANACHE} from './HeaderBar';
import { useProvider } from 'wagmi';
import { hexValue } from 'ethers/lib/utils';
import WalletConnect from '@walletconnect/client';
import { BigNumber } from 'ethers';

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
  const [showImpersonate, setShowImpersonate] = React.useState<boolean>(false);
  const [isImpersonating, setIsImpersonating] = React.useState<boolean>(false);
  const [impersonateWalletAddress, setImpersonateWalletAddress] = React.useState<string>('');
  const [walletConnectURI, setWalletConnectURI] = React.useState<string>('');
  const [wcConnector, setWcConnector] = React.useState<WalletConnect>();

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

  const doImpersonate = async (useCachedSession: boolean) => {
    const cachedSession = window.sessionStorage.getItem('WalletConnectSession') ?? '';
    if (useCachedSession && !cachedSession) {
      console.error('No cached session in session storage')
      return;
    }
    // Create connection from cached session or new uri
    const wc = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org', 
      uri: useCachedSession ? undefined: walletConnectURI,
      session: useCachedSession ? JSON.parse(cachedSession) : undefined
    });
    // Subscribe to 'connect' events
    wc.on('connect', (error) => {
      console.log('Connect');
      if (error) throw error;
      console.log('Impersonating address: ', impersonateWalletAddress);
      setIsImpersonating(true);
      window.sessionStorage.setItem('WalletConnectSession', JSON.stringify(wc.session))
    });
    // Create new session if it wasn't cached
    if (!wc.connected) {
      console.log('Create session')
      await wc.createSession();
    } else {
      console.log('Session resumed');
      setIsImpersonating(true);
    }
    // Subscribe to session requests
    wc.on('session_request', (error) => {
      console.log('Session request');
      if (error) throw error;
      wc.approveSession({ chainId: 1337, accounts: [impersonateWalletAddress] });
    });
    // Subscribe to call requests
    wc.on('call_request', async (error, payload) => {
      console.log('Call request');
      if (error) throw error;
      try {
        const signer = provider.getSigner(impersonateWalletAddress);
        const { to, from, data, gas} = payload.params[0];
        const gasLimit = BigNumber.from(gas).mul(2);
        const result = await signer.sendTransaction({ to, from, data, gasLimit })
        console.log({ result })
        wc.approveRequest({ id: payload.id, result: result.hash });
      } catch (error) {
        console.log({error})
      }
    });

    // Subscribe to 'disconnect' events
    wc.on('disconnect', (error) => {
      setIsImpersonating(false);
    });

    if (!useCachedSession) {
      window.sessionStorage.setItem('ImpersonatingAddress', impersonateWalletAddress);
    }
    setWcConnector(wc);
  }

  const disconnectImpersonate = () => {
    setIsImpersonating(false);
    if (!wcConnector || !wcConnector.connected) return;
    wcConnector.killSession();
    window.sessionStorage.removeItem('WalletConnectSession');
  }

  React.useEffect(() => {
    const address = window.sessionStorage.getItem('ImpersonatingAddress');
    if (address) setImpersonateWalletAddress(address);
  }, []);

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
      <Button auto size='xs' css={{ marginLeft: '3px' }} onPress={()=>setShowImpersonate(true)}>{isImpersonating ? 'Impersonating' : 'Impersonate'}</Button>
      <Modal
        closeButton
        aria-labelledby="modal-title"
        open={showImpersonate}
        onClose={()=>setShowImpersonate(false)}
      >
        <Modal.Header>
          <Text id="modal-title" size={18}>
            {isImpersonating ? 'Disconnect Wallet Connect' : 'Impersonate an address'}
          </Text>
        </Modal.Header>
        {!isImpersonating && <Modal.Body>
          <Input
            aria-label='Impersonate Wallet Address'
            clearable
            bordered
            fullWidth
            color="primary"
            size="lg"
            placeholder="Wallet Address"
            value={impersonateWalletAddress}
            onChange={(e)=>setImpersonateWalletAddress(e.target.value)}
          />
          <Input
          aria-label='Impersonate Wallet Connect URI'
            clearable
            bordered
            fullWidth
            color="primary"
            size="lg"
            placeholder="Walletconnect URI"
            onChange={(e)=>setWalletConnectURI(e.target.value)}
          />
        </Modal.Body>}
        {!isImpersonating && <Modal.Footer>
          <Button auto onPress={()=>doImpersonate(false)}>
            Connect
          </Button>
          <Button auto onPress={()=>doImpersonate(true)}>
            Connect Cached Session
          </Button>
        </Modal.Footer>}
        {isImpersonating && <Modal.Footer>
          <Button auto onPress={()=>disconnectImpersonate()}>
            Disconnect
          </Button>
        </Modal.Footer>}
      </Modal>
    </>
  );
}
