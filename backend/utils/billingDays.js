/** Pakistan Standard Time (UTC+5, no DST) — hospital local billing clock */
const TZ_OFFSET_HOURS = 5;

const pad = (n) => String(n).padStart(2, '0');

/** Calendar YYYY-MM-DD in Asia/Karachi for a given instant */
const karachiYmd = (date) => {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

const addOneCalendarDay = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + 1));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
};

/** Build a UTC Date for a Karachi local wall-clock time */
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

/**
 * Combine admission/discharge date + time as Karachi local.
 * dateInput may be Date, ISO string, or YYYY-MM-DD.
 */
const combineDateAndTime = (dateInput, timeStr) => {
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

/** First 12:00 noon strictly after `start` (Karachi) */
const nextNoonAfter = (start) => {
  const ymd = karachiYmd(start);
  const noonSameDay = karachiLocalToUtc(ymd, 12, 0);
  if (start.getTime() < noonSameDay.getTime()) return noonSameDay;
  return karachiLocalToUtc(addOneCalendarDay(ymd), 12, 0);
};

/**
 * Billable days:
 *   1 (base) + 1 for each 12:00 PM noon that occurs after admission and on/before end
 *
 * Examples (Karachi):
 * - Admit 23 Oct 11pm → discharge 24 Oct 11am → 1 day
 * - Admit 23 Oct 11pm → discharge 24 Oct 1pm  → 2 days
 */
const countBillableDays = (start, end) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return 1;
  const endDt =
    end instanceof Date && !Number.isNaN(end.getTime()) ? end : new Date();
  if (endDt.getTime() < start.getTime()) return 1;

  let days = 1;
  let noon = nextNoonAfter(start);
  while (noon.getTime() <= endDt.getTime()) {
    days += 1;
    noon = karachiLocalToUtc(addOneCalendarDay(karachiYmd(noon)), 12, 0);
  }
  return days;
};

const resolveStayEnd = (patient, explicitEnd) => {
  if (explicitEnd instanceof Date && !Number.isNaN(explicitEnd.getTime())) {
    return explicitEnd;
  }
  if (patient.status === 'discharged' && patient.dischargeDate) {
    return (
      combineDateAndTime(patient.dischargeDate, patient.dischargeTime) ||
      new Date(patient.dischargeDate)
    );
  }
  return new Date();
};

/**
 * Update daily-rate charges (ratePerDay > 0) to match noon-based billable days.
 * Flat/manual charges (ratePerDay = 0) and stopped charges (autoDays false) are left unchanged.
 * Active auto charges count from charge.date when set (e.g. resumed mid-stay), else admission.
 */
const applyBillableDaysToPatient = (patient, explicitEnd) => {
  const admissionStart =
    combineDateAndTime(patient.admissionDate, patient.admissionTime) ||
    (patient.admissionDate ? new Date(patient.admissionDate) : null);
  const end = resolveStayEnd(patient, explicitEnd);
  const days = countBillableDays(admissionStart, end);

  let changed = false;
  if (!Array.isArray(patient.charges)) {
    return { days, changed };
  }

  for (const charge of patient.charges) {
    const rate = Number(charge.ratePerDay) || 0;
    if (rate <= 0) continue;
    // Stopped / manual charges keep their own days
    if (charge.autoDays === false) continue;

    let chargeStart = admissionStart;
    if (charge.date) {
      const fromDate = new Date(charge.date);
      if (
        !Number.isNaN(fromDate.getTime()) &&
        admissionStart &&
        fromDate.getTime() > admissionStart.getTime()
      ) {
        chargeStart = fromDate;
      } else if (!admissionStart && !Number.isNaN(fromDate.getTime())) {
        chargeStart = fromDate;
      }
    }

    const chargeDays = countBillableDays(chargeStart, end);
    const amount = chargeDays * rate;
    if (Number(charge.days) !== chargeDays || Number(charge.amount) !== amount) {
      charge.days = chargeDays;
      charge.amount = amount;
      changed = true;
    }
  }

  return { days, changed };
};

module.exports = {
  combineDateAndTime,
  countBillableDays,
  applyBillableDaysToPatient,
};
