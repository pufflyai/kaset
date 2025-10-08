import { MenuItem as ChakraMenuItem, Flex, Text } from "@chakra-ui/react";
import React from "react";
import { Tooltip } from "./tooltip";

interface MenuItemProps {
  id?: string;
  children?: React.ReactNode;
  isDisabled?: boolean;
  isSelected?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  tooltipLabel?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tabIndex?: number;
  setRefElement?: any;
  onClick?: (e: any) => void;
  onMouseDown?: (e: any) => void;
  onMouseEnter?: (e: any) => void;
}

export const MenuItem = (props: MenuItemProps) => {
  const {
    id,
    primaryLabel,
    tooltipLabel,
    secondaryLabel,
    leftIcon = null,
    rightIcon = null,
    isDisabled,
    isSelected,
    tabIndex,
    setRefElement,
  } = props;
  const { onClick, onMouseDown, onMouseEnter } = props;

  return (
    <ChakraMenuItem
      id={id}
      ref={setRefElement}
      tabIndex={tabIndex}
      disabled={isDisabled}
      aria-selected={isSelected}
      paddingX="sm"
      paddingY="xxs"
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      height="auto"
      minHeight="2rem"
      role="option"
      maxWidth="20rem"
      overflow={"hidden"}
      cursor={isDisabled ? "default" : "pointer"}
      value={id ?? primaryLabel}
    >
      <Flex justifyContent="space-between" alignItems="center" gap="xs" flex="1">
        <Tooltip positioning={{ placement: "right" }} content={tooltipLabel} disabled={!tooltipLabel}>
          <Flex alignItems="center" gap="xs" flex="1">
            {leftIcon}
            <Flex gap="xxs" flexDirection="column">
              <Text textOverflow="ellipsis" textStyle="label/M/regular">
                {primaryLabel}
              </Text>
              {secondaryLabel && (
                <Text textOverflow="ellipsis" textStyle="label/S/regular" color="foreground.secondary">
                  {secondaryLabel}
                </Text>
              )}
            </Flex>
          </Flex>
        </Tooltip>
        <Flex justifyContent="flex-end" color="foreground.primary">
          {rightIcon}
        </Flex>
      </Flex>
    </ChakraMenuItem>
  );
};
