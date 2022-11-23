import React from 'react';
import { Badge, Button } from '@nextui-org/react';
import { InfoIcon } from './Icons/info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
      <div style={{ display: 'flex', height: '40px' }}>
        <Button 
          auto
          icon={<InfoIcon fillColor='var(--rk-colors-connectButtonText)'/>}
          css={connectButtonCSS}
          onPress={()=>setShowResourcesModal(true)}
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
      <ResourcesModal 
        open={showResourcesModal}
        onClose={() => setShowResourcesModal(false)}
      />
    </div>
  );
}
