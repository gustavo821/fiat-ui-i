import { decToScale, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text, Tooltip } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useCallback, useMemo } from 'react';
import shallow from 'zustand/shallow';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { commifyToDecimalPlaces, floor2, floor4, minCollRatioWithBuffer } from '../../../utils';
import { Alert } from '../../Alert';
import { NumericInput } from '../../NumericInput/NumericInput';
import { Slider } from '../../Slider/Slider';
import { useSetUnderlierAllowanceForProxy, useUnsetUnderlierAllowanceForProxy } from '../../../hooks/useSetAllowance';
import { buildBuyCollateralAndModifyDebtArgs, sendTransaction } from '../../../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useSoftReset from '../../../hooks/useSoftReset';
import { useUserData } from '../../../state/queries/useUserData';

const CreateForm = ({
  onClose,
}: {
  onClose: () => void,
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
  const user = useStore((state) => state.user);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const { action: currentTxAction } = transactionData;

  const setUnderlierAllowanceForProxy = useSetUnderlierAllowanceForProxy();
  const unsetUnderlierAllowanceForProxy = useUnsetUnderlierAllowanceForProxy();

  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const createPosition = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const args = buildBuyCollateralAndModifyDebtArgs(
      fiat, user, proxies, modifyPositionData.collateralType, deltaCollateral, deltaDebt, underlier
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'createPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create position' });
    softReset();
  }, [addRecentTransaction, fiat, modifyPositionData.collateralType, proxies, softReset, user]);

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
          content={'The targeted collateralization ratio of the position.'}
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={
                <>
                  The collateralization ratio is the ratio of the value of the collateral (fair price) divided by the
                  outstanding debt (FIAT) drawn against it. The fair price is derived from the spot price of the
                  underlier denominated in USD and a discounting model that the protocol applies for accounting for the
                  time value of money of the fixed term asset.
                  <br />
                  The following formula is used:
                  <InlineMath math="\text{collRatio} = \frac{\text{collateral}*\text{fairPrice}}{\text{debt}}"/>
                  <br />
                </>
              }
            >
              Collateralization Ratio
            </Tooltip>
          }
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
                  await unsetUnderlierAllowanceForProxy();
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setUnderlierAllowanceForProxy(underlierBN);
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

export default CreateForm;
