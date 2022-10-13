import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Container, Text, Table } from '@nextui-org/react';

// @ts-ignore
import { FIAT } from '@fiatdao/sdk/lib/index';
// @ts-ignore
import { queryCollateralTypes, queryUserProxy, queryPositions } from '@fiatdao/sdk/lib/queries';

const Home: NextPage = () => {
  const { isConnected, connector } = useAccount();

  const [mounted, setMounted] = React.useState(false);
  const [positions, setPositions] = React.useState([]);
  const [vaults, setVaults] = React.useState([]);
  const [position, setPosition] = React.useState(null);
  const [vault, setVault] = React.useState({});


  // Reset state if network or account changes
  React.useEffect(() => {
    if (connector && !mounted) {
      connector.on('change', () => {
        setPositions([]);
        setVault({});
        setPosition(null);
      });
      setMounted(true);
    }
  }, [mounted, connector]);

  // Fetch all Vaults
  React.useEffect(() => {
    if (connector && vaults.length === 0) {
      (async function fetchVaults() {
        const signer = (await connector.getSigner());
        if (!signer || !signer.provider) return;
        const fiat = await FIAT.fromProvider(signer.provider);
        const user = await signer.getAddress();
        const { collateralTypes } = await fiat.query(queryCollateralTypes, {});
        console.log(collateralTypes);
        setVaults(collateralTypes);
      })();
    }
  }, [connector, vaults]);

  // Fetch all Positions corresponding to a user's proxy account
  React.useEffect(() => {
    if (connector && positions.length === 0) {
      (async function fetchPositions() {
        const signer = (await connector.getSigner());
        if (!signer || !signer.provider) return;
        const fiat = await FIAT.fromProvider(signer.provider);
        const user = await signer.getAddress();
        const { userProxy: { proxyAddress: proxy }} = await fiat.query(queryUserProxy, { id: user.toLowerCase() });
        const { positions } = await fiat.query(queryPositions, { where: { owner: proxy.toLowerCase() } });
        setPositions(positions);
      })();
    }
  }, [connector, positions]);

  // Fetch Vault corresponding to the selected Position
  React.useEffect(() => {
    if (connector && position != null && positions.length != 0 && Object.keys(vault).length === 0) {
      const position_ = positions.find(({ id }) => id === position);
      // @ts-ignore
      if (!position_ || !position_.vault || !position_.vault.address) return;
      (async function fetchVault() {
        console.log(position);
        const signer = (await connector.getSigner());
        if (!signer || !signer.provider) return;
        const fiat = await FIAT.fromProvider(signer.provider);
        try {
          // @ts-ignore
          setVault(await fiat.fetchVaultData(position_.vault.address.toLowerCase()));
        } catch (error) {
          setVault({ error });
        }
      })();
    }
  }, [connector, positions, position, vault]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: 12,
        }}
      >
        <ConnectButton />
      </div>

      <div>
      <Container>
          <Text h1>Vaults</Text>
          {mounted && isConnected && vaults.length != 0 && (
            <Table
              aria-label='Vaults'
              css={{
                height: 'auto',
                minWidth: '100%',
              }}
            >
              <Table.Header>
                <Table.Column>Vault</Table.Column>
                <Table.Column>Token</Table.Column>
                <Table.Column>TokenId</Table.Column>
              </Table.Header>
              <Table.Body>
                {
                  vaults.map((vault) => {
                    return (
                      <Table.Row key={(vault as { id: string }).id}>
                        <Table.Cell>{(vault as { vault: { name: string } }).vault.name}</Table.Cell>
                        <Table.Cell>{(vault as { symbol: string }).symbol}</Table.Cell>
                        <Table.Cell>{(vault as { tokenId: string }).tokenId}</Table.Cell>
                      </Table.Row>
                    );
                  })
                }
              </Table.Body>
            </Table>
          )}
        </Container>
      </div>

      <div>
        <Container>
          <Text h1>Positions</Text>
          {mounted && isConnected && positions.length != 0 && (
            <Table
              aria-label='Positions'
              css={{
                height: 'auto',
                minWidth: '100%',
              }}
              selectionMode='single'
              onSelectionChange={(selected) => {
                setPosition(Object.values(selected)[0]);
                setVault({});
              }}
            >
              <Table.Header>
                <Table.Column>Vault</Table.Column>
                <Table.Column>Token</Table.Column>
                <Table.Column>TokenId</Table.Column>
                <Table.Column>Owner</Table.Column>
                <Table.Column>Collateral</Table.Column>
                <Table.Column>Normal Debt</Table.Column>
              </Table.Header>
              <Table.Body>
                {
                  positions.map((position) => {
                    return (
                      <Table.Row key={(position as { id: string }).id}>
                        <Table.Cell>{(position as { vaultName: string }).vaultName}</Table.Cell>
                        <Table.Cell>{(position as { collateralType: { symbol: string } }).collateralType.symbol}</Table.Cell>
                        <Table.Cell>{(position as { collateralType: { tokenId: string } }).collateralType.tokenId}</Table.Cell>
                        <Table.Cell>{(position as { owner: string }).owner}</Table.Cell>
                        <Table.Cell>{ethers.utils.formatEther((position as { collateral: string }).collateral)}</Table.Cell>
                        <Table.Cell>{ethers.utils.formatEther((position as { normalDebt: string }).normalDebt)}</Table.Cell>
                      </Table.Row>
                    );
                  })
                }
              </Table.Body>
            </Table>
          )}
        </Container>
      </div>

      <div>
        <Container>
          <Text h1>Selected Position</Text>
          <Text b>{position}</Text>
          <Text b>{JSON.stringify(vault)}</Text>
        </Container>
      </div>
    </div>
  );
};

export default Home;
