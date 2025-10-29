import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@chakra-ui/react";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { TimelineFromJSON } from "./timeline";
import { invocationsToTimeline } from "../conversation/invocations-to-timeline";
import { sampleToolInvocations } from "../mocks/conversation";

interface TimelineStoryProps {
  invocations: ToolInvocation[];
}

const TimelineShowcase = (props: TimelineStoryProps) => {
  const { invocations } = props;
  const data = invocationsToTimeline(invocations, { labeledBlocks: true });

  return (
    <Box width="960px" maxW="100%">
      <TimelineFromJSON data={data} />
    </Box>
  );
};

const meta: Meta<typeof TimelineShowcase> = {
  title: "Components/Timeline",
  component: TimelineShowcase,
  args: {
    invocations: [sampleToolInvocations.complete],
  },
};

export default meta;

type Story = StoryObj<typeof TimelineShowcase>;

export const Pending: Story = {
  args: {
    invocations: [sampleToolInvocations.pending],
  },
};

export const CompletedDiff: Story = {
  args: {
    invocations: [sampleToolInvocations.complete],
  },
};

export const ErrorState: Story = {
  args: {
    invocations: [sampleToolInvocations.error],
  },
};

export const MixedSequence: Story = {
  args: {
    invocations: [
      sampleToolInvocations.pending,
      sampleToolInvocations.complete,
      sampleToolInvocations.error,
      sampleToolInvocations.shell,
      sampleToolInvocations.search,
    ],
  },
};

export const DirectoryListing: Story = {
  args: {
    invocations: [sampleToolInvocations.lsComplete],
  },
};

export const ReadFile: Story = {
  args: {
    invocations: [sampleToolInvocations.readFile],
  },
};

export const WriteFile: Story = {
  args: {
    invocations: [sampleToolInvocations.writeFile],
  },
};

export const ShellCommand: Story = {
  args: {
    invocations: [sampleToolInvocations.shell],
  },
};

export const SearchResults: Story = {
  args: {
    invocations: [sampleToolInvocations.search],
  },
};

export const BrowserNavigation: Story = {
  args: {
    invocations: [sampleToolInvocations.browser],
  },
};

export const MultiToolSession: Story = {
  args: {
    invocations: [
      sampleToolInvocations.search,
      sampleToolInvocations.browser,
      sampleToolInvocations.lsComplete,
      sampleToolInvocations.writeFile,
      sampleToolInvocations.complete,
    ],
  },
};
