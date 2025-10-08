async function readSettings(ctx) {
  const stored = await ctx.settings.read();
  return { ...defaults, ...(stored ?? {}) };
}

export const commands = {
  async "hello.sayHello"(ctx, params) {
    const settings = await readSettings(ctx);
    const overrideTitle = typeof params?.title === "string" ? params.title : undefined;
    const overrideSubtitle = typeof params?.subtitle === "string" ? params.subtitle : undefined;

    const title = overrideTitle || settings.title;
    const subtitle = overrideSubtitle || settings.subtitle;

    ctx.ui.notify?.("info", `${title}\n${subtitle}`);

    if (overrideTitle || overrideSubtitle) {
      await ctx.settings.write({
        ...settings,
        ...(overrideTitle ? { title: overrideTitle } : {}),
        ...(overrideSubtitle ? { subtitle: overrideSubtitle } : {}),
      });
    }
  },
};

export default {
  async activate(ctx) {
    ctx.log.info("hello-kaset plugin activated");
  },
};
