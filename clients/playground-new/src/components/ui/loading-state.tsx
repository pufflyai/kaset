import { LoadingKasetAnimation } from "@/components/animations";
import { EmptyState as ChakraEmptyState, chakra } from "@chakra-ui/react";
import * as React from "react";

export interface LoadingStateProps extends ChakraEmptyState.RootProps {
  title: string;
  speed?: number;
  animationSize?: string | number;
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(function LoadingState(props, ref) {
  const { title, speed = 1, animationSize = "120px", children, ...rest } = props;

  return (
    <ChakraEmptyState.Root ref={ref} {...rest}>
      <ChakraEmptyState.Content>
        <ChakraEmptyState.Indicator color="foreground.primary">
          <chakra.div boxSize={animationSize}>
            <LoadingKasetAnimation loop autoplay speed={speed} />
          </chakra.div>
        </ChakraEmptyState.Indicator>
        <ChakraEmptyState.Description>{title}</ChakraEmptyState.Description>
        {children}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
});
