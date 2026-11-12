import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmDialog';
import ClinicalTermField from '../components/ClinicalTermField';
import AdvancePaymentSlip from '../components/AdvancePaymentSlip';
import PaymentReceiptSlip from '../components/PaymentReceiptSlip';
import DischargeSummaryPrint from '../components/DischargeSummaryPrint';
import PatientBillPrint from '../components/PatientBillPrint';
import SlipActionMenu from '../components/SlipActionMenu';
import { captureSlipImage, SLIP_SELECTORS } from '../utils/captureSlip';
import { combineDateAndTime, countBillableDays } from '../utils/billingDays';
import {
  UNITS,
  subTypesForUnit,
  acTypesForUnit,
  categoryMatchesPatient,
  labelForScope,
} from '../utils/chargeUnits';
import { isUnpaidBill, totalAmountReceived } from '../utils/billingStatus';
import {
  computeDiscountAmount,
  discountLabel,
  patientDiscountAmount,
} from '../utils/billingDiscount';
import { DISCHARGE_TYPES, dischargeTypeLabel } from '../utils/dischargeTypes';
import { TERMINOLOGY_TYPES, termsForType } from '../utils/terminology';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberToWords(num) {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) {
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    }
    if (n < 100000) {
      return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    }
    if (n < 10000000) {
      return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    }
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const whole = Math.floor(Math.abs(num));
  if (whole === 0) return 'Zero Rupees Only';
  return convert(whole) + ' Rupees Only';
}

const emptyCharge = {
  particular: '',
  days: '',
  ratePerDay: '',
  amount: '',
  note: '',
  date: new Date().toISOString().slice(0, 10),
};

const emptyMedicine = () => ({
  name: '',
  dose: '',
  timing: '',
  duration: '',
});

const emptyDischargeForm = () => ({
  dischargeDate: new Date().toISOString().slice(0, 10),
  dischargeTime: '',
  dischargeType: '',
  advance: '',
  amountReceived: '',
  patientType: '',
  principleDiagnosis: '',
  associateDiagnosis: '',
  historyExamination: '',
  investigation: '',
  managementHospitalCourse: '',
  medicines: [emptyMedicine()],
  followUpDate: '',
  followUpDay: '',
  followUpTime: '',
});

function toDateInput(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function patientToForm(p) {
  return {
    bedNo: p.bedNo || '',
    careType: p.careType || (p.bedNo === 'NICU' ? 'Admission' : p.bedNo ? 'Admission' : ''),
    acType: p.bedNo === 'Ward' ? p.acType || 'With AC' : '',
    ipd: p.ipd || '',
    name: p.name || '',
    relativeOf: p.relativeOf || '',
    gender: p.gender || 'Male',
    age: p.age ?? '',
    ageUnit: p.ageUnit || 'Years',
    weight: p.weight ?? '',
    address: p.address || '',
    telNo: p.telNo || '',
    referralType: p.referralType || '',
    referralDescription: p.referralDescription || '',
    admissionDate: toDateInput(p.admissionDate),
    admissionTime: p.admissionTime || '',
    dutyRmo: p.dutyRmo || '',
    consultant: p.consultant || '',
    diagnosis: p.diagnosis || '',
    payerName: p.payerName || '',
    payerAddress: p.payerAddress || '',
    payerTelNo: p.payerTelNo || '',
    advance: p.advance ?? 0,
  };
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const isClinician = user?.role === 'clinician';
  const canEdit = Boolean(user);
  const canManageBilling = user?.role === 'admin' || user?.role === 'staff';
  const canDischarge = canManageBilling;
  const canDelete = canManageBilling;
  const canEditClinical = isClinician;
  const [patient, setPatient] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [particulars, setParticulars] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [rmoList, setRmoList] = useState([]);
  const [consultantList, setConsultantList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [showCharge, setShowCharge] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [showClinical, setShowClinical] = useState(false);
  const [charge, setCharge] = useState(emptyCharge);
  const [saving, setSaving] = useState(false);
  const [amountReceivedInput, setAmountReceivedInput] = useState('');
  const [savingAmount, setSavingAmount] = useState(false);
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [dischargeForm, setDischargeForm] = useState(emptyDischargeForm);
  const [clinicalForm, setClinicalForm] = useState(emptyDischargeForm);
  const [terminologies, setTerminologies] = useState([]);
  const [selectedChargeIds, setSelectedChargeIds] = useState([]);
  const [bulkChargeBusy, setBulkChargeBusy] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const skipPaymentAutoPrint = useRef(false);

  const clinicalTerms = useMemo(() => {
    const map = {};
    TERMINOLOGY_TYPES.forEach(({ value, field }) => {
      map[field] = termsForType(terminologies, value);
    });
    map.medicine = termsForType(terminologies, 'medicine');
    map.medicineTiming = termsForType(terminologies, 'medicineTiming');
    return map;
  }, [terminologies]);

  const loadTerminologies = async () => {
    try {
      const { data } = await api.get('/terminologies');
      setTerminologies(data);
    } catch {
      /* non-blocking for patient view */
    }
  };

  const printDocument = (mode) => {
    const className =
      mode === 'discharge'
        ? 'print-discharge'
        : mode === 'advance'
          ? 'print-advance'
          : mode === 'payment'
            ? 'print-payment'
            : mode === 'detailed'
              ? 'print-bill-detailed'
              : 'print-bill-simple';
    document.body.classList.add(className);
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      document.body.classList.remove(className);
      window.removeEventListener('afterprint', cleanup);
      if (mode === 'payment') setReceiptPayment(null);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  const printPaymentReceipt = (payment) => {
    setReceiptPayment(payment);
  };

  const handleSendWhatsApp = async (type, paymentId) => {
    const phone = String(patient?.telNo || '').trim();
    if (!phone) {
      setError('Patient Tel No. is required to send WhatsApp slip');
      return;
    }

    const selector = SLIP_SELECTORS[type];
    if (!selector) {
      setError('Unknown slip type');
      return;
    }

    setSendingWhatsApp(true);
    setError('');
    setSuccess('');
    try {
      // Payment slip mounts only when receiptPayment is set
      if (type === 'payment' && paymentId) {
        const payment = (patient.paymentHistory || []).find(
          (p) => String(p._id) === String(paymentId)
        );
        if (!payment) throw new Error('Payment entry not found');
        skipPaymentAutoPrint.current = true;
        setReceiptPayment(payment);
        await new Promise((r) => setTimeout(r, 100));
      }

      const image = await captureSlipImage(selector);
      const { data } = await api.post(`/patients/${id}/whatsapp-slip`, {
        type,
        phone,
        image,
        ...(paymentId ? { paymentId } : {}),
      });
      setSuccess(data.message || 'Slip image sent on WhatsApp');
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Failed to send WhatsApp slip'
      );
    } finally {
      if (type === 'payment') setReceiptPayment(null);
      setSendingWhatsApp(false);
    }
  };

  useEffect(() => {
    if (!receiptPayment) return undefined;
    if (skipPaymentAutoPrint.current) {
      skipPaymentAutoPrint.current = false;
      return undefined;
    }
    const timer = setTimeout(() => printDocument('payment'), 50);
    return () => clearTimeout(timer);
  }, [receiptPayment]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const pRes = await api.get(`/patients/${id}`);
      const unit = pRes.data.bedNo || '';
      const careType =
        pRes.data.careType || (unit === 'NICU' ? 'Admission' : unit ? 'Admission' : '');
      const acType = unit === 'Ward' ? pRes.data.acType || 'With AC' : '';
      const catParams = unit && careType ? { unit, subType: careType } : {};
      const [partRes, refRes, staffRes] = await Promise.all([
        api.get('/charge-categories', { params: catParams }),
        api.get('/referrals'),
        api.get('/clinical-staff').catch(() => ({ data: [] })),
      ]);
      setPatient(pRes.data);
      setSelectedChargeIds([]);
      const matched = (partRes.data || []).filter((c) =>
        categoryMatchesPatient(c, unit, careType, acType)
      );
      setParticulars(matched);
      setReferrals(refRes.data);
      const staff = staffRes.data || [];
      setRmoList(staff.filter((s) => s.role === 'rmo'));
      setConsultantList(staff.filter((s) => s.role === 'consultant'));
      setEditForm(patientToForm(pRes.data));
      setAmountReceivedInput('');
      setDiscountType(pRes.data.discountType || '');
      setDiscountValue(
        pRes.data.discountValue != null && Number(pRes.data.discountValue) > 0
          ? String(pRes.data.discountValue)
          : ''
      );
      const first = matched[0];
      setCharge((c) => ({
        ...c,
        particular: first?.name || '',
        ratePerDay: first ? String(first.ratePerDay ?? 0) : '',
      }));
      setDischargeForm((f) => ({
        ...emptyDischargeForm(),
        ...f,
        advance: pRes.data.advance || 0,
        amountReceived: '',
        medicines: [emptyMedicine()],
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const total = (patient?.charges || []).reduce((s, c) => s + (c.amount || 0), 0);
  const discountAmount = patientDiscountAmount(patient);
  const netTotal = Math.max(0, total - discountAmount);
  const advance = Number(patient?.advance || 0);
  const amountReceived = totalAmountReceived(patient);
  const pendingPayment = Number(amountReceivedInput) || 0;
  const balance =
    netTotal - advance - amountReceived - (canManageBilling ? pendingPayment : 0);
  const draftDiscountAmount = computeDiscountAmount(
    total,
    discountType,
    discountValue
  );
  const dischargeAdvance = Number(dischargeForm.advance) || 0;
  const dischargePayment =
    dischargeForm.amountReceived !== ''
      ? Number(dischargeForm.amountReceived) || 0
      : 0;
  const dischargeRemainingDue = Math.max(
    0,
    netTotal - dischargeAdvance - amountReceived - dischargePayment
  );
  const canConfirmDischarge = dischargeRemainingDue <= 0.009;

  const formatDateTime = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const setChargeField = (field) => (e) => {
    const value = e.target.value;
    setCharge((c) => {
      const next = { ...c, [field]: value };

      if (field === 'particular') {
        const selected = particulars.find((p) => p.name === value);
        if (selected) {
          next.ratePerDay = String(selected.ratePerDay ?? 0);
          const days = Number(next.days) || 0;
          const rate = Number(selected.ratePerDay) || 0;
          if (days > 0 && rate > 0) {
            next.amount = String(days * rate);
          } else if (rate > 0 && !days) {
            next.amount = String(rate);
          }
        }
      }

      if (field === 'days' || field === 'ratePerDay') {
        const days = Number(field === 'days' ? value : next.days) || 0;
        const rate = Number(field === 'ratePerDay' ? value : next.ratePerDay) || 0;
        if (days > 0 && rate > 0) {
          next.amount = String(days * rate);
        } else if (rate > 0 && !days) {
          next.amount = String(rate);
        }
      }
      return next;
    });
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    const days = Number(charge.days) || 0;
    if (days <= 0) {
      setError('Please enter days');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/patients/${id}/charges`, {
        particular: charge.particular,
        days,
        note: charge.note,
        date: charge.date,
      });
      setPatient(data);
      setShowCharge(false);
      const first = particulars[0];
      const defaultDays = data.billableDays || patient?.billableDays || 1;
      setCharge({
        ...emptyCharge,
        particular: first?.name || '',
        ratePerDay: first ? String(first.ratePerDay ?? 0) : '',
        days: String(defaultDays),
        amount:
          first && Number(first.ratePerDay) > 0
            ? String(defaultDays * Number(first.ratePerDay))
            : '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add charge');
    } finally {
      setSaving(false);
    }
  };

  const isActiveDailyCharge = (c) =>
    Number(c.ratePerDay) > 0 && c.autoDays !== false && !c.stoppedAt;

  const hasActiveParticular = (particular, exceptId) =>
    (patient?.charges || []).some(
      (c) =>
        c._id !== exceptId &&
        c.particular === particular &&
        isActiveDailyCharge(c)
    );

  const canResumeCharge = (c) =>
    Boolean(c.stoppedAt) &&
    Number(c.ratePerDay) > 0 &&
    !hasActiveParticular(c.particular, c._id);

  const toggleChargeSelect = (chargeId) => {
    setSelectedChargeIds((prev) =>
      prev.includes(chargeId) ? prev.filter((id) => id !== chargeId) : [...prev, chargeId]
    );
  };

  const handleResumeCharge = async (charge) => {
    const ok = await confirm({
      title: 'Activate again',
      message:
        'Keep the stopped period on the bill and start a new active period from today? Days will count again until discharge or stop.',
      confirmLabel: 'Activate again',
    });
    if (!ok) return;
    try {
      const { data } = await api.post(
        `/patients/${id}/charges/${charge._id}/resume`
      );
      setPatient(data);
      setSelectedChargeIds([]);
      setSuccess(`"${charge.particular}" activated again from today`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate charge');
    }
  };

  const handleBatchStopCharges = async () => {
    const ids = selectedChargeIds.filter((cid) => {
      const c = (patient.charges || []).find((x) => x._id === cid);
      return c && isActiveDailyCharge(c);
    });
    if (!ids.length) {
      setError('Select at least one active daily charge to stop');
      return;
    }
    const ok = await confirm({
      title: 'Stop selected charges',
      message: `Stop ${ids.length} charge${ids.length === 1 ? '' : 's'} from today? Days used so far will stay on the bill.`,
      confirmLabel: 'Stop selected',
    });
    if (!ok) return;
    setBulkChargeBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/patients/${id}/charges/batch-stop`, {
        chargeIds: ids,
      });
      setPatient(data);
      setSelectedChargeIds([]);
      setSuccess(`Stopped ${ids.length} charge${ids.length === 1 ? '' : 's'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to stop selected charges');
    } finally {
      setBulkChargeBusy(false);
    }
  };

  const handleBatchResumeCharges = async () => {
    const ids = selectedChargeIds.filter((cid) => {
      const c = (patient.charges || []).find((x) => x._id === cid);
      return c && canResumeCharge(c);
    });
    if (!ids.length) {
      setError('Select at least one stopped charge to activate');
      return;
    }
    const ok = await confirm({
      title: 'Activate selected charges',
      message: `Activate ${ids.length} charge${ids.length === 1 ? '' : 's'} from today? Stopped periods stay on the bill.`,
      confirmLabel: 'Activate selected',
    });
    if (!ok) return;
    setBulkChargeBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/patients/${id}/charges/batch-resume`, {
        chargeIds: ids,
      });
      setPatient(data);
      setSelectedChargeIds([]);
      setSuccess(`Activated ${ids.length} charge${ids.length === 1 ? '' : 's'}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate selected charges');
    } finally {
      setBulkChargeBusy(false);
    }
  };

  const handleRemoveCharge = async (charge) => {
    const isActiveDaily = isActiveDailyCharge(charge);

    if (isActiveDaily) {
      const ok = await confirm({
        title: 'Stop charge',
        message:
          'Stop this charge from today? Days used so far will stay on the bill and will not keep increasing until discharge.',
        confirmLabel: 'Stop charge',
      });
      if (!ok) return;
      try {
        const { data } = await api.delete(`/patients/${id}/charges/${charge._id}`);
        setPatient(data);
        setSelectedChargeIds((prev) => prev.filter((x) => x !== charge._id));
        setSuccess('Charge stopped — days used so far kept on the bill');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to stop charge');
      }
      return;
    }

    const ok = await confirm({
      title: 'Remove charge',
      message: charge.stoppedAt
        ? 'Permanently remove this stopped charge from the bill? This cannot be undone.'
        : 'Are you sure you want to remove this charge from the patient bill?',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      const { data } = await api.delete(
        `/patients/${id}/charges/${charge._id}?permanent=true`
      );
      setPatient(data);
      setSelectedChargeIds((prev) => prev.filter((x) => x !== charge._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove charge');
    }
  };

  const setEdit = (field) => (e) =>
    setEditForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = () => {
    setEditForm(patientToForm(patient));
    setEditing(true);
    setSuccess('');
    setError('');
  };

  const cancelEdit = () => {
    setEditForm(patientToForm(patient));
    setEditing(false);
    setError('');
  };

  const handleDeletePatient = async () => {
    const ok = await confirm({
      title: 'Delete patient',
      message: `Are you sure you want to delete patient "${patient.name}" (${patient.hospitalRegNo})?`,
      confirmLabel: 'Delete patient',
    });
    if (!ok) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/patients/${id}`);
      navigate('/patients');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete patient');
      setDeleting(false);
    }
  };

  const openClinical = () => {
    setClinicalForm({
      ...emptyDischargeForm(),
      principleDiagnosis: patient?.principleDiagnosis || '',
      associateDiagnosis: patient?.associateDiagnosis || '',
      historyExamination: patient?.historyExamination || '',
      investigation: patient?.investigation || '',
      managementHospitalCourse: patient?.managementHospitalCourse || '',
      medicines:
        patient?.medicines?.length > 0
          ? patient.medicines.map((m) => ({
              name: m.name || '',
              dose: m.dose || '',
              timing: m.timing || '',
              duration: m.duration || '',
            }))
          : [emptyMedicine()],
      followUpDate: patient?.followUpDate || '',
      followUpDay: patient?.followUpDay || '',
      followUpTime: patient?.followUpTime || '',
      patientType: patient?.patientType || '',
    });
    loadTerminologies();
    setShowClinical(true);
    setError('');
    setSuccess('');
  };

  const addTerminologyOption = async (type, text) => {
    const { data } = await api.post('/terminologies', { type, text });
    setTerminologies((list) => [...list, data]);
    return data;
  };

  const setClinicalField = (field) => (e) =>
    setClinicalForm((f) => ({ ...f, [field]: e.target.value }));

  const setClinicalMedicineField = (index, field) => (e) => {
    setClinicalForm((f) => {
      const medicines = [...f.medicines];
      medicines[index] = { ...medicines[index], [field]: e.target.value };
      return { ...f, medicines };
    });
  };

  const addClinicalMedicineRow = () => {
    setClinicalForm((f) => ({
      ...f,
      medicines: [...f.medicines, emptyMedicine()],
    }));
  };

  const removeClinicalMedicineRow = (index) => {
    setClinicalForm((f) => ({
      ...f,
      medicines:
        f.medicines.length === 1
          ? [emptyMedicine()]
          : f.medicines.filter((_, i) => i !== index),
    }));
  };

  const handleSaveClinical = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/patients/${id}`, {
        principleDiagnosis: clinicalForm.principleDiagnosis,
        associateDiagnosis: clinicalForm.associateDiagnosis,
        historyExamination: clinicalForm.historyExamination,
        investigation: clinicalForm.investigation,
        managementHospitalCourse: clinicalForm.managementHospitalCourse,
        medicines: clinicalForm.medicines,
        followUpDate: clinicalForm.followUpDate,
        followUpDay: clinicalForm.followUpDay,
        followUpTime: clinicalForm.followUpTime,
        patientType: clinicalForm.patientType,
      });
      setPatient(data);
      setShowClinical(false);
      setSuccess('Clinical summary saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save clinical summary');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...editForm,
        age: Number(editForm.age),
        weight: editForm.weight === '' ? null : Number(editForm.weight),
      };
      if (canManageBilling) {
        payload.advance = Number(editForm.advance) || 0;
      }
      const { data } = await api.put(`/patients/${id}`, payload);
      setPatient(data);
      setEditForm(patientToForm(data));
      setEditing(false);
      setSuccess('Patient details updated');
      setDischargeForm((f) => ({ ...f, advance: data.advance || 0 }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    const amount = Number(amountReceivedInput) || 0;
    if (amount <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    setSavingAmount(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post(`/patients/${id}/payments`, {
        amount,
        receivedAt: new Date().toISOString(),
      });
      setPatient(data);
      setAmountReceivedInput('');
      setSuccess('Payment recorded');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSavingAmount(false);
    }
  };

  const handleSaveDiscount = async () => {
    const type =
      discountType === 'percentage' || discountType === 'fixed' ? discountType : '';
    let value = Number(discountValue) || 0;
    if (type && value <= 0) {
      setError('Enter a discount value greater than 0, or clear the discount type');
      return;
    }
    if (type === 'percentage' && value > 100) value = 100;

    setSavingDiscount(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/patients/${id}`, {
        discountType: type,
        discountValue: type ? value : 0,
      });
      setPatient(data);
      setDiscountType(data.discountType || '');
      setDiscountValue(
        data.discountValue != null && Number(data.discountValue) > 0
          ? String(data.discountValue)
          : ''
      );
      setSuccess(type ? 'Discount applied' : 'Discount cleared');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save discount');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleClearDiscount = async () => {
    setDiscountType('');
    setDiscountValue('');
    setSavingDiscount(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/patients/${id}`, {
        discountType: '',
        discountValue: 0,
      });
      setPatient(data);
      setSuccess('Discount cleared');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear discount');
    } finally {
      setSavingDiscount(false);
    }
  };

  const setDischargeField = (field) => (e) =>
    setDischargeForm((f) => ({ ...f, [field]: e.target.value }));

  const setMedicineField = (index, field) => (e) => {
    setDischargeForm((f) => {
      const medicines = [...f.medicines];
      medicines[index] = { ...medicines[index], [field]: e.target.value };
      return { ...f, medicines };
    });
  };

  const addMedicineRow = () => {
    setDischargeForm((f) => ({
      ...f,
      medicines: [...f.medicines, emptyMedicine()],
    }));
  };

  const removeMedicineRow = (index) => {
    setDischargeForm((f) => ({
      ...f,
      medicines: f.medicines.length === 1 ? [emptyMedicine()] : f.medicines.filter((_, i) => i !== index),
    }));
  };

  const openDischarge = () => {
    const currentAdvance = Number(patient?.advance) || 0;
    const alreadyReceived = totalAmountReceived(patient);
    const remaining = Math.max(0, total - currentAdvance - alreadyReceived);
    const existingMeds = (patient?.medicines || [])
      .filter((m) => m && (m.name || m.dose || m.timing || m.duration))
      .map((m) => ({
        name: m.name || '',
        dose: m.dose || '',
        timing: m.timing || '',
        duration: m.duration || '',
      }));
    setDischargeForm({
      ...emptyDischargeForm(),
      advance: currentAdvance,
      amountReceived: remaining > 0 ? String(remaining) : '',
      dischargeType: patient?.dischargeType || '',
      patientType: patient?.patientType || '',
      principleDiagnosis: patient?.principleDiagnosis || '',
      associateDiagnosis: patient?.associateDiagnosis || '',
      historyExamination: patient?.historyExamination || '',
      investigation: patient?.investigation || '',
      managementHospitalCourse: patient?.managementHospitalCourse || '',
      medicines: existingMeds.length > 0 ? existingMeds : [emptyMedicine()],
      followUpDate: patient?.followUpDate || '',
      followUpDay: patient?.followUpDay || '',
      followUpTime: patient?.followUpTime || '',
    });
    setShowDischarge(true);
  };

  const handleDischarge = async (e) => {
    e.preventDefault();
    if (!dischargeForm.dischargeType) {
      setError('Please select a discharge type');
      return;
    }
    if (!canConfirmDischarge) {
      setError(
        `Clear all dues before discharge. Remaining balance: ${formatMoney(dischargeRemainingDue)}`
      );
      return;
    }
    const ok = await confirm({
      title: 'Discharge patient',
      message:
        'Are you sure you want to discharge this patient? Charges cannot be edited after discharge.',
      confirmLabel: 'Discharge',
    });
    if (!ok) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        dischargeDate: dischargeForm.dischargeDate,
        dischargeTime: dischargeForm.dischargeTime,
        dischargeType: dischargeForm.dischargeType,
        advance: Number(dischargeForm.advance) || 0,
        patientType: dischargeForm.patientType,
        principleDiagnosis: dischargeForm.principleDiagnosis,
        associateDiagnosis: dischargeForm.associateDiagnosis,
        historyExamination: dischargeForm.historyExamination,
        investigation: dischargeForm.investigation,
        managementHospitalCourse: dischargeForm.managementHospitalCourse,
        medicines: dischargeForm.medicines,
        followUpDate: dischargeForm.followUpDate,
        followUpDay: dischargeForm.followUpDay,
        followUpTime: dischargeForm.followUpTime,
      };
      if (dischargeForm.amountReceived !== '') {
        payload.amountReceived = Number(dischargeForm.amountReceived) || 0;
      }
      const { data } = await api.post(`/patients/${id}/discharge`, payload);
      setPatient(data);
      setAmountReceivedInput('');
      setShowDischarge(false);
      setDischargeForm(emptyDischargeForm());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to discharge patient');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading patient...</div>;
  }

  if (!patient) {
    return (
      <main className="page">
        <div className="error-banner">{error || 'Patient not found'}</div>
        <Link to="/patients" className="btn btn-primary">
          Back to Patient History
        </Link>
      </main>
    );
  }

  const isAdmitted = patient.status === 'admitted';

  return (
    <>
      <main className="page page-wide screen-only">
        <Link to="/patients" className="back-link no-print">
          ← Back to patients
        </Link>

        {error && <div className="error-banner no-print">{error}</div>}
        {success && <div className="success-banner no-print">{success}</div>}

        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1>{patient.name}</h1>
            {!isClinician && isUnpaidBill(patient) && (
              <span className="badge badge-unpaid">Unpaid Bill</span>
            )}
            <span className={`badge badge-${patient.status}`}>{patient.status}</span>
            {!isAdmitted && patient.dischargeType && (
              <span
                className={`badge badge-discharge-type badge-discharge-${patient.dischargeType.toLowerCase()}`}
              >
                {patient.dischargeType}
              </span>
            )}
          </div>
          <div className="patient-meta" style={{ marginTop: '0.35rem' }}>
            <span>Reg: {patient.hospitalRegNo}</span>
            {patient.bedNo && (
              <span>
                Unit:{' '}
                {labelForScope(
                  patient.bedNo,
                  patient.careType || 'Admission',
                  patient.acType
                )}
              </span>
            )}
            {patient.billNo && <span>Bill: {patient.billNo}</span>}
          </div>
          <div className="detail-actions no-print">
            <div className="detail-actions-left">
              {canEdit && !editing && (
                <button type="button" className="btn btn-outline btn-sm" onClick={startEdit}>
                  Edit Details
                </button>
              )}
              {canEditClinical && !editing && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={openClinical}
                >
                  Clinical Summary
                </button>
              )}
              {canManageBilling && isAdmitted && !editing && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const days =
                        patient.billableDays ||
                        countBillableDays(
                          combineDateAndTime(patient.admissionDate, patient.admissionTime) ||
                            new Date(patient.admissionDate)
                        );
                      setCharge((c) => ({
                        ...c,
                        days: String(days),
                        amount:
                          Number(c.ratePerDay) > 0
                            ? String(days * Number(c.ratePerDay))
                            : c.amount,
                      }));
                      setShowCharge(true);
                    }}
                  >
                    + Add Charge
                  </button>
                  {canDischarge && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={openDischarge}
                    >
                      Discharge
                    </button>
                  )}
                </>
              )}
              {!editing && !isClinician && (
                <>
                  {advance > 0 && (
                    <SlipActionMenu
                      label="Advance Slip"
                      busy={sendingWhatsApp}
                      onPrint={() => printDocument('advance')}
                      onWhatsApp={
                        canManageBilling
                          ? () => handleSendWhatsApp('advance')
                          : undefined
                      }
                    />
                  )}
                  <SlipActionMenu
                    label="Simple Bill"
                    busy={sendingWhatsApp}
                    onPrint={() => printDocument('simple')}
                    onWhatsApp={
                      canManageBilling
                        ? () => handleSendWhatsApp('simple')
                        : undefined
                    }
                  />
                  <SlipActionMenu
                    label="Detailed Bill"
                    busy={sendingWhatsApp}
                    onPrint={() => printDocument('detailed')}
                    onWhatsApp={
                      canManageBilling
                        ? () => handleSendWhatsApp('detailed')
                        : undefined
                    }
                  />
                </>
              )}
              {!isAdmitted && !editing && !isClinician && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => printDocument('discharge')}
                >
                  Print Summary
                </button>
              )}
            </div>
            {canDelete && !editing && (
              <button
                type="button"
                className="btn btn-danger btn-sm detail-delete-btn"
                onClick={handleDeletePatient}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Patient'}
              </button>
            )}
          </div>
        </div>

        {canEdit && editing && editForm ? (
          <form onSubmit={handleSavePatient}>
            <div className="card">
              <div className="section-label">Patient Identification</div>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Hospital Reg No.</label>
                  <input className="form-input" value={patient.hospitalRegNo} disabled readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">IPD No.</label>
                  <input className="form-input" value={editForm.ipd} onChange={setEdit('ipd')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <div className="filter-pills gender-toggle" role="group" aria-label="Unit">
                    {UNITS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        className={`pill ${editForm.bedNo === unit ? 'active' : ''}`}
                        onClick={() => {
                          const subs = subTypesForUnit(unit);
                          setEditForm((f) => ({
                            ...f,
                            bedNo: unit,
                            careType: subs.includes(f.careType) ? f.careType : subs[0],
                            acType: unit === 'Ward' ? f.acType || 'With AC' : '',
                          }));
                        }}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Care type</label>
                  <div className="filter-pills gender-toggle" role="group" aria-label="Care type">
                    {subTypesForUnit(editForm.bedNo || 'NICU').map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        className={`pill ${editForm.careType === sub ? 'active' : ''}`}
                        onClick={() => setEditForm((f) => ({ ...f, careType: sub }))}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
                {editForm.bedNo === 'Ward' && (
                  <div className="form-group">
                    <label className="form-label">
                      AC option <span className="req">*</span>
                    </label>
                    <div className="filter-pills gender-toggle" role="group" aria-label="AC option">
                      {acTypesForUnit('Ward').map((ac) => (
                        <button
                          key={ac}
                          type="button"
                          className={`pill ${editForm.acType === ac ? 'active' : ''}`}
                          onClick={() => setEditForm((f) => ({ ...f, acType: ac }))}
                        >
                          {ac}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">
                    Name <span className="req">*</span>
                  </label>
                  <input
                    className="form-input"
                    value={editForm.name}
                    onChange={setEdit('name')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">W/o, S/o, D/o</label>
                  <input
                    className="form-input"
                    value={editForm.relativeOf}
                    onChange={setEdit('relativeOf')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <div className="filter-pills gender-toggle">
                    {['Male', 'Female'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`pill ${editForm.gender === g ? 'active' : ''}`}
                        onClick={() => setEditForm((f) => ({ ...f, gender: g }))}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Age <span className="req">*</span>
                  </label>
                  <div className="filter-pills age-unit-toggle">
                    {['Days', 'Months', 'Years'].map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        className={`pill ${editForm.ageUnit === unit ? 'active' : ''}`}
                        onClick={() => setEditForm((f) => ({ ...f, ageUnit: unit }))}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="form-input"
                    style={{ marginTop: '0.5rem' }}
                    value={editForm.age}
                    onChange={setEdit('age')}
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.weight}
                    onChange={setEdit('weight')}
                    min="0"
                    step="0.01"
                    placeholder="Weight in kg"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tel. No.</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editForm.telNo}
                    onChange={setEdit('telNo')}
                  />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.address}
                    onChange={setEdit('address')}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Referral</div>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Referral Type</label>
                  <select
                    className="form-select"
                    value={editForm.referralType}
                    onChange={setEdit('referralType')}
                  >
                    <option value="">Select referral type</option>
                    {referrals.map((r) => (
                      <option key={r._id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    className="form-input"
                    value={editForm.referralDescription}
                    onChange={setEdit('referralDescription')}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Admission Details</div>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Date of Admission</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.admissionDate}
                    onChange={setEdit('admissionDate')}
                    disabled={!isAdmitted}
                    required={isAdmitted}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time of Admission</label>
                  <input
                    type="time"
                    className="form-input"
                    value={editForm.admissionTime}
                    onChange={setEdit('admissionTime')}
                    disabled={!isAdmitted}
                  />
                </div>
                {!isAdmitted && (
                  <div className="form-group span-2">
                    <label className="form-label">Discharged</label>
                    <input
                      className="form-input"
                      value={`${formatDate(patient.dischargeDate)}${
                        patient.dischargeTime ? ` · ${patient.dischargeTime}` : ''
                      }`}
                      disabled
                      readOnly
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Duty R.M.O.</label>
                  <select
                    className="form-select"
                    value={editForm.dutyRmo}
                    onChange={setEdit('dutyRmo')}
                  >
                    <option value="">Select R.M.O.</option>
                    {editForm.dutyRmo &&
                      !rmoList.some((s) => s.name === editForm.dutyRmo) && (
                        <option value={editForm.dutyRmo}>{editForm.dutyRmo}</option>
                      )}
                    {rmoList.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Consultant</label>
                  <select
                    className="form-select"
                    value={editForm.consultant}
                    onChange={setEdit('consultant')}
                  >
                    <option value="">Select consultant</option>
                    {editForm.consultant &&
                      !consultantList.some((s) => s.name === editForm.consultant) && (
                        <option value={editForm.consultant}>{editForm.consultant}</option>
                      )}
                    {consultantList.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Diagnosis</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.diagnosis}
                    onChange={setEdit('diagnosis')}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Payment Responsible</div>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    className="form-input"
                    value={editForm.payerName}
                    onChange={setEdit('payerName')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telephone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editForm.payerTelNo}
                    onChange={setEdit('payerTelNo')}
                  />
                </div>
                <div className="form-group span-2">
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.payerAddress}
                    onChange={setEdit('payerAddress')}
                    rows={2}
                  />
                </div>
                {canManageBilling && (
                  <div className="form-group">
                    <label className="form-label">Advance (Rs.)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editForm.advance}
                      onChange={setEdit('advance')}
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions no-print">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-outline" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="card">
              <div className="section-label">Patient Identification</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Hospital Reg No.</span>
                  <span className="info-value">{patient.hospitalRegNo}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">IPD</span>
                  <span className="info-value">{patient.ipd || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Unit</span>
                  <span className="info-value">
                    {patient.bedNo
                      ? labelForScope(
                          patient.bedNo,
                          patient.careType || 'Admission',
                          patient.acType
                        )
                      : '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Age</span>
                  <span className="info-value">
                    {patient.age} {patient.ageUnit || 'Years'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Weight</span>
                  <span className="info-value">
                    {patient.weight != null && patient.weight !== ''
                      ? `${patient.weight} kg`
                      : '—'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Gender</span>
                  <span className="info-value">{patient.gender || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">W/o, S/o, D/o</span>
                  <span className="info-value">{patient.relativeOf || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tel. No.</span>
                  <span className="info-value">{patient.telNo || '—'}</span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Address</span>
                  <span className="info-value">{patient.address || '—'}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Referral</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Referral Type</span>
                  <span className="info-value">{patient.referralType || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Description</span>
                  <span className="info-value">{patient.referralDescription || '—'}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Admission Details</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Admitted On</span>
                  <span className="info-value">
                    {formatDate(patient.admissionDate)}
                    {patient.admissionTime ? ` · ${patient.admissionTime}` : ''}
                  </span>
                </div>
                {!isAdmitted && (
                  <>
                    <div className="info-item">
                      <span className="info-label">Discharged</span>
                      <span className="info-value">
                        {formatDate(patient.dischargeDate)}
                        {patient.dischargeTime ? ` · ${patient.dischargeTime}` : ''}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Discharge Type</span>
                      <span className="info-value">
                        {dischargeTypeLabel(patient.dischargeType) || '—'}
                      </span>
                    </div>
                  </>
                )}
                <div className="info-item">
                  <span className="info-label">Duty R.M.O.</span>
                  <span className="info-value">{patient.dutyRmo || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Consultant</span>
                  <span className="info-value">{patient.consultant || '—'}</span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Diagnosis</span>
                  <span className="info-value">{patient.diagnosis || '—'}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Payment Responsible</div>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{patient.payerName || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Telephone</span>
                  <span className="info-value">{patient.payerTelNo || '—'}</span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Address</span>
                  <span className="info-value">{patient.payerAddress || '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Advance</span>
                  <span className="info-value">{formatMoney(patient.advance)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {(isClinician ||
          !isAdmitted ||
          patient.principleDiagnosis ||
          patient.associateDiagnosis ||
          patient.historyExamination ||
          patient.investigation ||
          patient.managementHospitalCourse ||
          (patient.medicines || []).length > 0) && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="section-label" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
                  Clinical Summary
                </div>
                {canEditClinical && !editing && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm no-print"
                    onClick={openClinical}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="info-grid">
                <div className="info-item full">
                  <span className="info-label">Principle Diagnosis</span>
                  <span className="info-value discharge-text">
                    {patient.principleDiagnosis || '—'}
                  </span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Associate Diagnosis</span>
                  <span className="info-value discharge-text">
                    {patient.associateDiagnosis || '—'}
                  </span>
                </div>
                <div className="info-item full">
                  <span className="info-label">History & Examination</span>
                  <span className="info-value discharge-text">
                    {patient.historyExamination || '—'}
                  </span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Investigation</span>
                  <span className="info-value discharge-text">
                    {patient.investigation || '—'}
                  </span>
                </div>
                <div className="info-item full">
                  <span className="info-label">Management and Hospital Course</span>
                  <span className="info-value discharge-text">
                    {patient.managementHospitalCourse || '—'}
                  </span>
                </div>
                {(patient.followUpDate || patient.followUpDay || patient.followUpTime) && (
                  <div className="info-item full">
                    <span className="info-label">Follow-up After Discharge</span>
                    <span className="info-value">
                      {[
                        patient.followUpDate,
                        patient.followUpDay,
                        patient.followUpTime,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="section-label">Medicines</div>
              {(patient.medicines || []).length === 0 ? (
                <div className="empty-state">
                  <p>No medicines recorded</p>
                </div>
              ) : (
                <div className="charges-table-wrap">
                  <table className="charges-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Dose</th>
                        <th>Timing</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patient.medicines.map((m) => (
                        <tr key={m._id}>
                          <td style={{ fontWeight: 500 }}>{m.name || '—'}</td>
                          <td>{m.dose || '—'}</td>
                          <td>{m.timing || '—'}</td>
                          <td>{m.duration || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!isClinician && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Billing Particulars</h2>
            {canManageBilling && isAdmitted && (
              <button
                type="button"
                className="btn btn-ghost btn-sm no-print"
                onClick={() => {
                  const days =
                    patient.billableDays ||
                    countBillableDays(
                      combineDateAndTime(patient.admissionDate, patient.admissionTime) ||
                        new Date(patient.admissionDate)
                    );
                  setCharge((c) => ({
                    ...c,
                    days: String(days),
                    amount:
                      Number(c.ratePerDay) > 0
                        ? String(days * Number(c.ratePerDay))
                        : c.amount,
                  }));
                  setShowCharge(true);
                }}
              >
                + Add
              </button>
            )}
          </div>
          <p
            className="no-print"
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              margin: '0 0 0.75rem',
            }}
          >
            Daily charges auto-count by 12:00 PM noon cutoff
            {patient.billableDays ? ` · Current billable days: ${patient.billableDays}` : ''}.
            Select multiple charges to stop or activate together.
          </p>

          {(patient.charges || []).length === 0 ? (
            <div className="empty-state">
              <p>No charges added yet</p>
            </div>
          ) : (
            <>
              {canManageBilling && isAdmitted && (
                <div
                  className="toolbar no-print"
                  style={{ marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}
                >
                  <label
                    className="charge-check-label"
                    style={{ margin: 0, gap: '0.4rem', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        (patient.charges || []).length > 0 &&
                        selectedChargeIds.length === (patient.charges || []).length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChargeIds((patient.charges || []).map((c) => c._id));
                        } else {
                          setSelectedChargeIds([]);
                        }
                      }}
                    />
                    <span style={{ fontSize: '0.85rem' }}>
                      {selectedChargeIds.length
                        ? `${selectedChargeIds.length} selected`
                        : 'Select all'}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={bulkChargeBusy || selectedChargeIds.length === 0}
                    onClick={handleBatchStopCharges}
                  >
                    Stop selected
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={bulkChargeBusy || selectedChargeIds.length === 0}
                    onClick={handleBatchResumeCharges}
                  >
                    Activate selected
                  </button>
                </div>
              )}
              <div className="charges-table-wrap">
                <table className="charges-table">
                  <thead>
                    <tr>
                      {canManageBilling && isAdmitted && (
                        <th className="no-print" style={{ width: 36 }} />
                      )}
                      <th>Particulars</th>
                      <th>Qty / Rate</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      {canManageBilling && isAdmitted && (
                        <th className="actions-col no-print" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {patient.charges.map((c) => (
                      <tr key={c._id}>
                        {canManageBilling && isAdmitted && (
                          <td className="no-print">
                            <input
                              type="checkbox"
                              checked={selectedChargeIds.includes(c._id)}
                              onChange={() => toggleChargeSelect(c._id)}
                              aria-label={`Select ${c.particular}`}
                            />
                          </td>
                        )}
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {c.particular}
                            {c.stoppedAt && (
                              <span className="auto-badge" style={{ marginLeft: '0.35rem' }}>
                                Stopped
                              </span>
                            )}
                          </div>
                          {c.note && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {c.note}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {c.ratePerDay > 0
                            ? `${c.days || 0} days @ Rs. ${c.ratePerDay}/day`
                            : c.days > 0
                              ? `${c.days} days`
                              : '—'}
                        </td>
                        <td className="amount">{formatMoney(c.amount)}</td>
                        {canManageBilling && isAdmitted && (
                          <td className="actions-col no-print">
                            <div
                              style={{
                                display: 'flex',
                                gap: '0.35rem',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                              }}
                            >
                              {canResumeCharge(c) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  title="Activate again"
                                  onClick={() => handleResumeCharge(c)}
                                >
                                  Activate
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-icon"
                                title={isActiveDailyCharge(c) ? 'Stop charge' : 'Remove'}
                                onClick={() => handleRemoveCharge(c)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="bill-summary">
            <div className="bill-row total">
              <span>Total Charges</span>
              <span>{formatMoney(total)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="bill-row">
                <span>
                  Less: Discount
                  {discountLabel(patient) ? ` (${discountLabel(patient)})` : ''}
                </span>
                <span>- {formatMoney(discountAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="bill-row">
                <span>Net Charges</span>
                <span>{formatMoney(netTotal)}</span>
              </div>
            )}
            {advance > 0 && (
              <div className="bill-row">
                <span>Less: Advance</span>
                <span>- {formatMoney(advance)}</span>
              </div>
            )}
            <div className="bill-row">
              <span>Amount Received (total)</span>
              <span>- {formatMoney(amountReceived)}</span>
            </div>
            <div className="bill-row balance">
              <span>{balance >= 0 ? 'Balance Due' : 'Refund / Credit'}</span>
              <span>{formatMoney(Math.abs(balance))}</span>
            </div>
            {canManageBilling && (
              <div className="bill-row discount-row no-print">
                <span>Discount bill</span>
                <div className="discount-controls">
                  <select
                    className="form-input discount-type-select"
                    value={discountType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDiscountType(next);
                      if (!next) setDiscountValue('');
                    }}
                  >
                    <option value="">No discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount (Rs.)</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input amount-received-input"
                    value={discountValue}
                    disabled={!discountType}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setDiscountValue(v);
                      }
                    }}
                    placeholder={
                      discountType === 'percentage'
                        ? '%'
                        : discountType === 'fixed'
                          ? 'Rs.'
                          : '—'
                    }
                  />
                  {draftDiscountAmount > 0 && (
                    <span className="discount-preview">
                      = {formatMoney(draftDiscountAmount)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveDiscount}
                    disabled={savingDiscount}
                  >
                    {savingDiscount ? '...' : 'Apply'}
                  </button>
                  {(patient.discountType || discountType) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleClearDiscount}
                      disabled={savingDiscount}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
            {canManageBilling && (
              <div className="bill-row amount-received-row no-print">
                <span>Record payment (Rs.)</span>
                <div className="amount-received-input-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input amount-received-input"
                    value={amountReceivedInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setAmountReceivedInput(v);
                      }
                    }}
                    placeholder="New amount received"
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddPayment}
                    disabled={savingAmount}
                  >
                    {savingAmount ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            )}
            {((patient.paymentHistory && patient.paymentHistory.length > 0) ||
              amountReceived > 0) && (
              <div className="no-print" style={{ marginTop: '1rem' }}>
                <div className="section-label" style={{ marginBottom: '0.5rem' }}>
                  Payment history
                </div>
                {(patient.paymentHistory || []).length === 0 ? (
                  <p className="charge-attach-hint" style={{ margin: 0 }}>
                    Total recorded: {formatMoney(amountReceived)} (before detailed history)
                  </p>
                ) : (
                  <div className="charges-table-wrap">
                    <table className="charges-table">
                      <thead>
                        <tr>
                          <th>Date & time</th>
                          <th>Note</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th className="actions-col" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...(patient.paymentHistory || [])]
                          .sort(
                            (a, b) =>
                              new Date(b.receivedAt).getTime() -
                              new Date(a.receivedAt).getTime()
                          )
                          .map((p) => (
                            <tr key={p._id}>
                              <td>{formatDateTime(p.receivedAt)}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {p.note || '—'}
                              </td>
                              <td className="amount">{formatMoney(p.amount)}</td>
                              <td className="actions-col">
                                <SlipActionMenu
                                  label="Receipt"
                                  busy={sendingWhatsApp}
                                  onPrint={() => printPaymentReceipt(p)}
                                  onWhatsApp={
                                    canManageBilling
                                      ? () => handleSendWhatsApp('payment', p._id)
                                      : undefined
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {!isAdmitted && (
              <div
                className="bill-row"
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span style={{ fontWeight: 500 }}>Rupees (in words)</span>
                <span style={{ color: 'var(--text)' }}>{numberToWords(total)}</span>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {canManageBilling && showCharge && (
        <div className="modal-overlay" onClick={() => setShowCharge(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Daily Charge</h2>
              <button type="button" className="btn-icon" onClick={() => setShowCharge(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddCharge}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Particular <span className="req">*</span></label>
                  <select
                    className="form-select"
                    value={charge.particular}
                    onChange={setChargeField('particular')}
                    required
                  >
                    {particulars.length === 0 && (
                      <option value="">No categories — add in Charge Category</option>
                    )}
                    {particulars.map((p) => (
                      <option key={p._id || p.name} value={p.name}>
                        {p.name}
                        {p.ratePerDay ? ` (Rs. ${p.ratePerDay}/day)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={charge.date}
                    onChange={setChargeField('date')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Days <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={charge.days}
                    onChange={setChargeField('days')}
                    min="1"
                    step="1"
                    placeholder="e.g. 3"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rate / Day</label>
                  <input
                    className="form-input"
                    value={
                      Number(charge.ratePerDay) > 0
                        ? `Rs. ${Number(charge.ratePerDay).toLocaleString('en-PK')}`
                        : 'No rate set for this category'
                    }
                    disabled
                    readOnly
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    From Charge Category (not editable here)
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (Rs.)</label>
                  <input
                    className="form-input"
                    value={charge.amount}
                    disabled
                    readOnly
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Days × rate
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Note</label>
                  <input
                    className="form-input"
                    value={charge.note}
                    onChange={setChargeField('note')}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Charge'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCharge(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canDischarge && showDischarge && (
        <div className="modal-overlay" onClick={() => setShowDischarge(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Discharge Patient</h2>
              <button type="button" className="btn-icon" onClick={() => setShowDischarge(false)}>
                ×
              </button>
            </div>
            <div className="bill-summary" style={{ marginBottom: '1rem', marginTop: 0 }}>
              <div className="bill-row">
                <span>Total Charges</span>
                <span>{formatMoney(total)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="bill-row">
                  <span>
                    Less: Discount
                    {discountLabel(patient) ? ` (${discountLabel(patient)})` : ''}
                  </span>
                  <span>- {formatMoney(discountAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="bill-row">
                  <span>Net Charges</span>
                  <span>{formatMoney(netTotal)}</span>
                </div>
              )}
              {advance > 0 && (
                <div className="bill-row">
                  <span>Less: Advance</span>
                  <span>- {formatMoney(advance)}</span>
                </div>
              )}
              <div className="bill-row">
                <span>Already Received</span>
                <span>- {formatMoney(amountReceived)}</span>
              </div>
              <div className="bill-row balance">
                <span>Balance Due</span>
                <span>{formatMoney(dischargeRemainingDue)}</span>
              </div>
              {!canConfirmDischarge && (
                <p className="form-hint" style={{ marginTop: '0.5rem', color: 'var(--danger, #b91c1c)' }}>
                  Clear all dues before discharge. Enter the remaining amount received, or add
                  payments on the bill first.
                </p>
              )}
            </div>
            <form onSubmit={handleDischarge}>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label className="form-label">Discharge Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dischargeForm.dischargeDate}
                    onChange={setDischargeField('dischargeDate')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Discharge Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={dischargeForm.dischargeTime}
                    onChange={setDischargeField('dischargeTime')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Advance (Rs.)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={dischargeForm.advance}
                    onChange={setDischargeField('advance')}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Received (Rs.)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    value={dischargeForm.amountReceived}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setDischargeForm((f) => ({ ...f, amountReceived: v }));
                      }
                    }}
                    placeholder={String(
                      Math.max(0, total - dischargeAdvance - amountReceived)
                    )}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Co. / Pvt.</label>
                  <select
                    className="form-select"
                    value={dischargeForm.patientType}
                    onChange={setDischargeField('patientType')}
                  >
                    <option value="">Select</option>
                    <option value="Co.">Co.</option>
                    <option value="Pvt.">Pvt.</option>
                  </select>
                </div>
                <div className="form-group span-2">
                  <label className="form-label">
                    Discharge Type <span className="req">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={dischargeForm.dischargeType}
                    onChange={setDischargeField('dischargeType')}
                    required
                  >
                    <option value="">Select discharge type</option>
                    {DISCHARGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="section-label" style={{ marginTop: '1.25rem' }}>
                Clinical Summary
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Principle Diagnosis</label>
                  <textarea
                    className="form-textarea"
                    value={dischargeForm.principleDiagnosis}
                    onChange={setDischargeField('principleDiagnosis')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Associate Diagnosis</label>
                  <textarea
                    className="form-textarea"
                    value={dischargeForm.associateDiagnosis}
                    onChange={setDischargeField('associateDiagnosis')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">History & Examination</label>
                  <textarea
                    className="form-textarea"
                    value={dischargeForm.historyExamination}
                    onChange={setDischargeField('historyExamination')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Investigation</label>
                  <textarea
                    className="form-textarea"
                    value={dischargeForm.investigation}
                    onChange={setDischargeField('investigation')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Management and Hospital Course</label>
                  <textarea
                    className="form-textarea"
                    value={dischargeForm.managementHospitalCourse}
                    onChange={setDischargeField('managementHospitalCourse')}
                    rows={3}
                  />
                </div>
              </div>

              <div className="card-header" style={{ marginTop: '1.25rem', marginBottom: '0.75rem' }}>
                <div className="section-label" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
                  Medicines
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addMedicineRow}>
                  + Add
                </button>
              </div>
              <div className="medicine-rows">
                {dischargeForm.medicines.map((med, index) => (
                  <div key={index} className="medicine-row">
                    <div className="form-grid cols-2">
                      <div className="form-group">
                        <label className="form-label">Name of Medicine</label>
                        <input
                          className="form-input"
                          value={med.name}
                          onChange={setMedicineField(index, 'name')}
                          placeholder="Medicine name"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Dose</label>
                        <input
                          className="form-input"
                          value={med.dose}
                          onChange={setMedicineField(index, 'dose')}
                          placeholder="e.g. 500mg"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Timing</label>
                        <input
                          className="form-input"
                          value={med.timing}
                          onChange={setMedicineField(index, 'timing')}
                          placeholder="e.g. 1+0+1"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Duration</label>
                        <div className="medicine-duration-row">
                          <input
                            className="form-input"
                            value={med.duration}
                            onChange={setMedicineField(index, 'duration')}
                            placeholder="e.g. 5 days"
                          />
                          <button
                            type="button"
                            className="btn-icon"
                            title="Remove"
                            onClick={() => removeMedicineRow(index)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ marginTop: '1.25rem' }}>
                Follow-up After Discharge
              </div>
              <div className="form-grid cols-3">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dischargeForm.followUpDate}
                    onChange={setDischargeField('followUpDate')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Day</label>
                  <input
                    className="form-input"
                    value={dischargeForm.followUpDay}
                    onChange={setDischargeField('followUpDay')}
                    placeholder="e.g. Monday"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={dischargeForm.followUpTime}
                    onChange={setDischargeField('followUpTime')}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={saving || !canConfirmDischarge}
                  title={
                    !canConfirmDischarge
                      ? `Clear dues first (${formatMoney(dischargeRemainingDue)} remaining)`
                      : undefined
                  }
                >
                  {saving ? 'Discharging...' : 'Confirm Discharge'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDischarge(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canEditClinical && showClinical && (
        <div className="modal-overlay" onClick={() => setShowClinical(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Clinical Summary</h2>
              <button type="button" className="btn-icon" onClick={() => setShowClinical(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSaveClinical}>
              <div className="form-grid">
                {TERMINOLOGY_TYPES.map(({ value, label, field }) => (
                  <ClinicalTermField
                    key={field}
                    label={label}
                    value={clinicalForm[field] || ''}
                    onChange={(next) =>
                      setClinicalForm((f) => ({ ...f, [field]: next }))
                    }
                    options={clinicalTerms[field] || []}
                    onAddOption={async (text) => {
                      await addTerminologyOption(value, text);
                    }}
                    rows={3}
                  />
                ))}
                <div className="form-group">
                  <label className="form-label">Co. / Pvt.</label>
                  <select
                    className="form-select"
                    value={clinicalForm.patientType}
                    onChange={setClinicalField('patientType')}
                  >
                    <option value="">Select</option>
                    <option value="Co.">Co.</option>
                    <option value="Pvt.">Pvt.</option>
                  </select>
                </div>
              </div>

              <div className="card-header" style={{ marginTop: '1.25rem', marginBottom: '0.75rem' }}>
                <div className="section-label" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
                  Medicines
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addClinicalMedicineRow}>
                  + Add
                </button>
              </div>
              <div className="medicine-rows">
                {clinicalForm.medicines.map((med, index) => (
                  <div key={index} className="medicine-row">
                    <div className="form-grid cols-2">
                      <div className="form-group">
                        <label className="form-label">Name of Medicine</label>
                        <select
                          className="form-select"
                          value={
                            clinicalTerms.medicine.includes(med.name) ? med.name : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) {
                              setClinicalForm((f) => {
                                const medicines = [...f.medicines];
                                medicines[index] = { ...medicines[index], name: v };
                                return { ...f, medicines };
                              });
                            }
                          }}
                        >
                          <option value="">Select medicine…</option>
                          {clinicalTerms.medicine.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="form-input"
                          style={{ marginTop: '0.35rem' }}
                          value={med.name}
                          onChange={setClinicalMedicineField(index, 'name')}
                          placeholder="Or type / add new medicine name"
                          list={`clin-med-names-${index}`}
                        />
                        <datalist id={`clin-med-names-${index}`}>
                          {clinicalTerms.medicine.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        {med.name.trim() &&
                          !clinicalTerms.medicine.includes(med.name.trim()) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ marginTop: '0.25rem' }}
                              onClick={async () => {
                                try {
                                  await addTerminologyOption('medicine', med.name.trim());
                                } catch (err) {
                                  setError(
                                    err.response?.data?.message ||
                                      'Failed to save medicine name'
                                  );
                                }
                              }}
                            >
                              Save “{med.name.trim()}” to medicine list
                            </button>
                          )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Dose</label>
                        <input
                          className="form-input"
                          value={med.dose}
                          onChange={setClinicalMedicineField(index, 'dose')}
                          placeholder="e.g. 500mg"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Timing</label>
                        <select
                          className="form-select"
                          value={
                            clinicalTerms.medicineTiming.includes(med.timing)
                              ? med.timing
                              : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setClinicalForm((f) => {
                              const medicines = [...f.medicines];
                              medicines[index] = {
                                ...medicines[index],
                                timing: v,
                              };
                              return { ...f, medicines };
                            });
                          }}
                        >
                          <option value="">Select timing…</option>
                          {clinicalTerms.medicineTiming.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <input
                          className="form-input"
                          style={{ marginTop: '0.35rem' }}
                          value={med.timing}
                          onChange={setClinicalMedicineField(index, 'timing')}
                          placeholder="Or type timing (e.g. 1+0+1)"
                          list={`clin-med-timing-${index}`}
                        />
                        <datalist id={`clin-med-timing-${index}`}>
                          {clinicalTerms.medicineTiming.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Duration</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="form-input"
                            value={med.duration}
                            onChange={setClinicalMedicineField(index, 'duration')}
                            placeholder="e.g. 5 days"
                          />
                          <button
                            type="button"
                            className="btn-icon"
                            title="Remove"
                            onClick={() => removeClinicalMedicineRow(index)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ marginTop: '1.25rem' }}>
                Follow-up After Discharge
              </div>
              <div className="form-grid cols-3">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={clinicalForm.followUpDate}
                    onChange={setClinicalField('followUpDate')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Day</label>
                  <input
                    className="form-input"
                    value={clinicalForm.followUpDay}
                    onChange={setClinicalField('followUpDay')}
                    placeholder="e.g. Monday"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={clinicalForm.followUpTime}
                    onChange={setClinicalField('followUpTime')}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Clinical Summary'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowClinical(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isClinician && (
        <>
          <AdvancePaymentSlip patient={patient} />
          <PaymentReceiptSlip patient={patient} payment={receiptPayment} />
          <PatientBillPrint patient={patient} mode="simple" />
          <PatientBillPrint patient={patient} mode="detailed" />
          {!isAdmitted && <DischargeSummaryPrint patient={patient} />}
        </>
      )}
    </>
  );
}
