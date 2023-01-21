import { Dropdown, Modal, Navbar, Text } from '@nextui-org/react';
import { BigNumber } from 'ethers';
import React, { useState } from 'react';
import { formatUnixTimestamp, scaleAndConvertMaturity } from '../../utils';
import { CreateForm, DecreaseForm, IncreaseForm, RedeemForm } from './BorrowForms';
import { LeverCreateForm, LeverDecreaseForm, LeverIncreaseForm, LeverRedeemForm } from './LeverForms';
import useStore from '../../state/stores/globalStore';
import { USE_FORK } from '../HeaderBar';

const enum Mode {
  CREATE='create',
  INCREASE='increase',
  DECREASE='decrease',
  REDEEM='redeem',
}

interface PositionModalProps {
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
  createLeveredPosition: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  buyCollateralAndIncreaseLever: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  sellCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber, minUnderlierToBuy: BigNumber) => any;
  redeemCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  unsetUnderlierAllowanceForProxy: (fiat: any) => any;
  open: boolean;
  onClose: () => void;
}

export const PositionModal = (props: PositionModalProps) => {
  const disableActions = useStore((state) => state.disableActions);
  return (
    <Modal
      preventClose
      closeButton={!disableActions}
      blur
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <PositionModalBody {...props} />
    </Modal>
  );
};

const PositionModalBody = (props: PositionModalProps) => {
  const [ leverModeActive, setLeverModeActive ] = useState(false);
  const [ actionMode, setActionMode ] = useState(Mode.INCREASE);

  const disableActions = useStore((state) => state.disableActions);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const selectedCollateralTypeId = useStore((state) => state.selectedCollateralTypeId);
  const selectedPositionId = useStore((state) => state.selectedPositionId);
  const ganacheTime = useStore((state => state.ganacheTime));
  const getGanacheTime = useStore((state) => state.getGanacheTime);

  const vaultType = modifyPositionData?.collateralType?.properties?.vaultType;

  const matured = React.useMemo(() => {
    if (USE_FORK) {
      const maturity = modifyPositionData.collateralType?.properties.maturity;
      return (maturity !== undefined && !(ganacheTime < scaleAndConvertMaturity(maturity)));
    }
    const maturity = modifyPositionData.collateralType?.properties.maturity;
    return (maturity !== undefined && !(new Date() < scaleAndConvertMaturity(maturity)));
  }, [modifyPositionData.collateralType?.properties.maturity, ganacheTime])

  React.useEffect(() => {
    if (!USE_FORK) return;
    getGanacheTime();
  }, [getGanacheTime])

  React.useEffect(() => {
    // Set initial mode of modal depending on props
    if (!!selectedCollateralTypeId && actionMode !== Mode.CREATE) {
      setActionMode(Mode.CREATE);
    } else if (modifyPositionData.position && matured && actionMode !== Mode.REDEEM) {
      setActionMode(Mode.REDEEM);
    }  
    // these deps _are_ exhaustive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifyPositionData.position, actionMode, setActionMode, selectedCollateralTypeId, matured, ganacheTime])

  if (!modifyPositionData.collateralType || !modifyPositionData.collateralType.metadata ) {
    // TODO: add skeleton components instead of null
    return null;
  }

  const renderNavbarLinks = () => {
    if (!modifyPositionData.position) {
      return <Navbar.Link isDisabled={disableActions} isActive>Create</Navbar.Link>
    }

    if (!matured) {
      return (
        <>
          <Navbar.Link
            isDisabled={disableActions}
            isActive={actionMode === Mode.INCREASE}
            onClick={() => {
              if (disableActions) return;
              setActionMode(Mode.INCREASE);
            }}
          >
            Increase
          </Navbar.Link>
          <Navbar.Link
            isDisabled={disableActions}
            isActive={actionMode === Mode.DECREASE}
            onClick={() => {
              if (disableActions) return;
              setActionMode(Mode.DECREASE);
            }}
          >
            Decrease
          </Navbar.Link>
        </>
      );
    } else {
      return (
        <Navbar.Link isDisabled={disableActions || !matured} isActive={actionMode === Mode.REDEEM}>
          Redeem
        </Navbar.Link>
      );
    }
  }

  const renderForm = () => {
    if (leverModeActive) {
      if (vaultType === 'ERC1155:FC') {
        return (
          <Text css={{marginBottom: '10px'}} >
            FIAT I currently does not provide 1-click leverage for Notional Finance. Please use <a href='https://beta.notional.finance/vaults' target='_blank' rel='noreferrer'>https://beta.notional.finance/vaults</a>
          </Text>
        )
      }
      return !!selectedCollateralTypeId && actionMode === Mode.CREATE
          ? <LeverCreateForm
              createLeveredPosition={props.createLeveredPosition}
              setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
              unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
              onClose={props.onClose}
          />
          : !!selectedPositionId && actionMode === Mode.INCREASE
          ? <LeverIncreaseForm
              buyCollateralAndIncreaseLever={props.buyCollateralAndIncreaseLever}
              setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
              unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.DECREASE
          ? <LeverDecreaseForm
              sellCollateralAndDecreaseLever={props.sellCollateralAndDecreaseLever}
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.REDEEM
          ? <LeverRedeemForm
              redeemCollateralAndDecreaseLever={props.redeemCollateralAndDecreaseLever}
              onClose={props.onClose}
            />
          : null
    } else {
      return !!selectedCollateralTypeId && actionMode === Mode.CREATE
          ? <CreateForm
              onClose={props.onClose}
              createPosition={props.createPosition}
              setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
              unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
          />
          : !!selectedPositionId && actionMode === Mode.INCREASE
          ? <IncreaseForm
              onClose={props.onClose}
              buyCollateralAndModifyDebt={props.buyCollateralAndModifyDebt}
              setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
              unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
              
            />
          : !!selectedPositionId && actionMode === Mode.DECREASE
          ? <DecreaseForm
              onClose={props.onClose}
              setFIATAllowanceForProxy={props.setFIATAllowanceForProxy}
              unsetFIATAllowanceForProxy={props.unsetFIATAllowanceForProxy}
              setFIATAllowanceForMoneta={props.setFIATAllowanceForMoneta}
              sellCollateralAndModifyDebt={props.sellCollateralAndModifyDebt}
            />
          : !!selectedPositionId && actionMode === Mode.REDEEM
          ? <RedeemForm
              onClose={props.onClose}
              setFIATAllowanceForProxy={props.setFIATAllowanceForProxy}
              unsetFIATAllowanceForProxy={props.unsetFIATAllowanceForProxy}
              setFIATAllowanceForMoneta={props.setFIATAllowanceForMoneta}
              redeemCollateralAndModifyDebt={props.redeemCollateralAndModifyDebt}
            />
          : null
    }
  }

  if (!modifyPositionData.position && matured) {
    return (
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>Matured Asset</Text>
          <br />
          <Text b size={16}>{`${modifyPositionData.collateralType.metadata.protocol} - ${modifyPositionData.collateralType.metadata.asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(modifyPositionData.collateralType.properties.maturity)}`}</Text>
        </Text>
      </Modal.Header>
    );
  }

  return (
    <>
      <Modal.Header justify='center'>
        <Dropdown isDisabled={disableActions} >
          <Dropdown.Button css={{ width: '50%' }} >{`Mode: ${(!leverModeActive) ? 'Borrow' : 'Leverage'}`}</Dropdown.Button>
          <Dropdown.Menu
            aria-label='Static Actions'
            onAction={(key) => setLeverModeActive(key === 'Leverage')}
          >
            <Dropdown.Item key='Borrow'>Borrow</Dropdown.Item>
            <Dropdown.Item key='Leverage'>Leverage</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        </Modal.Header>
        <Modal.Header>
          <Text id='modal-title' size={18}>
            <Text b size={18}>
              {actionMode === Mode.CREATE ? 'Create' : 'Modify'} Position
            </Text>
            <br />
            <Text b size={16}>{`${modifyPositionData.collateralType.metadata.protocol} - ${modifyPositionData.collateralType.metadata.asset}`}</Text>
            <br />
            <Text b size={14}>{`${formatUnixTimestamp(modifyPositionData.collateralType?.properties.maturity)}`}</Text>
          </Text>
        </Modal.Header>
      <Modal.Body>
        { !(leverModeActive && vaultType === 'ERC1155:FC') && 
          <Navbar
            variant='static'
            isCompact
            disableShadow
            disableBlur
            containerCss={{ justifyContent: 'center', background: 'transparent' }}
          >
            <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
              { renderNavbarLinks() }
            </Navbar.Content>
          </Navbar> 
        }
      </Modal.Body>

      { renderForm() }
    </>
  );
};
