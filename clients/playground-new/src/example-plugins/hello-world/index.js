const defaults = {
  greeting: "Hello",
  recipient: "Kaset",
};

async function readSettings(ctx) {
  const stored = await ctx.settings.read();
  return { ...defaults, ...(stored ?? {}) };
}

export const commands = {
  async "hello.sayHello"(ctx, params) {
    const settings = await readSettings(ctx);
    const overrideGreeting = typeof params?.greeting === "string" ? params.greeting : undefined;
    const overrideRecipient = typeof params?.recipient === "string" ? params.recipient : undefined;

    const greeting = overrideGreeting || settings.greeting || defaults.greeting;
    const recipient = overrideRecipient || settings.recipient || defaults.recipient;

    ctx.ui.notify?.("info", `${greeting}, ${recipient}!`);

    if (overrideGreeting || overrideRecipient) {
      await ctx.settings.write({
        ...settings,
        ...(overrideGreeting ? { greeting: overrideGreeting } : {}),
        ...(overrideRecipient ? { recipient: overrideRecipient } : {}),
      });
    }
  },
};

export default {
  async activate(ctx) {
    const settings = await readSettings(ctx);
    await ctx.settings.write(settings);
    ctx.log.info("hello-world plugin activated");
  },
};
