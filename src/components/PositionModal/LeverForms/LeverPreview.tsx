import { scaleToDec, wadToDec } from '@fiatdao/sdk';
import { Card, Input, Loading, Modal, Spacer, Text } from '@nextui-org/react';
import React from 'react';
import shallow from 'zustand/shallow';
import useStore from '../../../state/stores/globalStore';
import { useLeverStore } from '../../../state/stores/leverStore';
import { floor2, interestPerSecondToAPY } from '../../../utils';


export const LeverPreview = () => {

  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        createState: state.createState,
        createActions: state.createActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );

  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { 
    minTokenToBuy, 
    collateral, 
    collRatio, 
    debt, 
    leveragedGain, 
    leveragedAPY
  } = leverStore.createState;

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierSymbol, tokenScale },
      state: { publican: { interestPerSecond } }
    }
  } = modifyPositionData;

  return (
    <>
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(scaleToDec(minTokenToBuy, tokenScale))}`
          }
          placeholder='0'
          type='string'
          label={'Total Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(leveragedGain))} (${floor2(wadToDec(leveragedAPY.mul(100)))}% APY)`
          }
          placeholder='0'
          type='string'
          label={`Net Gain at maturity 
            (incl. ${floor2(Number(wadToDec(interestPerSecondToAPY(interestPerSecond))) * 100)}% borrow fee)
          `}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading) ? ' ' : floor2(wadToDec(debt))}
          placeholder='0'
          type='string'
          label='Debt (incl. slippage)'
          labelRight={'FIAT'}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            (leverStore.formDataLoading)
              ? ' '
              : `${floor2(wadToDec(collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio (incl. slippage)'
          labelRight={'🚦'}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>
    </>
  )
}