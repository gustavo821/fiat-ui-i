import { computeCollateralizationRatio, scaleToDec, WAD, wadToDec } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Spacer, Switch, Text } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';
import { BigNumber, ethers } from 'ethers';
import React from 'react';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import shallow from 'zustand/shallow';
import { useUserData } from '../../state/queries/useUserData';
import { useLeverStore } from '../../state/stores/leverStore';
import { commifyToDecimalPlaces, floor2, floor4 } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import useStore from '../../state/stores/globalStore';

export const LeverCreateForm = ({
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createLeveredPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createLeveredPosition: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
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

  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);

  const [submitError, setSubmitError] = React.useState('');

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;
  const {
    upFrontUnderliers, collateralSlippagePct, underlierSlippagePct, targetedCollRatio,
    addDebt, minUnderliersToBuy, minTokenToBuy, 
    collateral, collRatio, debt, estCollateral, estCollRatio, estMinTokenToBuy, minCollRatio, maxCollRatio
  } = leverStore.createState;
  const {
    setUpFrontUnderliers, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.createActions;
  const { action: currentTxAction } = transactionData;

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (!hasProxy) {
      formAlerts.push(
        <Alert
          severity='warning'
          message={'Creating positions requires a Proxy. Please close this modal and click "Create Proxy Account" in the top bar.'}
          key={'warn-needsProxy'}
        />
      );
    }

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
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
        <Text b size={'m'}>Inputs</Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet:{' '}
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <Input
          disabled={disableActions}
          value={floor2(scaleToDec(upFrontUnderliers, underlierScale))}
          onChange={(event) => { setUpFrontUnderliers(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          inputMode='decimal'
          label={'Underlier to swap'}
          labelRight={underlierSymbol}
          bordered
          size='sm'
          borderWeight='light'
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(underlierSlippagePct)) * 100)}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage w/ Price Impact (FIAT to Underlier swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(collateralSlippagePct)) * 100)}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage w/ Price Impact (Underlier to Collateral swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <Slider
                  handleStyle={{ borderColor: '#0072F5' }}
                  included={false}
                  disabled={disableActions}
                  value={Number(wadToDec(targetedCollRatio))}
                  onChange={(value) => { setTargetedCollRatio(fiat, value, modifyPositionData) }}
                  min={floor4(wadToDec(minCollRatio))}
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  step={0.001}
                  reverse
                  marks={{
                    [(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Safe',
                    },
                    [floor4(wadToDec(minCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Unsafe',
                    },
                  }}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : (minTokenToBuy.lte(estMinTokenToBuy)) 
              ? `[${floor2(scaleToDec(minTokenToBuy, tokenScale))}, ${floor2(scaleToDec(estMinTokenToBuy, tokenScale))}]`
              : `[${floor2(scaleToDec(estMinTokenToBuy, tokenScale))}, ${floor2(scaleToDec(minTokenToBuy, tokenScale))}]`
          }
          placeholder='0'
          type='string'
          label={'Total Collateral to deposit ([min., max.])'}
          labelRight={tokenSymbol}
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
            : (collateral.lte(estCollateral)) 
              ? `[${floor2(wadToDec(collateral))}, ${floor2(wadToDec(estCollateral))}]`
              : `[${floor2(wadToDec(estCollateral))}, ${floor2(wadToDec(collateral))}]`
          }
          placeholder='0'
          type='string'
          label={'Collateral ([min., max.])'}
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
          label='Debt'
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
              : (collRatio.lte(estCollRatio)) 
                ? `[${floor2(wadToDec(collRatio.mul(100)))}%, ${floor2(wadToDec(estCollRatio.mul(100)))}%]`
                : `[${floor2(wadToDec(estCollRatio.mul(100)))}%, ${floor2(wadToDec(collRatio.mul(100)))}%]`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio ([min., max.])'
          labelRight={'🚦'}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(upFrontUnderliers) ?? false}
          onChange={async () => {
            if (!upFrontUnderliers.isZero() && underlierAllowance?.gte(upFrontUnderliers)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(fiat, upFrontUnderliers);
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
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            leverStore.formErrors.length !== 0 ||
            leverStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            upFrontUnderliers?.isZero() ||
            minTokenToBuy?.isZero() ||
            underlierAllowance?.lt(upFrontUnderliers) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createLeveredPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createLeveredPosition(upFrontUnderliers, addDebt, minUnderliersToBuy, minTokenToBuy);
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

export const LeverIncreaseForm = ({
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndIncreaseLever,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndIncreaseLever: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
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

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
    position
  } = modifyPositionData;
  const {
    upFrontUnderliers, collateralSlippagePct, underlierSlippagePct,
    addDebt, minUnderliersToBuy, minTokenToBuy, targetedCollRatio,
    collateral, collRatio, debt, estCollateral, estCollRatio, estMinTokenToBuy, minCollRatio, maxCollRatio
  } = leverStore.increaseState;
  const {
    setUpFrontUnderliers, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.increaseActions;
  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
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
        <Text b size={'m'}>Inputs</Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet: {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)} {underlierSymbol}
          </Text>
        )}
        <Input
          label={'Underlier to deposit'}
          disabled={disableActions}
          value={floor2(scaleToDec(upFrontUnderliers, underlierScale))}
          onChange={(event) => { setUpFrontUnderliers(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          inputMode='decimal'
          labelRight={underlierSymbol}
          bordered
          size='sm'
          borderWeight='light'
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(underlierSlippagePct)) * 100)}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage (FIAT to Underlier swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(collateralSlippagePct)) * 100)}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage (Underlier to Collateral swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <Slider
                  handleStyle={{ borderColor: '#0072F5' }}
                  included={false}
                  disabled={disableActions}
                  value={Number(wadToDec(targetedCollRatio))}
                  onChange={(value) => {
                    setTargetedCollRatio(fiat, value, modifyPositionData);
                  }}
                  min={floor4(wadToDec(minCollRatio))}
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  step={0.001}
                  reverse
                  marks={{
                    [(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Safe',
                    },
                    [floor4(wadToDec(minCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Unsafe',
                    },
                  }}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : (minTokenToBuy.lte(estMinTokenToBuy)) 
              ? `[${floor2(scaleToDec(minTokenToBuy, tokenScale))}, ${floor2(scaleToDec(estMinTokenToBuy, tokenScale))}]`
              : `[${floor2(scaleToDec(estMinTokenToBuy, tokenScale))}, ${floor2(scaleToDec(minTokenToBuy, tokenScale))}]`
          }
          placeholder='0'
          type='string'
          label={'Total Collateral to deposit ([min., max.])'}
          labelRight={tokenSymbol}
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
            : (collateral.lte(estCollateral)) 
              ? `${floor2(wadToDec(position.collateral))} → [${floor2(wadToDec(collateral))}, ${floor2(wadToDec(estCollateral))}]`
              : `${floor2(wadToDec(position.collateral))} → [${floor2(wadToDec(estCollateral))}, ${floor2(wadToDec(collateral))}]`
          }
          placeholder='0'
          type='string'
          label={'Collateral ([min., max.])'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            const estCollRatioAfter = (estCollRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(estCollRatio.mul(100)))}%`;
            if (collRatio.lte(estCollRatio)) 
              return `${collRatioBefore} → [${collRatioAfter}%, ${estCollRatioAfter}%]`
            else
              return `${collRatioBefore} → [${estCollRatioAfter}%, ${collRatioAfter}%]`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio ([min., max.])'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* renderSummary() */}
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(upFrontUnderliers) ?? false}
          onChange={async () => {
            if(!upFrontUnderliers.isZero() && underlierAllowance.gte(upFrontUnderliers)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(fiat, upFrontUnderliers)
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

        <Spacer y={3} />

        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (monetaDelegate === false) return true;
            if (upFrontUnderliers.isZero() && minTokenToBuy.isZero()) return true;
            if (!upFrontUnderliers.isZero() && underlierAllowance.lt(upFrontUnderliers)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await buyCollateralAndIncreaseLever(upFrontUnderliers, addDebt, minUnderliersToBuy, minTokenToBuy);
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

export const LeverDecreaseForm = ({
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  sellCollateralAndDecreaseLever,
}: {
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  sellCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber, minUnderlierToBuy: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
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

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    position
  } = modifyPositionData;
  const {
    subTokenAmount, collateralSlippagePct, underlierSlippagePct,
    maxUnderliersToSell, minUnderliersToBuy, targetedCollRatio,
    collateral, debt, collRatio, minCollRatio, maxCollRatio
  } = leverStore.decreaseState;
  const {
    setSubTokenAmount, setMaxSubTokenAmount, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.decreaseActions;
  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
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
        <Text b size={'m'}>Inputs</Text>
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(underlierSlippagePct)) * 100)}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage (Underlier to FIAT swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(collateralSlippagePct)) * 100)}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage (Collateral to Underlier swap)'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='11.0rem'
            />
          </Grid>
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor2(scaleToDec(subTokenAmount, tokenScale))}
          onChange={(event) => { setSubTokenAmount(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and swap'
              onMaxClick={() => setMaxSubTokenAmount(fiat, modifyPositionData)}
            />
          }
          labelRight={tokenSymbol}
          bordered
          size='sm'
          borderWeight='light'
        />
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <Slider
                  handleStyle={{ borderColor: '#0072F5' }}
                  included={false}
                  disabled={disableActions}
                  value={Number(wadToDec(targetedCollRatio))}
                  onChange={(value) => { setTargetedCollRatio(fiat, value, modifyPositionData) }}
                  min={floor4(wadToDec(minCollRatio))}
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  step={0.001}
                  reverse
                  marks={{
                    [(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Safe',
                    },
                    [floor4(wadToDec(minCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Unsafe',
                    },
                  }}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            return `${floor2(scaleToDec(maxUnderliersToSell, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to cover flashloan (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            const underliersToWithdraw = minUnderliersToBuy.sub(maxUnderliersToSell);
            return `${floor2(scaleToDec(underliersToWithdraw, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (includes slippage)'}
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
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (leverStore.decreaseState.subTokenAmount.isZero() && leverStore.decreaseState.subDebt.isZero()) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await sellCollateralAndDecreaseLever(
                leverStore.decreaseState.subTokenAmount,
                leverStore.decreaseState.subDebt,
                leverStore.decreaseState.maxUnderliersToSell,
                leverStore.decreaseState.minUnderliersToBuy
              );
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

export const LeverRedeemForm = ({
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever,
}: {
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
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
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    position
  } = modifyPositionData;
  const {
    subTokenAmount, underlierSlippagePct,
    maxUnderliersToSell, targetedCollRatio, underliersToRedeem,
    collateral, collRatio, debt, minCollRatio, maxCollRatio
  } = leverStore.redeemState;
  
  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
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
        <Input
          disabled={disableActions}
          value={floor2(scaleToDec(subTokenAmount, tokenScale))}
          onChange={(event) => {
            leverStore.redeemActions.setSubTokenAmount(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and redeem'
              onMaxClick={() => leverStore.redeemActions.setMaxSubTokenAmount(fiat, modifyPositionData)}
            />
          }
          labelRight={modifyPositionData.collateralType.metadata.symbol}
          bordered
          size='sm'
          borderWeight='light'
          width={'100%'}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <Input
            disabled={disableActions}
            value={floor2(Number(wadToDec(underlierSlippagePct)) * 100)}
            onChange={(event) => {
              leverStore.redeemActions.setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData);
            }}
            step='0.01'
            placeholder='0'
            inputMode='decimal'
            label='Slippage (Underlier to FIAT swap)'
            labelRight={'%'}
            bordered
            size='sm'
            borderWeight='light'
            width='15.0rem'
          />
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <Slider
                  handleStyle={{ borderColor: '#0072F5' }}
                  included={false}
                  disabled={disableActions}
                  value={Number(wadToDec(targetedCollRatio))}
                  onChange={(value) => {
                    leverStore.redeemActions.setTargetedCollRatio(fiat, value, modifyPositionData);
                  }}
                  min={floor4(wadToDec(minCollRatio))}
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  step={0.001}
                  reverse
                  marks={{
                    [(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Safe',
                    },
                    [floor4(wadToDec(minCollRatio))]: {
                      style: {
                      color: 'grey',
                      fontSize: '0.75rem',
                      borderColor: 'white',
                    },
                    label: 'Unsafe',
                    },
                  }}
                />
              </Card.Body>
            </Card>
          </>
        )}
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            return `${floor2(scaleToDec(maxUnderliersToSell, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to cover flashloan (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            const underliersToWithdraw = underliersToRedeem.sub(maxUnderliersToSell);
            return `${floor2(scaleToDec(underliersToWithdraw, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to redeem'}
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
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (leverStore.redeemState.subTokenAmount.isZero() && leverStore.redeemState.subDebt.isZero()) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await redeemCollateralAndDecreaseLever(
                leverStore.redeemState.subTokenAmount,
                leverStore.redeemState.subDebt,
                leverStore.redeemState.maxUnderliersToSell
              );
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
