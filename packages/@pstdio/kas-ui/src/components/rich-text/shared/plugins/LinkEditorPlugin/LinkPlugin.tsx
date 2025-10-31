import { LinkPlugin as LexicalLinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { validateUrl } from "./utils/url";

export default function LinkPlugin(): React.JSX.Element {
  return <LexicalLinkPlugin validateUrl={validateUrl} />;
}
