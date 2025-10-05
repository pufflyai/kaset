const defaults = {
  greeting: "Hello",
  recipient: "Kaset",
};

async function readSettings(ctx) {
  const stored = await ctx.settings.read();
  return { ...defaults, ...(stored ?? {}) };
}

export const commands = {
  async "hello.sayHello"(ctx) {
    const settings = await readSettings(ctx);
    const greeting = settings.greeting || defaults.greeting;
    const recipient = settings.recipient || defaults.recipient;

    ctx.ui.notify?.("info", `${greeting}, ${recipient}!`);
  },
};

export default {
  async activate(ctx) {
    const settings = await readSettings(ctx);
    await ctx.settings.write(settings);
    ctx.log.info("hello-world plugin activated");
  },
};
