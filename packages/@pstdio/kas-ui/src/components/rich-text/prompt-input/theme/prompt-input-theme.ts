import type { EditorThemeClasses } from "lexical";
import baseTheme from "../../message/theme/message-theme";
import "./prompt-input-theme.css";

const promptInputTheme: EditorThemeClasses = {
  ...baseTheme,
  // Override paragraph class to remove margins specifically for prompt input
  paragraph: "rich-text__p rich-text__p--no-margin",
};

export default promptInputTheme;
