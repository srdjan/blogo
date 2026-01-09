export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
  readonly isoString: () => string;
}

export const createClock = (): Clock => ({
  now: () => new Date(),
  timestamp: () => Date.now(),
  isoString: () => new Date().toISOString(),
});

export const createFixedClock = (date: Date): Clock => ({
  now: () => date,
  timestamp: () => date.getTime(),
  isoString: () => date.toISOString(),
});
