import { createCounter } from "./counter";
import "./styles.css";

const counter = createCounter();

counter.increment();
counter.increment();

export function describeCounter() {
  return __MESSAGE__ + " Stats: " + counter.describe();
}

console.info("[Counter Snapshot] Value after increments:", counter.value);
