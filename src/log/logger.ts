import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type DecisionLog = {
  hotelId: string;
  shiftId?: string;
  issueId?: string;
  decision: string;
  reason: string;
  ruleId?: string;
  [k: string]: unknown;
};

export const logDecision = (d: DecisionLog) => logger.info(d);
