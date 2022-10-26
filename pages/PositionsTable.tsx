import React from 'react';
import { Text, Table } from '@nextui-org/react';

// @ts-ignore
import { wadToDec } from '@fiatdao/sdk';

import { encodePositionId, getCollateralTypeData } from './utils';

interface PositionsTableProps {
  collateralTypesData: Array<any>,
  positionsData: Array<any>,
  onSelectPosition: (positionId: string) => void
}

export const PositionsTable = (props: PositionsTableProps) => {
  return (
    <>
      <Text h1>Positions</Text>
      {(props.positionsData.length != 0) && (
        <Table
          aria-label='Positions'
          css={{ height: 'auto', minWidth: '100%' }}
          selectionMode='single'
          selectedKeys={'1'}
          onSelectionChange={(selected) => props.onSelectPosition(Object.values(selected)[0])}
        >
          <Table.Header>
            <Table.Column>Protocol</Table.Column>
            <Table.Column>Token</Table.Column>
            <Table.Column>TokenId</Table.Column>
            <Table.Column>Collateral</Table.Column>
            <Table.Column>Normal Debt</Table.Column>
          </Table.Header>
          <Table.Body>
            {
              props.positionsData.map((position) => {
                const { owner, vault, tokenId, collateral, normalDebt } = position;
                const {
                  properties: { tokenSymbol }, metadata: { protocol, asset }
                } = getCollateralTypeData(props.collateralTypesData, vault, tokenId);
                return (
                  <Table.Row key={encodePositionId(vault, tokenId, owner)}>
                    <Table.Cell>{protocol}</Table.Cell>
                    <Table.Cell>{`${asset} (${tokenSymbol})`}</Table.Cell>
                    <Table.Cell>{(tokenId as Number).toString()}</Table.Cell>
                    <Table.Cell>{wadToDec(collateral)}</Table.Cell>
                    <Table.Cell>{wadToDec(normalDebt)}</Table.Cell>
                  </Table.Row>
                );
              })
            }
          </Table.Body>
        </Table>
      )}
    </>
  );
};
