export default {
  async activate(ctx) {
    await ctx.api["log.info"]("hello-kaset plugin activated");
  },
};
