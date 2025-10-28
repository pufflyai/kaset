import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@chakra-ui/react";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { TimelineFromJSON } from "../components/timeline";
import { invocationsToTimeline } from "../conversation/invocations-to-timeline";
import { sampleToolInvocations } from "./mocks/conversation";

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
  title: "Kas UI/Timeline",
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
    invocations: [sampleToolInvocations.pending, sampleToolInvocations.complete, sampleToolInvocations.error],
  },
};
