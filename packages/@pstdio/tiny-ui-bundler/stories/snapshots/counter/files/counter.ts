const initialValue = __INITIAL__;
const stepValue = __STEP__;

export const createCounter = () => {
  let value = initialValue;

  return {
    get value() {
      return value;
    },
    increment() {
      value += stepValue;
      return value;
    },
    reset() {
      value = initialValue;
    },
    describe() {
      return `initial=${initialValue}, step=${stepValue}, value=${value}`;
    },
  };
};

export type Counter = ReturnType<typeof createCounter>;
