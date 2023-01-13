import { decToScale, decToWad, normalDebtToDebt, scaleToDec, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text, Tooltip } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { useBorrowStore } from '../../state/stores/borrowStore';
import useStore from '../../state/stores/globalStore';
import { commifyToDecimalPlaces, floor2, floor4, minCollRatioWithBuffer } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import { NumericInput } from '../NumericInput/NumericInput';
import { Slider } from '../Slider/Slider';
import { PositionPreview } from './PositionPreview';

export const CreateForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
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
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const { action: currentTxAction } = transactionData;

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
      settings: { collybus: { liquidationRatio } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;

  const underlierBN = useMemo(() => (
    (borrowStore.createState.underlierStr === '')
      ? ZERO : decToScale(borrowStore.createState.underlierStr, underlierScale)
  ), [borrowStore.createState.underlierStr, underlierScale]);
  const minCollRatio = useMemo(() => minCollRatioWithBuffer(liquidationRatio), [liquidationRatio]);

  if (!modifyPositionData.collateralType || !modifyPositionData.collateralType.metadata) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (!hasProxy) {
      formAlerts.push(
        <Alert
          severity='warning'
          message={`Creating positions requires a Proxy. Please close this modal and click "Create Proxy Account" in
            the top bar.
          `}
          key={'warn-needsProxy'}
        />
      );
    }

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

    if (submitError !== '' && submitError !== 'ACTION_REJECTED' ) {
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
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.underlierStr}
              onChange={(event) => {
                borrowStore.createActions.setUnderlier(
                  fiat, event.target.value, modifyPositionData);
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
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.slippagePctStr}
              onChange={(event) => {
                borrowStore.createActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
              }}
              placeholder='0.01'
              inputMode='decimal'
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
          </Grid>
        </Grid.Container>
        <Tooltip
          css={{ zIndex: 10000, width: 250 }}
          color='primary'
          style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
          content={
            <>
              The targeted collateralization ratio of the position.
              <br />
              Formula:
              <br />
              <InlineMath math="\text{collRatio} = \frac{\text{collateral}*\text{fairPrice}}{\text{debt}}"/>
            </>
          }
        >
          <Text size={'0.75rem'}>
            Targeted collateralization ratio ({floor2(wadToDec(borrowStore.createState.targetedCollRatio.mul(100)))}%)
          </Text>
        </Tooltip>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              aria-label={'Targeted Collateralization Ratio'}
              color='gradient'
              disabled={disableActions}
              inverted
              max={5.0}
              maxLabel={'Safer'}
              min={floor4(wadToDec(minCollRatio))}
              minLabel={'Riskier'}
              onValueChange={(value) => {
                borrowStore.createActions.setTargetedCollRatio(fiat, Number(value), modifyPositionData);
              }}
              step={0.001}
              value={[Number(wadToDec(borrowStore.createState.targetedCollRatio))]}
            />
          </Card.Body>

        </Card>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.deltaCollateral))}
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
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Position Preview
        </Text>
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            borrowStore.formDataLoading
              ? ' '
              : borrowStore.createState.collRatio.eq(ethers.constants.MaxUint256)
                ? '∞'
                : `${floor2(wadToDec(borrowStore.createState.collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

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
              if (!underlierBN.isZero() && underlierAllowance?.gte(underlierBN)) {
                try {
                  setSubmitError('');
                  await unsetUnderlierAllowanceForProxy(fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setUnderlierAllowanceForProxy(fiat, underlierBN);
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
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            borrowStore.formErrors.length !== 0 ||
            borrowStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            underlierBN.isZero() ||
            borrowStore.createState.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(underlierBN) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createPosition(
                borrowStore.createState.deltaCollateral, borrowStore.createState.deltaDebt, underlierBN
              );
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Deposit
        </Button>
      </Modal.Footer>
    </>
  );
}

export const IncreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any,
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
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
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore(state => state.transactionData);

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
        <PositionPreview
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
                    await unsetUnderlierAllowanceForProxy(fiat);
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(fiat, underlierBN)
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

export const DecreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  sellCollateralAndModifyDebt,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
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
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const transactionData = useStore(state => state.transactionData);

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
        <PositionPreview
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
                      await unsetFIATAllowanceForProxy(fiat);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  } else {
                    try {
                      setSubmitError('');
                      await setFIATAllowanceForProxy(fiat, deltaDebt);
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
                          await setFIATAllowanceForMoneta(fiat);
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

export const RedeemForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  redeemCollateralAndModifyDebt,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
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

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      state: { collybus: { fairPrice }, codex: { virtualRate } }
    },
    proxyFIATAllowance,
    monetaFIATAllowance,
    position: { collateral, normalDebt }
  } = modifyPositionData;
  const { action: currentTxAction } = transactionData;

  const deltaCollateral = useMemo(() => (
    (borrowStore.redeemState.deltaCollateralStr === '') ? ZERO : decToWad(borrowStore.redeemState.deltaCollateralStr)
  ), [borrowStore.redeemState.deltaCollateralStr])
  const deltaDebt = useMemo(() => (
    (borrowStore.redeemState.deltaDebtStr === '') ? ZERO : decToWad(borrowStore.redeemState.deltaDebtStr)
  ), [borrowStore.redeemState.deltaDebtStr])

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
                onMaxClick={() => borrowStore.redeemActions.setDeltaCollateral(
                  fiat, wadToDec(collateral).toString(), modifyPositionData
                )}
              />
            }
            rightAdornment={modifyPositionData.collateralType.metadata.symbol}
            style={{ width: '100%' }}
          />
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={borrowStore.redeemState.deltaDebtStr}
          onChange={(event) => {
            borrowStore.redeemActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.redeemActions.setDeltaDebt(
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
        <PositionPreview
          formDataLoading={borrowStore.formDataLoading}
          collateral={collateral}
          normalDebt={normalDebt}
          estimatedCollateral={borrowStore.redeemState.collateral}
          estimatedCollateralRatio={borrowStore.redeemState.collRatio}
          estimatedDebt={borrowStore.redeemState.debt}
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
                      await unsetFIATAllowanceForProxy(fiat);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  } else {
                    try {
                      setSubmitError('');
                      await setFIATAllowanceForProxy(fiat, deltaDebt);
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
                          await setFIATAllowanceForMoneta(fiat);
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
