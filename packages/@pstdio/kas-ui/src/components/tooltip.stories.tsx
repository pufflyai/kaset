import type { Meta, StoryObj } from "@storybook/react";
import { Box, Button, Menu, Stack } from "@chakra-ui/react";
import { Info, Play, Square } from "lucide-react";
import { Tooltip } from "./tooltip";
import { MenuItem } from "./menu-item";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

export const TooltipExample: Story = {
  render: () => (
    <Tooltip content="Kaset keeps track of your agent conversations.">
      <Button>
        Hover for details
        <Info size={16} />
      </Button>
    </Tooltip>
  ),
};

export const MenuExample: Story = {
  render: () => (
    <Box>
      <Menu.Root>
        <Menu.Trigger>
          <Button colorScheme="blue">Open tools</Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Stack py="xs" px="2xs" gap="2xs">
              <MenuItem
                id="run"
                primaryLabel="Run workflow"
                secondaryLabel="⌘R"
                tooltipLabel="Executes the selected Kas workflow."
                leftIcon={<Play size={16} />}
              />
              <MenuItem
                id="stop"
                primaryLabel="Stop run"
                secondaryLabel="⌘."
                tooltipLabel="Stops all active tool invocations."
                leftIcon={<Square size={16} />}
              />
            </Stack>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Box>
  ),
};
