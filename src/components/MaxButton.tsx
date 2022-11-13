import { styled } from '@nextui-org/react';

export const MaxButton = styled('button', {
  // base styles
  backgroundColor: 'transparent',
  border: 'none',
  color: '$primary',
  cursor: 'pointer',
  fontWeight: '600',
  opacity: '1',
  padding: '4px 6px',
  pointerEvents: 'initial',

  '&:hover': {
    color: '$primaryLightActive',
  },
});
