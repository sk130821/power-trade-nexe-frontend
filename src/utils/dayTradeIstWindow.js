/** Same rules as backend/utils/dayTradeIstWindow.js — client-side UI. */
const IST_TZ = 'Asia/Kolkata';

/** Members see / buy live trades from this hour (IST) onward each day. */
export const MEMBER_DAY_TRADE_VISIBLE_HOUR = 9;
/** Kept for older copy — buy no longer auto-closes at 5 PM; session stays open until admin settles. */
export const MEMBER_DAY_TRADE_BUY_END_HOUR = 17;

function getIstHourMinute(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

export function getTodayIstYmd(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

export function dayTradeSessionYmd(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toLocaleDateString('en-CA', { timeZone: IST_TZ });
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  if (s.length === 10) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-CA', { timeZone: IST_TZ });
  }
  return m[1];
}

/** Admin may activate any time; members see/buy from 9 AM IST until admin settles. */
export function isDayTradeActivateAllowed(_date = new Date()) {
  return true;
}

/** Buy from 9:00 AM IST until admin settles — no 5 PM auto-close. */
export function isDayTradeBuyWindowOpen(date = new Date()) {
  const { hour } = getIstHourMinute(date);
  return hour >= MEMBER_DAY_TRADE_VISIBLE_HOUR;
}

/** Before 9 AM IST members cannot buy yet. */
export function isDayTradeBuyWindowClosed(date = new Date()) {
  return !isDayTradeBuyWindowOpen(date);
}

/** Pending session trade ready for admin settlement (any time, including after 5 PM). */
export function isSettleableTodayTrade(t) {
  if (!t || t.deleted_at) return false;
  const result = t.result == null || t.result === '' ? 'pending' : String(t.result);
  if (result !== 'pending') return false;
  return t.status === 'active' || t.status === 'inactive';
}

export function isDayTradeVisibleToMember(date = new Date()) {
  return isDayTradeBuyWindowOpen(date);
}

export { IST_TZ, getIstHourMinute };
