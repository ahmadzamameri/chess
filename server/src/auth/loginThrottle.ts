/**
 * حماية دخول المشرف من التخمين (brute-force).
 * نعدّ الفشل فقط؛ نجاح الدخول يمسح عدّاد الـIP، فلا يُحبس المشرف الشرعي أبدًا.
 */
import { config } from '../config.js';
import { createThrottle } from './throttle.js';

const throttle = createThrottle(
  config.adminLoginRateLimit.windowMs,
  config.adminLoginRateLimit.maxFails,
);

export const isLoginBlocked = (ip: string): boolean => throttle.isBlocked(ip);
export const recordLoginFail = (ip: string): void => throttle.record(ip);
export const clearLoginFails = (ip: string): void => throttle.clear(ip);
