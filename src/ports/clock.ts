export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
  readonly isoString: () => string;
  // Monotonic milliseconds for measuring durations (not wall-clock time)
  readonly monotonic: () => number;
}

export const createClock = (): Clock => ({
  now: () => new Date(),
  timestamp: () => Date.now(),
  isoString: () => new Date().toISOString(),
  monotonic: () => performance.now(),
});

export const createFixedClock = (
  date: Date,
  monotonic: () => number = () => 0,
): Clock => ({
  now: () => date,
  timestamp: () => date.getTime(),
  isoString: () => date.toISOString(),
  monotonic,
});
