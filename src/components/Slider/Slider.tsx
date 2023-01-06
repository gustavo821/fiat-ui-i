import { Label } from '@radix-ui/react-label';
import * as RadixSlider from '@radix-ui/react-slider';
import styles from './RadixSlider.module.css';

interface SliderProps extends RadixSlider.SliderProps {
  maxLabel?: string;
  minLabel?: string;
}

export const Slider = (props: SliderProps) => {
  const { 'aria-label': ariaLabel, disabled, inverted, max, maxLabel, min, minLabel, onValueChange, step, value } = props;

  return (
    <>
      <RadixSlider.Root
        aria-label={ariaLabel}
        disabled={disabled}
        className={styles.SliderRoot}
        inverted={inverted}
        max={max}
        min={min}
        onValueChange={onValueChange}
        step={step}
        value={value}
      >
        <RadixSlider.Track
          className={styles.SliderTrack}
          /* gradient for non linear coll ratio riskiness. should probably impl as a variant
          style={{
            backgroundImage:
              inverted ? 'linear-gradient(90deg, var(--nextui-colors-success) 0%, var(--nextui-colors-warning) 95%, var(--nextui-colors-error) 100%)' :  'linear-gradient(90deg, var(--nextui-colors-error) 0%, var(--nextui-colors-warning) 5%, var(--nextui-colors-success) 100%)',
          }}
           */
        >
          <RadixSlider.Range className={styles.SliderRange} />
        </RadixSlider.Track>
        <RadixSlider.Thumb className={styles.SliderThumb} />
      </RadixSlider.Root>

      <div className={styles.SliderLabels}>
        <Label className={styles.SliderLabel}>{inverted ? maxLabel : minLabel}</Label>
        <Label className={styles.SliderLabel}>{inverted ? minLabel : maxLabel}</Label>
      </div>
    </>
  );
}
