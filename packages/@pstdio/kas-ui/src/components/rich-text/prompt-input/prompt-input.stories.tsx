import type { Meta, StoryObj } from "@storybook/react";
import { PromptEditor } from "./prompt-input";

const initialState = JSON.stringify(
  {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "Type your message here or press Ctrl+Enter to send.",
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
  null,
  2,
);

const meta: Meta<typeof PromptEditor> = {
  title: "Rich Text/PromptEditor",
  component: PromptEditor,
  parameters: {
    layout: "padded",
  },
  args: {
    defaultState: initialState,
    debug: false,
    isEditable: true,
    onChange: (text: string) => console.log("onChange:", text),
    onError: (error: Error) => console.error(error),
  },
  argTypes: {
    defaultState: {
      control: "text",
      description: "Serialized Lexical editor state (JSON string)",
    },
    isEditable: { control: "boolean" },
    debug: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj<typeof PromptEditor>;

export const Basic: Story = {};

export const ReadOnly: Story = {
  args: { isEditable: false },
};

export const DebugView: Story = {
  args: { debug: true },
};
