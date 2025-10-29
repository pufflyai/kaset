import type { BoxProps } from "@chakra-ui/react";
import { Box } from "@chakra-ui/react";
import { memo } from "react";
import { RichMessage } from "./rich-text/message/message.tsx";

export interface ResponseProps extends Omit<BoxProps, "children"> {
  children: any;
}

export const Response = memo(
  function Response(props: ResponseProps) {
    const { children, ...rest } = props;

    return (
      <Box boxSize="full" {...rest}>
        <RichMessage defaultState={children} />
      </Box>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
