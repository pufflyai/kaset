import { registerSources } from "../core/sources";
import { loadSnapshot } from "./loadSnapshot";

export async function loadSourceFiles(source: { id: string; root: string; entrypoint: string }) {
  registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);
  await loadSnapshot(source.root.replace(/^\//, ""), source.entrypoint);
}
