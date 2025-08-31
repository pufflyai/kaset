export const safeParse = <T = object>(str: string) => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return str;
  }
};
