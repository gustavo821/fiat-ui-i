import { Text, Tooltip } from '@nextui-org/react';
import { ReactNode } from 'react';
import { InfoIcon } from './icons/Info';

export const Hint = ({ message }: { message: ReactNode }) => {
  return (
    <Tooltip
      trigger='hover'
      css={{
        zIndex: '9999', // needed so tooltip content renders above modal
      }}
      content={
        <div style={{ maxWidth: '24rem', wordWrap: 'break-word' }}>
          <Text style={{ wordWrap: 'break-word' }}>{message}</Text>
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <InfoIcon fill='var(--nextui-colors-foreground)' />
      </div>
    </Tooltip>
  );
};
