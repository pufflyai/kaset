export type Path = string;
export type SourceId = string;

/**
 * Describes a micro frontend source tree that the host registers with tiny-ui. The compile
 * pipeline reads these configs to know where the source lives (`root`), which module to treat as
 * the entry point, and which files to include or ignore when building snapshots.
 */
export interface SourceConfig {
  id: SourceId;
  root: Path;
  entry?: Path;
  tsconfigPath?: Path;
  include?: RegExp[];
  exclude?: RegExp[];
}

/**
 * Holds host-registered micro frontend source configs keyed by id. The compile pipeline and other
 * host services look them up when reading snapshots, so clones prevent callers from mutating the
 * registry's stored state.
 */
const sources = new Map<SourceId, SourceConfig>();

const cloneConfig = (config: SourceConfig): SourceConfig => ({
  ...config,
  include: config.include ? [...config.include] : undefined,
  exclude: config.exclude ? [...config.exclude] : undefined,
});

export const registerSources = (configs: SourceConfig[]) => {
  configs.forEach((config) => {
    sources.set(config.id, cloneConfig(config));
  });
};

export const updateSource = (config: SourceConfig) => {
  sources.set(config.id, cloneConfig(config));
};

export const removeSource = (id: SourceId) => {
  sources.delete(id);
};

export const listSources = () => Array.from(sources.values()).map(cloneConfig);

export const getSource = (id: SourceId) => {
  const match = sources.get(id);
  if (!match) return undefined;
  return cloneConfig(match);
};
