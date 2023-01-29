import { Card, Dropdown, Modal, Navbar, Text } from '@nextui-org/react';
import React, { useState } from 'react';
import { formatUnixTimestamp, getTimestamp } from '../../utils';
import CreateForm from './BorrowForms/CreateForm';
import DecreaseForm from './BorrowForms/DecreaseForm';
import IncreaseForm from './BorrowForms/IncreaseForm';
import RedeemForm from './BorrowForms/RedeemForm';
import LeverCreateForm from './LeverForms/LeverCreateForm';
import LeverDecreaseForm from './LeverForms/LeverDecreaseForm';
import LeverIncreaseForm from './LeverForms/LeverIncreaseForm';
import LeverRedeemForm from './LeverForms/LeverRedeemForm';
import useStore from '../../state/stores/globalStore';

const enum Mode {
  CREATE='create',
  INCREASE='increase',
  DECREASE='decrease',
  REDEEM='redeem',
}

interface PositionModalProps {
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

  const vaultType = modifyPositionData?.collateralType?.properties?.vaultType;

  const matured = React.useMemo(() => {
    const now = getTimestamp();
    const maturity = modifyPositionData.collateralType?.properties.maturity;
    return (maturity !== undefined && !(now.lt(maturity)));
  }, [modifyPositionData.collateralType?.properties.maturity]);

  React.useEffect(() => {
    // Set initial mode of modal depending on props
    if (!!selectedCollateralTypeId && actionMode !== Mode.CREATE) {
      setActionMode(Mode.CREATE);
    } else if (modifyPositionData.position && matured && actionMode !== Mode.REDEEM) {
      setActionMode(Mode.REDEEM);
    }  
    // these deps _are_ exhaustive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifyPositionData.position, actionMode, setActionMode, selectedCollateralTypeId, matured])

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
              onClose={props.onClose}
          />
          : !!selectedPositionId && actionMode === Mode.INCREASE
          ? <LeverIncreaseForm
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.DECREASE
          ? <LeverDecreaseForm
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.REDEEM
          ? <LeverRedeemForm
              onClose={props.onClose}
            />
          : null
    } else {
      return !!selectedCollateralTypeId && actionMode === Mode.CREATE
          ? <CreateForm
              onClose={props.onClose}
          />
          : !!selectedPositionId && actionMode === Mode.INCREASE
          ? <IncreaseForm
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.DECREASE
          ? <DecreaseForm
              onClose={props.onClose}
            />
          : !!selectedPositionId && actionMode === Mode.REDEEM
          ? <RedeemForm
              onClose={props.onClose}
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
          <Dropdown.Button css={{ width: '50%' }}>
            {`Mode: ${(!leverModeActive) ? 'Borrow' : 'Leverage'}`}
          </Dropdown.Button>
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
        {!(leverModeActive && vaultType === 'ERC1155:FC') && (
          <>
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
            {!(leverModeActive) && (
              <Card variant='bordered'>
                <Card.Body>
                  <Text size={14}>
                    Borrow FIAT against your collateral up to a certain minimum collateralization ratio threshold.
                  </Text>
                </Card.Body>
              </Card>
            )}
            {(leverModeActive) && (
              <Card variant='bordered'>
                <Card.Body>
                  <Text size={14}>
                    Use FIAT liquidity to multiply your exposure to collateral yield.
                  </Text>
                </Card.Body>
              </Card>
            )}
          </>
        )}
      </Modal.Body>

      { renderForm() }
    </>
  );
};
