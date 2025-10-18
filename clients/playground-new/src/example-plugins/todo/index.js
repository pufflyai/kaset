export default {
  async activate(ctx) {
    await ctx.api["log.info"]("Todo plugin activated");
  },
};
