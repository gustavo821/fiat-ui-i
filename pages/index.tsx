import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Container, Text, Table, Spacer, Button, Modal, Input } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';

// @ts-ignore
import { FIAT } from '@fiatdao/sdk/lib/index';

import { styled } from '@nextui-org/react';

const StyledBadge = styled('span', {
  display: 'inline-block',
  textTransform: 'uppercase',
  padding: '$2 $3',
  margin: '0 2px',
  fontSize: '10px',
  fontWeight: '$bold',
  borderRadius: '14px',
  letterSpacing: '0.6px',
  lineHeight: 1,
  boxShadow: '1px 2px 5px 0px rgb(0 0 0 / 5%)',
  alignItems: 'center',
  alignSelf: 'center',
  color: '$white',
  variants: {
    type: {
      green: {
        bg: '$successLight',
        color: '$successLightContrast'
      },
      red: {
        bg: '$errorLight',
        color: '$errorLightContrast'
      },
      orange: {
        bg: '$warningLight',
        color: '$warningLightContrast'
      }
    }
  },
  defaultVariants: {
    type: 'active'
  }
});

const Home: NextPage = () => {
  const { isConnected, connector } = useAccount();

  const [mounted, setMounted] = React.useState(false);

  const [positions, setPositions] = React.useState([]);
  const [selPosition, setSelPosition] = React.useState(null);
  const [position, setPosition] = React.useState({});
  const [vaults, setVaults] = React.useState([]);
  const [selVault, setSelVault] = React.useState(null);
  const [vault, setVault] = React.useState({});
  const [underlier, setUnderlier] = React.useState(null);

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || mounted) return;
    connector.on('change', () => {
      setVaults([]);
      setVault({});
      setSelVault(null);
      setPositions([]);
      setPosition({});
      setSelPosition(null);
      setUnderlier(null);
    });
    setMounted(true);
  }, [mounted, connector]);

  // Fetch Vaults
  React.useEffect(() => {
    if (!connector || vaults.length !== 0) return;
    (async function fetchVaults() {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const fiat = await FIAT.fromSigner(signer);
      const collateralTypes = await fiat.fetchCollateralTypes();
      setVaults(collateralTypes);
    })();
  }, [connector, vaults]);

  // Fetch Positions (corresponding to a user's proxy account)
  React.useEffect(() => {
    if (!connector || positions.length !== 0) return;
    (async function fetchPositions() {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const fiat = await FIAT.fromSigner(signer);
      const positions = await fiat.fetchPositions(await signer.getAddress())
      setPositions(positions);
    })();
  }, [connector, positions]);

  // Fetch Vault data corresponding to a selected Position or selected Vault
  // React.useEffect(() => {
  //   if (!connector || Object.keys(vault).length !== 0) return;
  //   let vault_;
  //   if (selPosition != null && positions.length != 0) {
  //     const position_ = positions.find(({ id }) => id === selPosition);
  //     // @ts-ignore
  //     if (!position_ || !position_.vault || !position_.vault.address) return;
  //     // @ts-ignore
  //     vault_ = position_.vault.address;
  //   } else if (selVault != null && vaults.length !== 0) {
  //     vault_ = selVault;
  //   } else {
  //     return;
  //   }
  //   (async function fetchVault() {
  //     const signer = (await connector.getSigner());
  //     if (!signer || !signer.provider) return;
  //     const fiat = await FIAT.fromSigner(signer);
  //     try {
  //       // @ts-ignore
  //       setVault(await fiat.fetchVaultData(vault_.toLowerCase()));
  //     } catch (error) {
  //       setVault({ error });
  //     }
  //   })();
  // }, [connector, vaults, vault, selVault, positions, selPosition]);

  // Update 'Modify Position' state
  React.useEffect(() => {
    if (!connector || (selVault == undefined && selPosition == undefined)) return;
    (async function fetchVault() {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const fiat = await FIAT.fromSigner(signer);
      // const { vaultEPTActions } = fiat.getContracts();
      // const collateral = await fiat.call(vaultEPTActions, 'underlierToPToken')
      // fiat.computeHealthFactor()
    })();
  }, [connector, selVault, selPosition, underlier]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 12,
        }}
      >
        <h4 style={{ justifyContent: 'flex',  }}>Lever App</h4>
        <ConnectButton />
      </div>

      <Spacer y={1} />

      <Container>
        <Text h1>Vaults</Text>
        {mounted && isConnected && vaults.length != 0 && (
          <Table
            aria-label='Vaults'
            css={{
              height: 'auto',
              minWidth: '100%',
            }}
            selectionMode='single'
            selectedKeys={'1'}
            onSelectionChange={(selected) => {
              setSelPosition(null);
              setSelVault(Object.values(selected)[0].split('-')[0]);
              setPosition({});
              setVault({});
            }}
          >
            <Table.Header>
              <Table.Column>Protocol</Table.Column>
              <Table.Column>Token</Table.Column>
              <Table.Column>Underlier</Table.Column>
              <Table.Column>Maturity</Table.Column>
              <Table.Column>TVL</Table.Column>
            </Table.Header>
            <Table.Body>
              {
                vaults.map((vault) => {
                  const {
                    tokenId,
                    name,
                    tokenSymbol,
                    underlierSymbol,
                    maturity
                    // @ts-ignore
                  } = vault.properties;
                  const {
                    protocol,
                    asset
                    // @ts-ignore
                  } = vault.metadata;
                  const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
                  return (
                    <Table.Row key={name + tokenId.toString()}>
                      <Table.Cell>{protocol}</Table.Cell>
                      <Table.Cell>{`${asset} (${tokenSymbol})`}</Table.Cell>
                      <Table.Cell>{underlierSymbol}</Table.Cell>
                      <Table.Cell>
                        <StyledBadge type={(new Date() < maturityFormatted) ? 'green' : 'red'}>
                          { maturityFormatted.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) }
                        </StyledBadge>
                      </Table.Cell>
                      <Table.Cell>0</Table.Cell>
                    </Table.Row>
                  );
                })
              }
            </Table.Body>
          </Table>
        )}
      </Container>
      
      <Spacer y={2} />
      
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
            selectedKeys={'1'}
            onSelectionChange={(selected) => {
              setSelPosition(Object.values(selected)[0]);
              setSelVault(null);
              setPosition({});
              setVault({});
            }}
          >
            <Table.Header>
              <Table.Column>Protocol</Table.Column>
              <Table.Column>Token</Table.Column>
              <Table.Column>TokenId</Table.Column>
              <Table.Column>Owner</Table.Column>
              <Table.Column>Collateral</Table.Column>
              <Table.Column>Normal Debt</Table.Column>
            </Table.Header>
            <Table.Body>
              {
                positions.map((position) => {
                  const {
                    owner,
                    vault,
                    tokenId,
                    collateral,
                    normalDebt
                    // @ts-ignore
                  } = position;
                  const {
                    name,
                    tokenSymbol
                    // @ts-ignore
                  } = vaults.find((vault_) => vault_.properties.vault.toLowerCase() === vault.toLowerCase()).properties;
                  const {
                    protocol,
                    asset
                    // @ts-ignore
                  } = vaults.find((vault_) => vault_.properties.vault.toLowerCase() === vault.toLowerCase()).metadata;
                  return (
                    <Table.Row key={vault + tokenId.toString()}>
                      <Table.Cell>{protocol}</Table.Cell>
                      <Table.Cell>{`${asset} (${tokenSymbol})`}</Table.Cell>
                      <Table.Cell>{tokenId.toString()}</Table.Cell>
                      <Table.Cell>{owner}</Table.Cell>
                      <Table.Cell>{ethers.utils.formatEther(collateral)}</Table.Cell>
                      <Table.Cell>{ethers.utils.formatEther(normalDebt)}</Table.Cell>
                    </Table.Row>
                  );
                })
              }
            </Table.Body>
          </Table>
        )}
      </Container>

      <Modal
        closeButton
        blur
        aria-labelledby="modal-title"
        open={!!(selVault || selPosition)}
        onClose={() => {
          setSelVault(null);
          setVault({});
          setSelPosition(null);
          setPosition({});
        }}
      >
        <Modal.Header>
          <Text id="modal-title" size={18}>
            <Text b size={18}>
              Modify Position
            </Text>
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Input label="Underlier" type="text" onChange={(event) => setUnderlier(event.target.value)}/>
          <Text size={14}>Health Factor</Text>
          <Slider defaultValue={10} />
          <Text>Collateral: </Text>
          <Text>Debt: </Text>
        </Modal.Body>
        <Modal.Footer>
          Modal
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Home;
