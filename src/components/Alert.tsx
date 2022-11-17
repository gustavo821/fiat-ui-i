// Icons from: https://icons.radix-ui.com/
import { Text, Tooltip } from '@nextui-org/react';

export const InfoIcon = (props: any) => {
  return (
    <svg width='15' height='15' viewBox='0 0 15 15' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM8.24992 4.49999C8.24992 4.9142 7.91413 5.24999 7.49992 5.24999C7.08571 5.24999 6.74992 4.9142 6.74992 4.49999C6.74992 4.08577 7.08571 3.74999 7.49992 3.74999C7.91413 3.74999 8.24992 4.08577 8.24992 4.49999ZM6.00003 5.99999H6.50003H7.50003C7.77618 5.99999 8.00003 6.22384 8.00003 6.49999V9.99999H8.50003H9.00003V11H8.50003H7.50003H6.50003H6.00003V9.99999H6.50003H7.00003V6.99999H6.50003H6.00003V5.99999Z'
        fill={props.fill}
        fillRule='evenodd'
        clipRule='evenodd'
      ></path>
    </svg>
  );
};

export const WarningTriangle = (props: any) => {
  return (
    <svg width='15' height='15' viewBox='0 0 15 15' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M8.4449 0.608765C8.0183 -0.107015 6.9817 -0.107015 6.55509 0.608766L0.161178 11.3368C-0.275824 12.07 0.252503 13 1.10608 13H13.8939C14.7475 13 15.2758 12.07 14.8388 11.3368L8.4449 0.608765ZM7.4141 1.12073C7.45288 1.05566 7.54712 1.05566 7.5859 1.12073L13.9798 11.8488C14.0196 11.9154 13.9715 12 13.8939 12H1.10608C1.02849 12 0.980454 11.9154 1.02018 11.8488L7.4141 1.12073ZM6.8269 4.48611C6.81221 4.10423 7.11783 3.78663 7.5 3.78663C7.88217 3.78663 8.18778 4.10423 8.1731 4.48612L8.01921 8.48701C8.00848 8.766 7.7792 8.98664 7.5 8.98664C7.2208 8.98664 6.99151 8.766 6.98078 8.48701L6.8269 4.48611ZM8.24989 10.476C8.24989 10.8902 7.9141 11.226 7.49989 11.226C7.08567 11.226 6.74989 10.8902 6.74989 10.476C6.74989 10.0618 7.08567 9.72599 7.49989 9.72599C7.9141 9.72599 8.24989 10.0618 8.24989 10.476Z'
        fill={props.fill}
        fillRule='evenodd'
        clipRule='evenodd'
      ></path>
    </svg>
  );
};

// TODO: Copy message to clipboard on click (like aave), or guarantee human readable messages
export const Alert = ({ severity, message }: { severity: 'error' | 'warning', message: string }) => {
  return (
    <Tooltip
      style={{
        width: '100%',
        border: `1px solid var(--nextui-colors-${severity})`,
        borderRadius: 'var(--nextui-radii-md)',
        padding: '.25rem 1rem .25rem 1rem',
      }}
      trigger='hover'
      css={{
        zIndex: '999999 !important',
      }}
      content={
        <div
          style={{
            maxWidth: '24rem',
            wordWrap: 'break-word',
          }}
        >
          <Text
            style={{
              wordWrap: 'break-word',
            }}
          >
            {message}
          </Text>
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {severity === 'error' ? <InfoIcon fill={`var(--nextui-colors-${severity})`} /> : severity === 'warning' ? <WarningTriangle fill={`var(--nextui-colors-${severity})`} /> : null}
        </div>
        <Text
          color={severity}
          style={{
            maxWidth: '40ch',
            textAlign: 'left',
            marginLeft: '0.5rem',
          }}
        >
          {message}
        </Text>
      </div>
    </Tooltip>
  );
};
