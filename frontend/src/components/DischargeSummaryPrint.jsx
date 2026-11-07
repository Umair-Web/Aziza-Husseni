function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function padMedicines(medicines, minRows = 10) {
  const list = [...(medicines || [])];
  while (list.length < minRows) {
    list.push({ name: '', dose: '', timing: '', duration: '' });
  }
  return list;
}

export default function DischargeSummaryPrint({ patient }) {
  if (!patient) return null;

  const medicines = padMedicines(patient.medicines, 10);
  const leftMeds = medicines.slice(0, 5);
  const rightMeds = medicines.slice(5, 10);

  return (
    <div className="discharge-print a4-sheet">
      <header className="dp-header">
        <div className="dp-brand">
          <div>
            <div className="dp-hospital">AZIZA HUSSENI HOSPITAL</div>
            <div className="dp-address">C-52/13, F.B. Area, Karachi</div>
            <div className="dp-phones">Phones: 36360526, 36806905</div>
          </div>
        </div>
        <div className="dp-id-box">
          <div className="dp-id-row">
            <span>Name</span>
            <b>{patient.name || ''}</b>
          </div>
          <div className="dp-id-row">
            <span>S/o, D/o, W/o</span>
            <b>{patient.relativeOf || ''}</b>
          </div>
          <div className="dp-id-grid">
            <div className="dp-id-row">
              <span>Unit</span>
              <b>{patient.bedNo || ''}</b>
            </div>
            <div className="dp-id-row">
              <span>Co./Pvt.</span>
              <b>{patient.patientType || ''}</b>
            </div>
            <div className="dp-id-row">
              <span>Sex</span>
              <b>{patient.gender || ''}</b>
            </div>
            <div className="dp-id-row">
              <span>Reg. No.</span>
              <b>{patient.hospitalRegNo || ''}</b>
            </div>
            <div className="dp-id-row span2">
              <span>Age</span>
              <b>
                {patient.age != null ? `${patient.age} ${patient.ageUnit || ''}`.trim() : ''}
              </b>
            </div>
          </div>
        </div>
      </header>

      <div className="dp-title-row">
        <div>
          No. <b>{patient.billNo || patient.hospitalRegNo || ''}</b>
        </div>
        <h1>CLINICAL SUMMARY ON DISCHARGE</h1>
      </div>

      <div className="dp-consultant-box">
        <span>Consultant (Print Name)</span>
        <b>{patient.consultant || ''}</b>
      </div>

      <div className="dp-dates">
        <div>
          <span>Date of Admission</span>
          <b>{formatDate(patient.admissionDate)}</b>
        </div>
        <div>
          <span>Date of Discharge</span>
          <b>{formatDate(patient.dischargeDate)}</b>
        </div>
      </div>

      <section className="dp-clinical">
        <div className="dp-field">
          <strong>Principal Diagnosis :</strong>
          <p>{patient.principleDiagnosis || ''}</p>
        </div>
        <div className="dp-field">
          <strong>Associate Diagnosis :</strong>
          <p>{patient.associateDiagnosis || ''}</p>
        </div>
        <div className="dp-field">
          <strong>History &amp; Examination :</strong>
          <p>{patient.historyExamination || ''}</p>
        </div>
        <div className="dp-field">
          <strong>Investigation :</strong>
          <p>{patient.investigation || ''}</p>
        </div>
        <div className="dp-field">
          <strong>Management and hospital course :</strong>
          <p>{patient.managementHospitalCourse || ''}</p>
        </div>
      </section>

      <section className="dp-meds">
        <div className="dp-meds-title">Medications on Discharge :</div>
        <div className="dp-meds-grid">
          <table>
            <thead>
              <tr>
                <th>Sr. #</th>
                <th>Name of Medicine</th>
                <th>Dose</th>
                <th>Timing</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {leftMeds.map((m, i) => (
                <tr key={`l-${i}`}>
                  <td>{i + 1}</td>
                  <td>{m.name || ''}</td>
                  <td>{m.dose || ''}</td>
                  <td>{m.timing || ''}</td>
                  <td>{m.duration || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Sr. #</th>
                <th>Name of Medicine</th>
                <th>Dose</th>
                <th>Timing</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {rightMeds.map((m, i) => (
                <tr key={`r-${i}`}>
                  <td>{i + 6}</td>
                  <td>{m.name || ''}</td>
                  <td>{m.dose || ''}</td>
                  <td>{m.timing || ''}</td>
                  <td>{m.duration || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dp-followup">
        <strong>Follow - up After Discharge</strong>
        <div className="dp-followup-fields">
          <span>
            Date <b>{formatDate(patient.followUpDate) || patient.followUpDate || '______________'}</b>
          </span>
          <span>
            Day <b>{patient.followUpDay || '______________'}</b>
          </span>
          <span>
            Time <b>{patient.followUpTime || '______________'}</b>
          </span>
        </div>
      </section>

      <section className="dp-sign">
        <div className="dp-sign-line">
          <div className="dp-sign-name" />
          <div>Sr. Resident Medical Officer (Name and Signature)</div>
        </div>
      </section>

      <footer className="dp-footer">
        <span>Original - Medical Records</span>
        <span>Copy - Patient</span>
      </footer>
    </div>
  );
}
