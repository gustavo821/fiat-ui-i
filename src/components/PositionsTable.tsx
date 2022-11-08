import React from 'react';
import { Table, Text, User } from '@nextui-org/react';

import { wadToDec } from '@fiatdao/sdk';

import { encodePositionId, getCollateralTypeData } from '../utils';
import Skeleton from 'react-loading-skeleton';

interface PositionsTableProps {
  collateralTypesData: Array<any>;
  positionsData: Array<any>;
  onSelectPosition: (positionId: string) => void;
}

export const PositionsTable = (props: PositionsTableProps) => {
  const colNames = React.useMemo(() => {
    return ['Protocol', 'Token', 'Collateral', 'Normal Debt'];
  }, []);

  const cells = React.useMemo(() => {
    return props.collateralTypesData.length === 0 ? (
      <Table.Row>
        {colNames.map((colName) => (
          <Table.Cell key={colName}>
            <Skeleton count={colNames.length} />
          </Table.Cell>
        ))}
      </Table.Row>
    ) : (
      props.positionsData.map((position) => {
        const { owner, vault, tokenId, collateral, normalDebt } = position;
        const {
          properties: { tokenSymbol },
          metadata: { protocol, asset, icons, urls },
        } = getCollateralTypeData(props.collateralTypesData, vault, tokenId);
        return (
          <Table.Row key={encodePositionId(vault, tokenId, owner)}>
            <Table.Cell>
              <User src={icons.protocol} name={protocol}>
                <User.Link href={urls.project}>Visit</User.Link>
              </User>
            </Table.Cell>
            <Table.Cell>
              <User src={icons.asset} name={asset}>
                <User.Link href={urls.asset}>{tokenSymbol}</User.Link>
              </User>
            </Table.Cell>
            <Table.Cell>{wadToDec(collateral)}</Table.Cell>
            <Table.Cell>{wadToDec(normalDebt)}</Table.Cell>
          </Table.Row>
        );
      })
    );
  }, [props.collateralTypesData, props.positionsData, colNames]);

  return (
    <>
      <Text h1>Positions</Text>
      <Table
        aria-label='Positions'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) =>
          props.onSelectPosition(Object.values(selected)[0])
        }
      >
        <Table.Header>
          {colNames.map((colName) => (
            <Table.Column key={colName}>{colName}</Table.Column>
          ))}
        </Table.Header>
        <Table.Body>{cells}</Table.Body>
      </Table>
    </>
  );
};
