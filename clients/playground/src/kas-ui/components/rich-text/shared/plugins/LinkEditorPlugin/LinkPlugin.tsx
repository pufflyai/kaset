import { LinkPlugin as LexicalLinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { validateUrl } from "./utils/url.ts";

export default function LinkPlugin(): React.JSX.Element {
  return <LexicalLinkPlugin validateUrl={validateUrl} />;
}
