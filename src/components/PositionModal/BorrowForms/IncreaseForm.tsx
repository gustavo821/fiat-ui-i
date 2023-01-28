import { decToScale, decToWad, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text, Tooltip } from '@nextui-org/react';
import React, { useCallback, useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { commifyToDecimalPlaces, floor2 } from '../../../utils';
import { Alert } from '../../Alert';
import { NumericInput } from '../../NumericInput/NumericInput';
import { BorrowPreview } from './BorrowPreview';
import { useSetUnderlierAllowanceForProxy, useUnsetUnderlierAllowanceForProxy } from '../../../hooks/useSetAllowance';
import { buildBuyCollateralAndModifyDebtArgs, buildModifyCollateralAndDebtArgs, sendTransaction } from '../../../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useSoftReset from '../../../hooks/useSoftReset';
import { useUserData } from '../../../state/queries/useUserData';
import { BigNumber } from 'ethers';

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
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore(state => state.transactionData);

  const setUnderlierAllowanceForProxy = useSetUnderlierAllowanceForProxy();
  const unsetUnderlierAllowanceForProxy = useUnsetUnderlierAllowanceForProxy();

  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const buyCollateralAndModifyDebt = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // increase (mint)
      const args = buildModifyCollateralAndDebtArgs(fiat, user, proxies, collateralType, deltaDebt, position);
      const response = await sendTransaction(
        fiat, true, proxies[0], 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Borrow FIAT' });
      softReset();
    } else {
      const args = buildBuyCollateralAndModifyDebtArgs(
        fiat, user, proxies, collateralType, deltaCollateral, deltaDebt, underlier
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'buyCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Buy and deposit collateral and borrow FIAT'
      });
      softReset();
      return response;
    }
  } ,[addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
      state: { collybus: { fairPrice }, codex: { virtualRate } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
    position: { collateral, normalDebt },
  } = modifyPositionData;
  const { action: currentTxAction } = transactionData;

  const underlierBN = useMemo(() => (
    (borrowStore.increaseState.underlierStr === '')
      ? ZERO
      : decToScale(borrowStore.increaseState.underlierStr, underlierScale)
  ), [borrowStore.increaseState.underlierStr, underlierScale]);
  const deltaDebt = useMemo(() => (
    (borrowStore.increaseState.deltaDebtStr === '') ? ZERO : decToWad(borrowStore.increaseState.deltaDebtStr)
  ), [borrowStore.increaseState.deltaDebtStr]);

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
      {underlierBalance && (
        <Text size={'$sm'}>
          Available:{' '}
          {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)} {underlierSymbol}
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
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The amount of ${underlierSymbol} to swap for ${tokenSymbol}.`}
            >
              Underliers to swap
            </Tooltip>
          }
          placeholder='0'
          style={{ width: '15rem' }}
          rightAdornment={underlierSymbol}
        />

        <NumericInput
          disabled={disableActions}
          value={borrowStore.increaseState.slippagePctStr}
          onChange={(event) => {
            borrowStore.increaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0.01'
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The maximum allowed slippage (in percentage) when swapping ${underlierSymbol} for
                ${tokenSymbol}. The transaction will revert if the amount of ${tokenSymbol} diverges by more
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
        value={borrowStore.increaseState.deltaDebtStr}
        onChange={(event) => {
          borrowStore.increaseActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
        }}
        placeholder='0'
        label={
          <Tooltip
            css={{ zIndex: 10000, width: 250 }}
            color='primary'
            content={'The amount of FIAT to borrow against the collateral.'}
          >
            FIAT to borrow
          </Tooltip>
        }
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The total amount of the collateral asset that is bought from the provided underliers.
                This estimate accounts for slippage and price impact.`
              }
            >
              Collateral to deposit (incl. slippage)
            </Tooltip>
          }
          labelRight={tokenSymbol}
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
          estimatedCollateral={borrowStore.increaseState.collateral}
          estimatedCollateralRatio={borrowStore.increaseState.collRatio}
          estimatedDebt={borrowStore.increaseState.debt}
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
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(underlierBN) ?? false}
              onChange={async () => {
                if(!underlierBN.isZero() && underlierAllowance.gte(underlierBN)) {
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
                (
                  ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '')
                  && disableActions
                ) ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer x={0.5} />
            <Text>Allow <code>FIAT I</code> to transfer your {underlierSymbol}</Text>
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
            if (monetaDelegate === false) return true;
            if (underlierBN.isZero() && deltaDebt.isZero()) return true;
            if (!underlierBN.isZero() && underlierAllowance.lt(underlierBN)) return true;
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
