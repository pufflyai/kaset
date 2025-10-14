const defaults = {
  greeting: "Hello",
  recipient: "Kaset",
};

async function readSettings(ctx) {
  const stored = await ctx.settings.read();
  return { ...defaults, ...(stored ?? {}) };
}

export default {
  async activate(ctx) {
    const settings = await readSettings(ctx);
    await ctx.settings.write(settings);
    ctx.log.info("hello-world plugin activated");
  },
};
