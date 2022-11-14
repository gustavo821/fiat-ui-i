import { styled } from '@nextui-org/react';

const MaxButton = styled('button', {
  // base styles
  backgroundColor: 'transparent',
  border: 'none',
  color: '$primary',
  cursor: 'pointer',
  fontWeight: '600',
  opacity: '1',
  padding: '0 0.125rem 0 0.125rem',
  pointerEvents: 'initial',

  '&:hover': {
    color: '$primaryLightActive',
  },
});

export const InputLabel = (props: { label: string, onMaxClick?: () => void }) => {
  return (
    <div style={{ display: 'flex' }}>
      <label
        style={{
          fontWeight: 'var(--nextui-fontWeights-normal)',
          color: 'var(--nextui--inputLabelColor)',
          padding: '0 0 0 var(--nextui-space-1)',
          fontSize: 'var(--nextui--inputFontSize)',
          lineHeight: 'var(--nextui-lineHeights-md)',
        }}
      >
        {props.label} {props.onMaxClick ? <MaxButton onClick={props.onMaxClick}>(Max)</MaxButton> : null}
      </label>
    </div>
  );
};
