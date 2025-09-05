import { Collapsible, Text, useCollapsible, useCollapsibleContext, useControllableState } from "@chakra-ui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { Response } from "./ai-response";

interface ReasoningContextValue {
  streaming: boolean;
  duration: number;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningRootProps = Omit<Collapsible.RootProviderProps, "value"> & {
  streaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

export const ReasoningRoot = memo(function ReasoningRoot(props: ReasoningRootProps) {
  const {
    streaming = false,
    open,
    defaultOpen = false,
    onOpenChange,
    duration: durationProp,
    children,
    ...rest
  } = props;

  const collapsible = useCollapsible({
    defaultOpen: defaultOpen || streaming,
    open,
    onOpenChange: (details) => {
      onOpenChange?.(details.open);
    },
  });

  const collapsibleRef = useRef(collapsible);
  collapsibleRef.current = collapsible;

  const [duration, setDuration] = useControllableState({
    value: durationProp,
    defaultValue: 0,
  });

  const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Track duration when streaming starts and ends
  useEffect(() => {
    if (streaming) {
      if (startTime === null) {
        setStartTime(Date.now());
      }
    } else if (startTime !== null) {
      setDuration(Math.round((Date.now() - startTime) / 1000));
      setStartTime(null);
    }
  }, [streaming, startTime, setDuration]);

  // Auto-open when streaming starts, auto-close when streaming ends (once only)
  useEffect(() => {
    const api = collapsibleRef.current;
    if (streaming && !api.open) {
      api.setOpen(true);
    } else if (!streaming && api.open && !defaultOpen && !hasAutoClosedRef) {
      // Add a small delay before closing to allow user to see the content
      const timer = setTimeout(() => {
        api.setOpen(false);
        setHasAutoClosedRef(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [streaming, defaultOpen, hasAutoClosedRef]);

  return (
    <ReasoningContext.Provider value={{ streaming, duration }}>
      <Collapsible.RootProvider className="not-prose" value={collapsible} {...rest}>
        {children}
      </Collapsible.RootProvider>
    </ReasoningContext.Provider>
  );
});

export const ReasoningTrigger = memo(function ReasoningTrigger(props: Collapsible.TriggerProps) {
  const { children, ...rest } = props;
  const { streaming, duration } = useReasoning();
  const { open } = useCollapsibleContext();

  return (
    <Collapsible.Trigger
      display="flex"
      alignItems="center"
      gap="2"
      mt="lg"
      color={{ base: "foreground.secondary", _hover: "foreground.primary" }}
      textStyle="label/M/regular"
      cursor="pointer"
      {...rest}
    >
      {children ?? (
        <>
          {streaming || duration === 0 ? (
            <Text textStyle="label/XS/regular" color="foreground.secondary">
              Thinking...
            </Text>
          ) : (
            <Text>Thought for {duration} seconds</Text>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </>
      )}
    </Collapsible.Trigger>
  );
});

export type ReasoningContentProps = Collapsible.ContentProps & {
  children: string;
  pt: string;
};

export const ReasoningContent = memo(function ReasoningContent(props: ReasoningContentProps) {
  const { children, pt = "4", ...rest } = props;
  return (
    <Collapsible.Content textStyle="label/XS/regular" color="foreground.secondary" outline="none" {...rest}>
      <Response display="grid" gap="2" pt={pt}>
        {children}
      </Response>
    </Collapsible.Content>
  );
});
