/** Mirror of backend noon cutoff (Asia/Karachi, UTC+5). */
const TZ_OFFSET_HOURS = 5;

const pad = (n) => String(n).padStart(2, '0');

const karachiYmd = (date) => {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

const addOneCalendarDay = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + 1));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
};

const karachiLocalToUtc = (ymd, hour, minute = 0) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - TZ_OFFSET_HOURS, minute, 0, 0));
};

const parseTimeParts = (timeStr) => {
  const match = String(timeStr || '00:00').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { hour: 0, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, parseInt(match[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(match[2], 10))),
  };
};

export const combineDateAndTime = (dateInput, timeStr) => {
  if (!dateInput) return null;
  let ymd;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
    ymd = dateInput.trim().slice(0, 10);
  } else {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    ymd = karachiYmd(d);
  }
  const { hour, minute } = parseTimeParts(timeStr);
  return karachiLocalToUtc(ymd, hour, minute);
};

const nextNoonAfter = (start) => {
  const ymd = karachiYmd(start);
  const noonSameDay = karachiLocalToUtc(ymd, 12, 0);
  if (start.getTime() < noonSameDay.getTime()) return noonSameDay;
  return karachiLocalToUtc(addOneCalendarDay(ymd), 12, 0);
};

/** 1 + each 12:00 PM noon after admission and on/before end */
export const countBillableDays = (start, end = new Date()) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return 1;
  const endDt = end instanceof Date && !Number.isNaN(end.getTime()) ? end : new Date();
  if (endDt.getTime() < start.getTime()) return 1;

  let days = 1;
  let noon = nextNoonAfter(start);
  while (noon.getTime() <= endDt.getTime()) {
    days += 1;
    noon = karachiLocalToUtc(addOneCalendarDay(karachiYmd(noon)), 12, 0);
  }
  return days;
};
