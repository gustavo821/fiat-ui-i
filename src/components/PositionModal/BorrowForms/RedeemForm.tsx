import { decToWad, normalDebtToDebt, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { Alert } from '../../Alert';
import { InputLabelWithMax } from '../../InputLabelWithMax';
import { NumericInput } from '../../NumericInput/NumericInput';
import { BorrowPreview } from './BorrowPreview';
import { useRedeemCollateralAndModifyDebt } from '../../../hooks/useBorrowPositions';
import { 
  useSetFIATAllowanceForMoneta, 
  useSetFIATAllowanceForProxy, 
  useUnsetFIATAllowanceForProxy 
} from '../../../hooks/useSetAllowance';

const RedeemForm = ({
  onClose,
}: {
  onClose: () => void,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        redeemState: state.redeemState,
        redeemActions: state.redeemActions,
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
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const transactionData = useStore(state => state.transactionData);

  const redeemCollateralAndModifyDebt = useRedeemCollateralAndModifyDebt();
  const setFIATAllowanceForMoneta = useSetFIATAllowanceForMoneta();
  const setFIATAllowanceForProxy = useSetFIATAllowanceForProxy();
  const unsetFIATAllowanceForProxy = useUnsetFIATAllowanceForProxy();

  const deltaCollateral = useMemo(() => {
    return borrowStore.redeemState.deltaCollateralStr === '' ? ZERO : decToWad(borrowStore.redeemState.deltaCollateralStr)
  }, [borrowStore.redeemState.deltaCollateralStr])

  const deltaDebt = useMemo(() => {
    return borrowStore.redeemState.deltaDebtStr === '' ? ZERO : decToWad(borrowStore.redeemState.deltaDebtStr)
  }, [borrowStore.redeemState.deltaDebtStr])

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
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <NumericInput
            disabled={disableActions}
            value={borrowStore.redeemState.deltaCollateralStr}
            onChange={(event) => {
              borrowStore.redeemActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and redeem'
                onMaxClick={() => borrowStore.redeemActions.setDeltaCollateral(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)} />
            }
            rightAdornment={modifyPositionData.collateralType.metadata.symbol}
            style={{ width: '100%' }}
          />
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={borrowStore.redeemState.deltaDebtStr}
          onChange={(event) => {
            borrowStore.redeemActions.setDeltaDebt(fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.redeemActions.setDeltaDebt(fiat, wadToDec(normalDebtToDebt(modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate)).toString(), modifyPositionData)} />
          }
          rightAdornment={'FIAT'}
        />
        <Text size={'$sm'}>
          Note: When closing your position make sure you have enough FIAT to cover the accrued borrow fees.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <BorrowPreview
          formDataLoading={borrowStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={borrowStore.redeemState.collateral}
          estimatedCollateralRatio={borrowStore.redeemState.collRatio}
          estimatedDebt={borrowStore.redeemState.debt}
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
                checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(deltaDebt) ?? false)}
                onChange={async () => {
                  if (deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(deltaDebt)) {
                    try {
                      setSubmitError('');
                      await unsetFIATAllowanceForProxy();
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  } else {
                    try {
                      setSubmitError('');
                      await setFIATAllowanceForProxy(deltaDebt);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  }
                }}
                color='primary'
                icon={
                  ['setFIATAllowanceForProxy', 'unsetFIATAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                    <Loading size='xs' />
                ) : null
                }
              />
              <Spacer x={0.5} />
              <Text>Allow <code>Proxy</code> to transfer your FIAT</Text>
            </Row>
            {modifyPositionData.monetaFIATAllowance?.lt(deltaDebt) && (
              <>
                <Spacer x={0.5} />
                <Row justify='flex-start'>
                  <Switch
                    disabled={disableActions || !hasProxy}
                    // Next UI Switch `checked` type is wrong, this is necessary
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    checked={() => (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(deltaDebt) ?? false)}
                    onChange={async () => {
                      if (deltaDebt.gt(0) && modifyPositionData.monetaFIATAllowance.gte(deltaDebt)) {
                        try {
                          setSubmitError('');
                          // await unsetFIATAllowanceForMoneta(fiat);
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      } else {
                        try {
                          setSubmitError('');
                          await setFIATAllowanceForMoneta();
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      }
                    }}
                    color='primary'
                    icon={
                      ['setFIATAllowanceForMoneta', 'unsetFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions ? (
                        <Loading size='xs' />
                      ) : null
                    }
                  />
                  <Spacer x={0.5} />
                  <Text>Allow <code>FIAT I</code> to transfer your FIAT (One Time)</Text>
                </Row>
              </>
            )}
          </Card.Body>
        </Card>

        <Spacer y={0.5} />
        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (deltaCollateral.isZero() && deltaDebt.isZero()) return true;
            if (!deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(deltaDebt)) return true;
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
              await redeemCollateralAndModifyDebt(deltaCollateral, deltaDebt);
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Redeem
        </Button>
      </Modal.Footer>
    </>
  )
}

export default RedeemForm;
