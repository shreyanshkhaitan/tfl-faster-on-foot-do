import { Slider as BaseSlider } from '@base-ui/react/slider';
import { useRef } from 'react';

type SliderProps = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    ariaLabel?: string;
    className?: string;
    onValueChange: (value: number) => void;
    onInteractionChange: (isInteracting: boolean) => void;
};

export function Slider({
    value,
    min = 0,
    max = 100,
    step = 1,
    ariaLabel = 'Control slider',
    className = 'w-full',
    onValueChange,
    onInteractionChange
}: SliderProps) {
    const hasOngoingInteraction = useRef(false);
    return (
        <BaseSlider.Root
            min={min}
            max={max}
            step={step}
            value={value}
            onValueChange={(nextValue) => {
                hasOngoingInteraction.current = true;
                onInteractionChange(true);
                onValueChange(nextValue);
            }}
            onValueCommitted={(nextValue) => {
                onValueChange(nextValue);
                onInteractionChange(false);
                hasOngoingInteraction.current = false;
            }}
            className={className}
        >
            <BaseSlider.Control className="flex w-full touch-none items-center py-2 select-none">
                <BaseSlider.Track className="h-1.5 w-full rounded-full bg-[var(--muted)] shadow-[inset_0_0_0_1px_var(--border)] select-none">
                    <BaseSlider.Indicator
                        className={`rounded-full bg-amber-500 select-none ${hasOngoingInteraction.current ? '' : 'transition-all'}`}
                    />
                    <BaseSlider.Thumb
                        aria-label={ariaLabel}
                        className={`size-4 rounded-full border-2 border-amber-500 bg-[var(--background)] shadow-sm select-none has-focus-visible:outline-2 has-focus-visible:outline-amber-400 ${hasOngoingInteraction.current ? '' : 'transition-all'}`}
                    />
                </BaseSlider.Track>
            </BaseSlider.Control>
        </BaseSlider.Root>
    );
}
