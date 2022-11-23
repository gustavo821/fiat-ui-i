import React from 'react';
import Image from 'next/image';
import { Badge, Button } from '@nextui-org/react';
import { InfoIcon } from './Icons/info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';
import { useTheme } from '@nextui-org/react';

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);
  const { theme } = useTheme();
  const darkTheme = theme?.colors.background.value != '#ffffff';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 0 }}>
      { darkTheme ? 
        (<div style={{ marginLeft: 12 }} >
          <Image alt="" src="/logo-dark.png" layout="fixed" objectFit={'contain'} width={140} height={69} />
        </div>)
        :
        (<div style={{ margin: 12 }} >
          <Image alt="" src="/logo-white.png" layout="fixed" objectFit={'contain'} width={140} height={45} />
        </div>)
      }
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
    </div>
  );
}
