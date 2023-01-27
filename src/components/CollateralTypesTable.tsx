import React from 'react';
import { Badge, SortDescriptor, Table, Text, User } from '@nextui-org/react';
import { addressEq, interestPerSecondToAnnualYield, interestPerSecondToInterestToMaturity, WAD, wadToDec, ZERO } from '@fiatdao/sdk';
import {
  decodeCollateralTypeId, earnableRateToAPY, encodeCollateralTypeId, encodePositionId,
  floor2, formatUnixTimestamp, getPositionData, getTimestamp
} from '../utils';
import { chain as chains, useAccount, useNetwork, } from 'wagmi';
import { useCollateralTypes } from '../state/queries/useCollateralTypes';
import { useUserData } from '../state/queries/useUserData';
import useStore from '../state/stores/globalStore';

export const CollateralTypesTable = () => {
  const [sortedData, setSortedData] = React.useState<any[]>([]);
  const [sortProps, setSortProps] = React.useState<SortDescriptor>({ column: 'Maturity', direction: 'descending' });

  const { chain } = useNetwork();
  const { address } = useAccount();
  const fiat = useStore((state) => state.fiat);
  const setSelectedPositionId = useStore((state) => state.setSelectedPositionId);
  const setSelectedCollateralTypeId = useStore((state) => state.setSelectedCollateralTypeId);

  const { data: collateralTypesData } = useCollateralTypes(fiat, chain?.id ?? chains.mainnet.id);
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { positionsData, proxies } = userData as any;

  React.useEffect(() => {
    const data = [...collateralTypesData].filter(({ properties: { vault, tokenId } }) => {
      if (positionsData.find((position: any) => addressEq(position.vault, vault) && position.tokenId == tokenId)) {
        return false;
      }
      return true;
    });
    data.sort((a: any, b: any) : number => {
      if (sortProps.direction === 'descending' ) {
        return a.properties.maturity.toNumber() < b.properties.maturity.toNumber() ? 1 : -1
      }
      return a.properties.maturity.toNumber() > b.properties.maturity.toNumber() ? 1 : -1
    });
    setSortedData(data);
  }, [collateralTypesData, positionsData, sortProps.direction])

  if (collateralTypesData.length === 0) return null;

  const onSelectCollateralType = (collateralTypeId: string) => {
    // If user has an existing position for the collateral type then open PositionModal instead
    const { vault, tokenId } = decodeCollateralTypeId(collateralTypeId);
    const positionData = getPositionData(positionsData, vault, tokenId, proxies[0]);
    if (positionData !== undefined) {
      const positionId = encodePositionId(vault, tokenId, positionData.owner);
      setSelectedPositionId(positionId);
      setSelectedCollateralTypeId(null);
    } else {
      setSelectedPositionId(null);
      setSelectedCollateralTypeId(collateralTypeId);
    }
  }

  return (
    <>
      <Text h2>Create Position</Text>
      <Table
        aria-label='Collateral Types'
        css={{ height: 'auto', minWidth: '1088px' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) => onSelectCollateralType(Object.values(selected)[0])}
        sortDescriptor={sortProps as SortDescriptor}
        onSortChange={(data) => { setSortProps({ direction: data.direction, column: data.column })}}
      >
        <Table.Header>
          <Table.Column>Asset</Table.Column>
          <Table.Column>Fixed APY (Yield At Maturity)</Table.Column>
          <Table.Column>Borrow Rate (Due At Maturity)</Table.Column>
          <Table.Column>Total Assets</Table.Column>
          <Table.Column allowsSorting>Maturity (Days Until Maturity)</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((collateralType: any) => {
              const { vault, tokenId, maturity } = collateralType.properties;
              const { protocol, asset, icons, urls, symbol } = collateralType.metadata;
              const { publican: { interestPerSecond }, codex: { depositedCollateral } } = collateralType.state;
              const earnableRate = collateralType?.earnableRate || ZERO;
              const earnableRateAnnulized = earnableRateToAPY(earnableRate, maturity);
              const borrowRate = interestPerSecondToInterestToMaturity(interestPerSecond, getTimestamp(), maturity).sub(WAD);
              const borrowRateAnnualized = interestPerSecondToAnnualYield(interestPerSecond);
              const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
              const daysUntilMaturity = Math.max(Math.floor((Number(maturity.toString()) - Math.floor(Date.now() / 1000)) / 86400), 0);
              return (
                <Table.Row key={encodeCollateralTypeId(vault, tokenId)}>
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
                  <Table.Cell>{`${floor2(wadToDec(earnableRateAnnulized.mul(100)))}% (${floor2(wadToDec(earnableRate.mul(100)))}%)`}</Table.Cell>
                  <Table.Cell>{`${floor2(wadToDec(borrowRateAnnualized.mul(100)))}% (${floor2(wadToDec(borrowRate.mul(100)))}%)`}</Table.Cell>
                  <Table.Cell>{`${floor2(Number(wadToDec(depositedCollateral))).toLocaleString()} ${symbol}`}</Table.Cell>
                  <Table.Cell css={{'& span': {width: '100%'}}}>
                    <Badge isSquared color={new Date() < maturityFormatted ? 'success' : 'error'} variant='flat' >
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
