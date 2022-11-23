import React from 'react';
import { Badge, Button } from '@nextui-org/react';
import { InfoIcon } from './Icons/info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { InfoModal } from './InfoModal';

export const HeaderButtons = (props: any) => {
  const [showInfoModal, setShowInfoModal] = React.useState<boolean>(false);

  return (
    <>
      {/* Header Buttons */}
      <div style={{ display: 'flex', height: '40px'}}>
        <Button 
          auto
          icon={<InfoIcon fillColor='var(--rk-colors-connectButtonText)'/>}
          css={connectButtonCSS}
          onPress={()=>setShowInfoModal(true)}
        />
        <ProxyButton
          {...props.contextData}
          createProxy={props.createProxy}
          disableActions={props.disableActions}
          transactionData={props.transactionData}
        />
        {(props.contextData?.fiatBalance) && 
          <Badge 
            css={connectButtonCSS}
          >
            {props.contextData.fiatBalance}
          </Badge>
        }
        <div className='connectWrapper'>
          <ConnectButton showBalance={false} />
        </div>
      </div>
      {/* Info Modal */}
      <InfoModal 
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
    </>
  );
}
