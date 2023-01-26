import { decToScale, decToWad, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import { BigNumber } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { commifyToDecimalPlaces, floor2 } from '../../../utils';
import { Alert } from '../../Alert';
import { NumericInput } from '../../NumericInput/NumericInput';
import { BorrowPreview } from './BorrowPreview';
import { useBuyCollateralAndModifyDebt } from '../../../hooks/useBorrowPositions';
import { useSetUnderlierAllowanceForProxy, useUnsetUnderlierAllowanceForProxy } from '../../../hooks/useSetAllowance';

const IncreaseForm = ({
  onClose,
}: {
  onClose: () => void,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        increaseState: state.increaseState,
        increaseActions: state.increaseActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore(state => state.transactionData);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const buyCollateralAndModifyDebt = useBuyCollateralAndModifyDebt();
  const setUnderlierAllowanceForProxy = useSetUnderlierAllowanceForProxy();
  const unsetUnderlierAllowanceForProxy = useUnsetUnderlierAllowanceForProxy();

  const underlierBN = useMemo(() => {
    return borrowStore.increaseState.underlierStr === '' ? ZERO : decToScale(borrowStore.increaseState.underlierStr, modifyPositionData.collateralType.properties.underlierScale)
  }, [borrowStore.increaseState.underlierStr, modifyPositionData.collateralType.properties.underlierScale])

  const deltaDebt = useMemo(() => {
    return borrowStore.increaseState.deltaDebtStr === '' ? ZERO : decToWad(borrowStore.increaseState.deltaDebtStr)
  }, [borrowStore.increaseState.deltaDebtStr])

  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  return (
    <>
    <Modal.Body>
      <Text b size={'m'}>
        Inputs
      </Text>
      {modifyPositionData.underlierBalance && (
        <Text size={'$sm'}>
          Available to deposit:{' '}
          {commifyToDecimalPlaces(modifyPositionData.underlierBalance, modifyPositionData.collateralType.properties.underlierScale, 2)} {modifyPositionData.collateralType.properties.underlierSymbol}
        </Text>
      )}
      <Grid.Container
        gap={0}
        justify='space-between'
        wrap='wrap'
        css={{ marginBottom: '1rem' }}
      >
        <NumericInput
          disabled={disableActions}
          value={borrowStore.increaseState.underlierStr}
          onChange={(event) => {
            borrowStore.increaseActions.setUnderlier(fiat, event.target.value, modifyPositionData);
          }}
          label={'Underlier to deposit'}
          placeholder='0'
          style={{ width: '15rem' }}
          rightAdornment={modifyPositionData.collateralType.properties.underlierSymbol}
        />

        <NumericInput
          disabled={disableActions}
          value={borrowStore.increaseState.slippagePctStr}
          onChange={(event) => {
            borrowStore.increaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0.01'
          label='Slippage'
          rightAdornment={'%'}
          style={{ width: '7.5rem' }}
        />
      </Grid.Container>
      <NumericInput
        disabled={disableActions}
        value={borrowStore.increaseState.deltaDebtStr}
        onChange={(event) => {
          borrowStore.increaseActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
        }}
        placeholder='0'
        label={'FIAT to borrow'}
        rightAdornment={'FIAT'}
      />
    </Modal.Body>

    <Spacer y={0.75} />
    <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={
            borrowStore.formDataLoading
              ? ' '
              : floor2(wadToDec(borrowStore.increaseState.deltaCollateral))
          }
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.metadata.symbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <BorrowPreview
          formDataLoading={borrowStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={borrowStore.increaseState.collateral}
          estimatedCollateralRatio={borrowStore.increaseState.collRatio}
          estimatedDebt={borrowStore.increaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Card variant='bordered'>
          <Card.Body>
          <Row justify='flex-start'>
            <Switch
              disabled={disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => modifyPositionData.underlierAllowance?.gt(0) && modifyPositionData.underlierAllowance?.gte(underlierBN) ?? false}
              onChange={async () => {
                if(!underlierBN.isZero() && modifyPositionData.underlierAllowance.gte(underlierBN)) {
                  try {
                    setSubmitError('');
                    await unsetUnderlierAllowanceForProxy();
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(underlierBN)
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer x={0.5} />
            <Text>Allow <code>FIAT I</code> to transfer your {modifyPositionData.collateralType.properties.underlierSymbol}</Text>
          </Row>
          </Card.Body>
        </Card>
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (modifyPositionData.monetaDelegate === false) return true;
            if (underlierBN.isZero() && deltaDebt.isZero()) return true;
            if (!underlierBN.isZero() && modifyPositionData.underlierAllowance.lt(underlierBN)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await buyCollateralAndModifyDebt(borrowStore.increaseState.deltaCollateral, deltaDebt, underlierBN);
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Increase
        </Button>
      </Modal.Footer>
    </>
  );
}

export default IncreaseForm;
