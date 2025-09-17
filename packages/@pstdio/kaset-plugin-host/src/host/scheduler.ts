import type { Disposable, Logger, Scheduler } from "./types";

interface CronSpec {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  domWildcard: boolean;
  dowWildcard: boolean;
}

const parseCronField = (field: string, min: number, max: number, map?: (value: number) => number) => {
  const values = new Set<number>();
  let wildcard = false;
  const parts = field.split(",").filter(Boolean);
  if (parts.length === 0) {
    parts.push("*");
  }
  for (const part of parts) {
    const [rangePartRaw, stepRaw] = part.split("/");
    const step = stepRaw ? Number.parseInt(stepRaw, 10) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      throw new Error(`Invalid cron step: ${part}`);
    }
    const rangePart = rangePartRaw ?? "*";
    if (rangePart === "*" || rangePart === "?") {
      wildcard = true;
      for (let value = min; value <= max; value += step) {
        values.add(map ? map(value) : value);
      }
      continue;
    }
    const [startRaw, endRaw] = rangePart.split("-");
    let start = Number.parseInt(startRaw, 10);
    let end = endRaw ? Number.parseInt(endRaw, 10) : start;
    if (!Number.isFinite(start)) {
      throw new Error(`Invalid cron range: ${part}`);
    }
    if (!Number.isFinite(end)) {
      end = start;
    }
    if (map) {
      start = map(start);
      end = map(end);
    }
    if (start > end) {
      [start, end] = [end, start];
    }
    start = Math.max(min, start);
    end = Math.min(max, end);
    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }
  return { values, wildcard };
};

const parseCronExpression = (expr: string): CronSpec => {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) {
    throw new Error(`Cron expression must have 5 fields: ${expr}`);
  }
  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = parts;
  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const months = parseCronField(monthField, 1, 12);
  const daysOfMonth = parseCronField(dayOfMonthField, 1, 31);
  const daysOfWeek = parseCronField(dayOfWeekField, 0, 6, (value) => (value === 7 ? 0 : value));
  return {
    minutes: minutes.values,
    hours: hours.values,
    months: months.values,
    daysOfMonth: daysOfMonth.values,
    daysOfWeek: daysOfWeek.values,
    domWildcard: daysOfMonth.wildcard,
    dowWildcard: daysOfWeek.wildcard,
  };
};

const getNextOccurrence = (spec: CronSpec, from: Date): Date | null => {
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  for (let i = 0; i < 525600; i += 1) {
    const minute = candidate.getMinutes();
    const hour = candidate.getHours();
    const month = candidate.getMonth() + 1;
    const day = candidate.getDate();
    const dow = candidate.getDay();
    if (!spec.minutes.has(minute)) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }
    if (!spec.hours.has(hour)) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!spec.months.has(month)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    const dayMatches = spec.domWildcard || spec.daysOfMonth.has(day);
    const dowMatches = spec.dowWildcard || spec.daysOfWeek.has(dow);
    if (dayMatches || dowMatches) {
      return new Date(candidate.getTime());
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(0, 0, 0, 0);
  }
  return null;
};

type TimerHandle = ReturnType<typeof setTimeout>;

class TimeoutDisposable implements Disposable {
  constructor(
    private readonly handle: TimerHandle,
    private readonly clear: (handle: TimerHandle) => void,
  ) {}

  dispose(): void {
    this.clear(this.handle);
  }
}

export class SchedulerController implements Scheduler, Disposable {
  private readonly disposables = new Set<Disposable>();

  constructor(private readonly logger?: Logger) {}

  registerCron(expr: string, callback: () => void | Promise<void>): Disposable {
    const spec = parseCronExpression(expr);
    let disposed = false;
    let timer: TimerHandle | null = null;

    const scheduleNext = (from: Date) => {
      if (disposed) return;
      const next = getNextOccurrence(spec, from);
      if (!next) {
        this.logger?.warn?.("Cron expression produced no future runs", { expr });
        return;
      }
      const delay = Math.max(0, next.getTime() - Date.now());
      timer = setTimeout(async () => {
        if (disposed) return;
        try {
          await callback();
        } catch (error) {
          this.logger?.error?.("Cron job error", { expr, error });
        } finally {
          scheduleNext(new Date());
        }
      }, delay);
    };

    scheduleNext(new Date());

    const disposable: Disposable = {
      dispose: () => {
        if (this.disposables.has(disposable)) {
          this.disposables.delete(disposable);
        }
        disposed = true;
        if (timer != null) {
          clearTimeout(timer);
        }
      },
    };
    this.disposables.add(disposable);
    return disposable;
  }

  setTimeout(callback: () => void | Promise<void>, delayMs: number): Disposable {
    const handle = setTimeout(() => {
      this.execute(callback);
    }, delayMs);
    const disposable = new TimeoutDisposable(handle, clearTimeout);
    const wrapped: Disposable = {
      dispose: () => {
        if (this.disposables.has(wrapped)) {
          this.disposables.delete(wrapped);
        }
        disposable.dispose();
      },
    };
    this.disposables.add(wrapped);
    return wrapped;
  }

  setInterval(callback: () => void | Promise<void>, intervalMs: number): Disposable {
    const handle = setInterval(() => {
      this.execute(callback);
    }, intervalMs);
    const disposable = new TimeoutDisposable(handle, clearInterval);
    const wrapped: Disposable = {
      dispose: () => {
        if (this.disposables.has(wrapped)) {
          this.disposables.delete(wrapped);
        }
        disposable.dispose();
      },
    };
    this.disposables.add(wrapped);
    return wrapped;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        this.logger?.error?.("Failed to dispose scheduler resource", error);
      }
    }
    this.disposables.clear();
  }

  private execute(callback: () => void | Promise<void>) {
    try {
      const result = callback();
      if (result && typeof (result as Promise<void>).then === "function") {
        (result as Promise<void>).catch((error) => {
          this.logger?.error?.("Scheduled task failed", error);
        });
      }
    } catch (error) {
      this.logger?.error?.("Scheduled task failed", error);
    }
  }
}
