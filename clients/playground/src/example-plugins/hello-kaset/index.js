export default {
  async activate(ctx) {
    await ctx.api.call("log.info", { message: "Hello Kaset plugin activated" });
  },
};
