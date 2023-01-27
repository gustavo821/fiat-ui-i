import React from 'react';
import { Badge, Col, Row, SortDescriptor, Table, Text, User } from '@nextui-org/react';
import {
  computeCollateralizationRatio, interestPerSecondToAnnualYield, interestPerSecondToInterestToMaturity, WAD, wadToDec
} from '@fiatdao/sdk';
import { chain as chains, useAccount, useNetwork, } from 'wagmi';
import { encodePositionId, floor2, formatUnixTimestamp, getCollateralTypeData, getTimestamp } from '../utils';
import { ethers } from 'ethers';
import { useCollateralTypes } from '../state/queries/useCollateralTypes';
import { useUserData } from '../state/queries/useUserData';
import useStore from '../state/stores/globalStore';

export const PositionsTable = () => {
  const [sortedData, setSortedData] = React.useState<any[]>([]);
  const [sortProps, setSortProps] = React.useState<SortDescriptor>({
    column: 'Maturity',
    direction: 'descending'
  });
  const fiat = useStore((state) => state.fiat);
  const setSelectedPositionId = useStore((state) => state.setSelectedPositionId);
  const setSelectedCollateralTypeId = useStore((state) => state.setSelectedCollateralTypeId);

  const { chain } = useNetwork();
  const { address } = useAccount();

  const { data: collateralTypesData } = useCollateralTypes(fiat, chain?.id ?? chains.mainnet.id);
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { positionsData } = userData as any;

  React.useEffect(() => {
    const data = [...positionsData]
    data.sort((a: any, b: any) : number => {
      if (!collateralTypesData || !a || !b) return 0;
      const { vault: vaultA, tokenId: tokenIdA } = a;
      const { vault: vaultB, tokenId: tokenIdB } = b;
      const dataA = getCollateralTypeData(collateralTypesData, vaultA, tokenIdA);
      const dataB = getCollateralTypeData(collateralTypesData, vaultB, tokenIdB);
      if (!dataA || !dataB) return 0;
      if (sortProps.direction === 'descending' ) {
        return dataA.properties.maturity.toNumber() < dataB.properties.maturity.toNumber() ? 1 : -1
      }
      return dataA.properties.maturity.toNumber() > dataB.properties.maturity.toNumber() ? 1 : -1
    });
    setSortedData(data);
  }, [collateralTypesData, positionsData, sortProps.direction])

  if (positionsData === null || positionsData.length === 0 || collateralTypesData.length === 0) {
    // TODO
    // return <Loading />;
    return null;
  }

  return (
    <>
      <Text h2>Positions</Text>
      <Table
        aria-label='Positions'
        css={{ height: 'auto', minWidth: '1088px' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) => {
          setSelectedPositionId(Object.values(selected)[0])
          setSelectedCollateralTypeId(null)
        }}
        sortDescriptor={sortProps as SortDescriptor}
        disabledKeys={sortedData.filter(({ vault, tokenId }) => (
          getCollateralTypeData(collateralTypesData, vault, tokenId) === undefined
        )).map(({ vault, tokenId, owner }) => encodePositionId(vault, tokenId, owner))}
        onSortChange={(data) => {
          setSortProps({
            direction: data.direction,
            column: data.column
          })
        }}
      >
        <Table.Header>
          <Table.Column>Asset</Table.Column>
          <Table.Column>Borrow Rate (Due At Maturity)</Table.Column>
          <Table.Column>Collateral (Fair Value)</Table.Column>
          <Table.Column>Debt (Implied Value)</Table.Column>
          <Table.Column>Collateralization Ratio</Table.Column>
          <Table.Column allowsSorting>Maturity (Days Until Maturity)</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((position) => {
              const { owner, vault, tokenId, collateral, normalDebt } = position;
              const collateralTypeData = getCollateralTypeData(collateralTypesData, vault, tokenId);
              if (collateralTypeData === undefined) {
                return (
                  <Table.Row key={encodePositionId(vault, tokenId, owner)}>
                    <Table.Cell>&nbsp;&nbsp;&nbsp;{'Unknown Asset'}</Table.Cell>
                    <Table.Cell>{''}</Table.Cell>
                    <Table.Cell>{''}</Table.Cell>
                    <Table.Cell>{''}</Table.Cell>
                    <Table.Cell>{''}</Table.Cell>
                    <Table.Cell>{''}</Table.Cell>
                  </Table.Row>
                );
              }
              const {
                properties: { maturity },
                metadata: { protocol, asset, icons, urls, symbol },
                state: {
                  publican: { interestPerSecond }, codex: { virtualRate }, collybus: { fairPrice }
                }
              } = collateralTypeData;
              const borrowRate = interestPerSecondToInterestToMaturity(interestPerSecond, getTimestamp(), maturity).sub(WAD);
              const borrowRateAnnualized = interestPerSecondToAnnualYield(interestPerSecond);
              const debt = normalDebt.mul(virtualRate).div(WAD);
              const dueAtMaturity = normalDebt.mul(borrowRate).div(WAD);
              const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, virtualRate);
              const now = getTimestamp();
              const daysUntilMaturity = Math.max(Math.floor((Number(maturity.sub(now).toString())) / 86400), 0);
              return (
                <Table.Row key={encodePositionId(vault, tokenId, owner)}>
                  <Table.Cell>
                    <User src={icons.asset} name={asset} css={{
                      borderRadius: '0px',
                      '& span': {
                        '& .nextui-avatar-bg': {
                          background: 'transparent !important'
                        },
                        borderRadius: '0px !important',
                        '& img': {
                          borderRadius: '0px !important',
                          background: 'transparent !important',
                        }
                      },
                    }}>
                      <User.Link href={urls.asset}>{protocol}</User.Link>
                    </User>
                  </Table.Cell>
                  <Table.Cell>
                    <Row>{`${floor2(wadToDec(borrowRateAnnualized.mul(100)))}%`}</Row>
                    <Row>{`(${floor2(wadToDec(borrowRate.mul(100)))}% ≅ ${floor2(wadToDec(dueAtMaturity))} FIAT)`}</Row>
                  </Table.Cell>
                  <Table.Cell>
                    <Col>
                      <Row>{`${floor2(wadToDec(collateral)).toLocaleString()} ${symbol}`}</Row>
                      <Row>{`($${floor2(wadToDec(fairPrice.mul(collateral).div(WAD))).toLocaleString()})`}</Row>
                    </Col>
                  </Table.Cell>
                  <Table.Cell>
                    <Row>{floor2(wadToDec(debt)).toLocaleString()} FIAT</Row>
                    <Row>(${floor2(wadToDec(debt)).toLocaleString()})</Row>
                  </Table.Cell>
                  <Table.Cell>
                    {(collRatio.eq(ethers.constants.MaxUint256))
                      ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`
                    }
                  </Table.Cell>
                  <Table.Cell css={{'& span': {width: '100%'}}}>
                    <Badge isSquared color={(now.lt(maturity)) ? 'success' : 'error'} variant='flat' >
                      {formatUnixTimestamp(maturity)}, ({daysUntilMaturity} days)
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              );
            })
          }
        </Table.Body>
      </Table>
    </>
  );
};
