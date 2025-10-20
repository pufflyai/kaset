export default {
  async activate(ctx) {
    await ctx.api.call("log.info", { message: "Todo plugin activated" });
  },
};
