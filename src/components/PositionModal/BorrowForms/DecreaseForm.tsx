import { decToWad, normalDebtToDebt, scaleToDec, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text, Tooltip } from '@nextui-org/react';
import React, { useCallback, useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { floor2 } from '../../../utils';
import { Alert } from '../../Alert';
import { InputLabelWithMax } from '../../InputLabelWithMax';
import { NumericInput } from '../../NumericInput/NumericInput';
import { BorrowPreview } from './BorrowPreview';
import { 
  useSetFIATAllowanceForMoneta, 
  useSetFIATAllowanceForProxy, 
  useUnsetFIATAllowanceForProxy 
} from '../../../hooks/useSetAllowance';
import { buildModifyCollateralAndDebtArgs, buildSellCollateralAndModifyDebtArgs, sendTransaction } from '../../../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useSoftReset from '../../../hooks/useSoftReset';
import { useUserData } from '../../../state/queries/useUserData';
import { BigNumber } from 'ethers';

const DecreaseForm = ({
  onClose,
}: {
  onClose: () => void,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        decreaseState: state.decreaseState,
        decreaseActions: state.decreaseActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );
  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const transactionData = useStore(state => state.transactionData);

  const setFIATAllowanceForMoneta = useSetFIATAllowanceForMoneta();
  const setFIATAllowanceForProxy = useSetFIATAllowanceForProxy();
  const unsetFIATAllowanceForProxy = useUnsetFIATAllowanceForProxy();

  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const sellCollateralAndModifyDebt = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
      // decrease (pay back)
      const args = buildModifyCollateralAndDebtArgs(
        fiat, user, proxies, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = buildSellCollateralAndModifyDebtArgs(
        fiat, user, proxies, collateralType, deltaCollateral, deltaDebt, underlier, position,
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'sellCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and sell collateral and repay borrowed FIAT'
      });
      softReset();
    }
  } ,[addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
      state: { collybus: { fairPrice }, codex: { virtualRate } }
    },
    proxyFIATAllowance,
    monetaFIATAllowance,
    position: { collateral, normalDebt }
  } = modifyPositionData;
  const { action: currentTxAction } = transactionData;

  const deltaCollateral = useMemo(() => (
    (borrowStore.decreaseState.deltaCollateralStr === '')
      ? ZERO : decToWad(borrowStore.decreaseState.deltaCollateralStr)
  ), [borrowStore.decreaseState.deltaCollateralStr])
  const deltaDebt = useMemo(() => (
    (borrowStore.decreaseState.deltaDebtStr === '')
      ? ZERO : decToWad(borrowStore.decreaseState.deltaDebtStr)
  ), [borrowStore.decreaseState.deltaDebtStr])

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
            value={borrowStore.decreaseState.deltaCollateralStr}
            onChange={(event) => {
              borrowStore.decreaseActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => borrowStore.decreaseActions.setDeltaCollateral(
                  fiat, wadToDec(collateral).toString(), modifyPositionData
                )}
              />
            }
            rightAdornment={tokenSymbol}
            style={{ width: '15rem' }}
          />
          <NumericInput
            disabled={disableActions}
            value={borrowStore.decreaseState.slippagePctStr}
            onChange={(event) => {
              borrowStore.decreaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0.01'
            inputMode='decimal'
            label={
              <Tooltip
                css={{ zIndex: 10000, width: 250 }}
                color='primary'
                content={`The maximum allowed slippage (in percentage) when swapping ${tokenSymbol} for
                  ${underlierSymbol}. The transaction will revert if the amount of ${underlierSymbol} diverges by more
                  (in percentages) than the provided slippage amount.
                `}
              >
                Slippage
              </Tooltip>
            }
            rightAdornment={'%'}
            style={{ width: '7.5rem' }}
          />
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={borrowStore.decreaseState.deltaDebtStr}
          onChange={(event) => {
            borrowStore.decreaseActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.decreaseActions.setDeltaDebt(
                fiat, wadToDec(normalDebtToDebt(normalDebt, virtualRate)).toString(), modifyPositionData
              )}
            />
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
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={
            (borrowStore.formDataLoading)
              ? ' '
              : floor2(scaleToDec(borrowStore.decreaseState.underlier, underlierScale))
          }
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (incl. slippage)'}
          labelRight={underlierSymbol}
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
          collateral={collateral}
          normalDebt={normalDebt}
          estimatedCollateral={borrowStore.decreaseState.collateral}
          estimatedCollateralRatio={borrowStore.decreaseState.collRatio}
          estimatedDebt={borrowStore.decreaseState.debt}
          virtualRate={virtualRate}
          fairPrice={fairPrice}
          symbol={tokenSymbol}
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
                checked={() => (proxyFIATAllowance?.gt(0) && proxyFIATAllowance?.gte(deltaDebt) ?? false)}
                onChange={async () => {
                  if (deltaDebt.gt(0) && proxyFIATAllowance.gte(deltaDebt)) {
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
                  (
                    ['setFIATAllowanceForProxy', 'unsetFIATAllowanceForProxy'].includes(currentTxAction || '')
                    && disableActions
                  ) ? (
                    <Loading size='xs' />
                  ) : null
                }
              />
              <Spacer x={0.5} />
              <Text>Allow <code>Proxy</code> to transfer your FIAT</Text>
            </Row>
            {monetaFIATAllowance?.lt(deltaDebt) && (
              <>
                <Spacer x={0.5} />
                <Row justify='flex-start'>
                  <Switch
                    disabled={disableActions || !hasProxy}
                    // Next UI Switch `checked` type is wrong, this is necessary
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    checked={() => (monetaFIATAllowance?.gt(0) && monetaFIATAllowance?.gte(deltaDebt) ?? false)}
                    onChange={async () => {
                      if (deltaDebt.gt(0) && monetaFIATAllowance.gte(deltaDebt)) {
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
                      (
                        ['setFIATAllowanceForMoneta', 'unsetFIATAllowanceForMoneta'].includes(currentTxAction || '')
                        && disableActions
                      ) ? (
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
            if (!deltaDebt.isZero() && monetaFIATAllowance?.lt(deltaDebt)) return true;
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
              await sellCollateralAndModifyDebt(deltaCollateral, deltaDebt, borrowStore.decreaseState.underlier);
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Decrease
        </Button>
      </Modal.Footer>
    </>
  );
}

export default DecreaseForm;
