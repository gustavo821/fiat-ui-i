import { Label } from '@radix-ui/react-label';
import * as RadixSlider from '@radix-ui/react-slider';
import { useMemo } from 'react';
import styles from './Slider.module.css';

interface SliderProps extends RadixSlider.SliderProps {
  maxLabel?: string;
  minLabel?: string;
  // This color variant defined explicitly in props because we need to apply different styles based on inverted prop
  color?: 'gradient';
}

export const Slider = (props: SliderProps) => {
  const {
    'aria-label': ariaLabel,
    color,
    disabled,
    inverted,
    max,
    maxLabel,
    min,
    minLabel,
    onValueChange,
    step,
    value,
  } = props;

  const sliderStyles = useMemo((): string => {
    const sliderStyles = [styles.SliderTrack];
    if (color === 'gradient' && inverted) {
      sliderStyles.push(styles.SliderTrack_GradientInverted);
    } else if (color === 'gradient' && !inverted) {
      sliderStyles.push(styles.SliderTrack_Gradient);
    }
    return sliderStyles.join(' ');
  }, [color, inverted]);

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
        <RadixSlider.Track className={sliderStyles}>
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
};
