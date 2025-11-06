export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
}

export const createClock = (): Clock => ({
  now: () => new Date(),
  timestamp: () => Date.now(),
});

export const createFixedClock = (date: Date): Clock => ({
  now: () => date,
  timestamp: () => date.getTime(),
});
