export type Path = string;
export type SourceId = string;

export interface SourceConfig {
  id: SourceId;
  root: Path;
  entry?: Path;
  tsconfigPath?: Path;
  include?: RegExp[];
  exclude?: RegExp[];
}

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
