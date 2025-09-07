import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import KatexRenderer from "./KatexRenderer";

type EquationComponentProps = {
  equation: string;
  inline: boolean;
};

export default function EquationComponent({ equation, inline }: EquationComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [equationValue, _setEquationValue] = useState(equation);
  useRef(null);
  return (
    <>
      <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
        <KatexRenderer equation={equationValue} inline={inline} onDoubleClick={() => null} />
      </ErrorBoundary>
    </>
  );
}
