// Cell map of CS Form No. 212 (Revised 2026) Personal Data Sheet.
// Everything about the template lives here; the engine and the editor read it.

export interface FieldDef {
  id: string;
  sheet: 'C1' | 'C2' | 'C3' | 'C4';
  ref: string;
  label: string;
  section: string;
  group?: string;
  num?: boolean;
  wide?: boolean;
  hint?: string;
}

export interface ColDef {
  key: string;
  col: string;
  label: string;
  num?: boolean;
  wide?: boolean;
}

export interface TableDef {
  id: string;
  sheet: 'C1' | 'C2' | 'C3' | 'C4';
  section: string;
  title: string;
  rowLabel: string; // "entry"
  first: number;
  last: number;
  cols: ColDef[];
  fixedLabels?: string[]; // education: one fixed row per level
  marker?: boolean; // writes "*** NOTHING FOLLOWS ***" after the last entry
  markerCols?: string; // e.g. 'A:M' full width of the form table
  // layout used to repair a row before writing: merged ranges and the row whose styles to copy
  layout?: { refRow: number; merges: string[]; from: string; to: string };
  note?: string;
}

export interface RadioDef {
  id: string;
  sheet: 'C1';
  section: string;
  label: string;
  options: { value: string; label: string; ref: string }[];
}

export interface QuestionDef {
  id: string;
  num: string;
  text: string;
  yes: string;
  no: string;
  // where the details go: 'inline' = label cell text "<prefix><details>", 'cell' = a value cell
  details?: { ref: string; mode: 'inline' | 'cell'; prefix?: string };
  extra?: { key: string; label: string; ref: string }[];
}

export const SHEETS = ['C1', 'C2', 'C3', 'C4'] as const;

export const SECTIONS = [
  { id: 'personal', title: 'I. Personal Information' },
  { id: 'family', title: 'II. Family Background' },
  { id: 'education', title: 'III. Educational Background' },
  { id: 'eligibility', title: 'IV. Civil Service Eligibility' },
  { id: 'work', title: 'V. Work Experience' },
  { id: 'learning', title: 'VI. Learning and Development' },
  { id: 'voluntary', title: 'VII. Voluntary Work' },
  { id: 'other', title: 'VIII. Other Information' },
  { id: 'questions', title: 'Questions 34 – 40' },
  { id: 'references', title: 'References and Declaration' },
];

const f = (id: string, sheet: FieldDef['sheet'], ref: string, label: string, section: string, o: Partial<FieldDef> = {}): FieldDef => ({
  id, sheet, ref, label, section, ...o,
});

export const FIELDS: FieldDef[] = [
  f('surname', 'C1', 'D10', 'Surname', 'personal'),
  f('firstName', 'C1', 'D11', 'First name', 'personal'),
  f('nameExt', 'C1', 'N11', 'Name extension (Jr., Sr.)', 'personal'),
  f('middleName', 'C1', 'D12', 'Middle name', 'personal'),
  f('dob', 'C1', 'D13', 'Date of birth (dd/mm/yyyy)', 'personal'),
  f('pob', 'C1', 'D15', 'Place of birth', 'personal'),
  f('height', 'C1', 'D22', 'Height (m)', 'personal', { num: true }),
  f('weight', 'C1', 'D24', 'Weight (kg)', 'personal', { num: true }),
  f('blood', 'C1', 'D25', 'Blood type', 'personal'),
  f('umid', 'C1', 'D27', 'UMID ID No.', 'personal'),
  f('pagibig', 'C1', 'D29', 'PAG-IBIG ID No.', 'personal'),
  f('philhealth', 'C1', 'D31', 'PhilHealth No.', 'personal'),
  f('philsys', 'C1', 'D32', 'PhilSys Card Number (PCN)', 'personal'),
  f('tin', 'C1', 'D33', 'TIN No.', 'personal'),
  f('agencyNo', 'C1', 'D34', 'Agency employee No.', 'personal'),
  f('civilOther', 'C1', 'E20', 'Civil status – others, specify', 'personal'),
  f('resHouse', 'C1', 'I17', 'House/Block/Lot No.', 'personal', { group: 'Residential address' }),
  f('resStreet', 'C1', 'L17', 'Street', 'personal', { group: 'Residential address' }),
  f('resSubdivision', 'C1', 'I19', 'Subdivision/Village', 'personal', { group: 'Residential address' }),
  f('resBarangay', 'C1', 'L19', 'Barangay', 'personal', { group: 'Residential address' }),
  f('resCity', 'C1', 'I22', 'City/Municipality', 'personal', { group: 'Residential address' }),
  f('resProvince', 'C1', 'L22', 'Province', 'personal', { group: 'Residential address' }),
  f('resZip', 'C1', 'I24', 'ZIP code', 'personal', { group: 'Residential address' }),
  f('permHouse', 'C1', 'I25', 'House/Block/Lot No.', 'personal', { group: 'Permanent address' }),
  f('permStreet', 'C1', 'L25', 'Street', 'personal', { group: 'Permanent address' }),
  f('permSubdivision', 'C1', 'I27', 'Subdivision/Village', 'personal', { group: 'Permanent address' }),
  f('permBarangay', 'C1', 'L27', 'Barangay', 'personal', { group: 'Permanent address' }),
  f('permCity', 'C1', 'I29', 'City/Municipality', 'personal', { group: 'Permanent address' }),
  f('permProvince', 'C1', 'L29', 'Province', 'personal', { group: 'Permanent address' }),
  f('permZip', 'C1', 'I31', 'ZIP code', 'personal', { group: 'Permanent address' }),
  f('telephone', 'C1', 'I32', 'Telephone No.', 'personal', { group: 'Contact' }),
  f('mobile', 'C1', 'I33', 'Mobile No.', 'personal', { group: 'Contact' }),
  f('email', 'C1', 'I34', 'E-mail address', 'personal', { group: 'Contact' }),

  f('spSurname', 'C1', 'D36', "Spouse's surname", 'family', { group: 'Spouse' }),
  f('spFirst', 'C1', 'D37', 'First name', 'family', { group: 'Spouse' }),
  f('spExt', 'C1', 'H37', 'Name extension', 'family', { group: 'Spouse' }),
  f('spMiddle', 'C1', 'D38', 'Middle name', 'family', { group: 'Spouse' }),
  f('spOccupation', 'C1', 'D39', 'Occupation', 'family', { group: 'Spouse' }),
  f('spEmployer', 'C1', 'D40', 'Employer/Business name', 'family', { group: 'Spouse' }),
  f('spBusinessAddress', 'C1', 'D41', 'Business address', 'family', { group: 'Spouse' }),
  f('spTelephone', 'C1', 'D42', 'Telephone No.', 'family', { group: 'Spouse' }),
  f('faSurname', 'C1', 'D44', "Father's surname", 'family', { group: 'Father' }),
  f('faFirst', 'C1', 'D45', 'First name', 'family', { group: 'Father' }),
  f('faExt', 'C1', 'H45', 'Name extension', 'family', { group: 'Father' }),
  f('faMiddle', 'C1', 'D46', 'Middle name', 'family', { group: 'Father' }),
  f('moSurname', 'C1', 'D48', "Mother's maiden surname", 'family', { group: 'Mother (maiden name)' }),
  f('moFirst', 'C1', 'D49', 'First name', 'family', { group: 'Mother (maiden name)' }),
  f('moMiddle', 'C1', 'D50', 'Middle name', 'family', { group: 'Mother (maiden name)' }),

  f('govIdType', 'C4', 'D61', 'Government-issued ID', 'references', { group: 'Government ID' }),
  f('govIdNo', 'C4', 'D62', 'ID / License / Passport No.', 'references', { group: 'Government ID' }),
  f('govIdIssued', 'C4', 'D64', 'Date / Place of issuance', 'references', { group: 'Government ID' }),
];

export const RADIOS: RadioDef[] = [
  { id: 'sex', sheet: 'C1', section: 'personal', label: 'Sex at birth', options: [
    { value: 'Male', label: 'Male', ref: 'D16' }, { value: 'Female', label: 'Female', ref: 'E16' } ] },
  { id: 'civil', sheet: 'C1', section: 'personal', label: 'Civil status', options: [
    { value: 'Single', label: 'Single', ref: 'D17' }, { value: 'Married', label: 'Married', ref: 'E17' },
    { value: 'Widowed', label: 'Widowed', ref: 'D18' }, { value: 'Separated', label: 'Separated', ref: 'E19' },
    { value: 'Others', label: 'Others', ref: 'D20' } ] },
  { id: 'citizenship', sheet: 'C1', section: 'personal', label: 'Citizenship', options: [
    { value: 'Filipino', label: 'Filipino', ref: 'J13' }, { value: 'Dual', label: 'Dual citizenship', ref: 'K13' } ] },
  { id: 'dualBy', sheet: 'C1', section: 'personal', label: 'Dual citizenship – by', options: [
    { value: 'birth', label: 'By birth', ref: 'L14' }, { value: 'naturalization', label: 'By naturalization', ref: 'M14' } ] },
];

export const COUNTRY = { sheet: 'C1' as const, linkRef: 'J16', listFirst: 11, listLast: 217, listCol: 'Q' };

export const TABLES: TableDef[] = [
  { id: 'children', sheet: 'C1', section: 'family', title: 'Children', rowLabel: 'child', first: 37, last: 49, marker: true,
    cols: [{ key: 'name', col: 'I', label: 'Full name', wide: true }, { key: 'dob', col: 'M', label: 'Date of birth (dd/mm/yyyy)' }] },
  { id: 'education', sheet: 'C1', section: 'education', title: 'Educational background', rowLabel: 'level', first: 55, last: 59,
    fixedLabels: ['Elementary', 'Secondary', 'Vocational / Trade course', 'College', 'Graduate studies'],
    cols: [
      { key: 'school', col: 'D', label: 'Name of school', wide: true },
      { key: 'course', col: 'G', label: 'Basic education / Degree / Course', wide: true },
      { key: 'from', col: 'J', label: 'From (yyyy)' }, { key: 'to', col: 'K', label: 'To (yyyy)' },
      { key: 'highest', col: 'L', label: 'Highest level / Units earned' }, { key: 'year', col: 'M', label: 'Year graduated' },
      { key: 'honors', col: 'N', label: 'Scholarship / Academic honors' } ] },
  { id: 'eligibility', sheet: 'C2', section: 'eligibility', title: 'Civil service eligibility', rowLabel: 'eligibility', first: 5, last: 14,
    marker: true, markerCols: 'A:M', layout: { refRow: 6, merges: ['A:E', 'G:H', 'I:K'], from: 'A', to: 'M' },
    cols: [
      { key: 'name', col: 'A', label: 'Career service / RA 1080 / Board / Bar…', wide: true },
      { key: 'rating', col: 'F', label: 'Rating' }, { key: 'date', col: 'G', label: 'Date of examination' },
      { key: 'place', col: 'I', label: 'Place of examination', wide: true },
      { key: 'license', col: 'L', label: 'License number' }, { key: 'validity', col: 'M', label: 'License validity' } ] },
  { id: 'work', sheet: 'C2', section: 'work', title: 'Work experience', rowLabel: 'job', first: 21, last: 40,
    marker: true, markerCols: 'A:M', layout: { refRow: 22, merges: ['A:B', 'D:F', 'G:I'], from: 'A', to: 'M' },
    cols: [
      { key: 'from', col: 'A', label: 'From (dd/mm/yyyy)' }, { key: 'to', col: 'C', label: 'To (dd/mm/yyyy or Present)' },
      { key: 'position', col: 'D', label: 'Position title', wide: true }, { key: 'agency', col: 'G', label: 'Department / Agency / Office / Company', wide: true },
      { key: 'salary', col: 'J', label: 'Monthly salary', num: true }, { key: 'grade', col: 'K', label: 'Salary grade & step' },
      { key: 'status', col: 'L', label: 'Status of appointment' }, { key: 'govt', col: 'M', label: "Gov't service (Y/N)" } ] },
  { id: 'learning', sheet: 'C3', section: 'learning', title: 'Learning and development', rowLabel: 'training', first: 5, last: 8,
    marker: true, markerCols: 'A:K', layout: { refRow: 6, merges: ['A:D', 'I:K'], from: 'A', to: 'K' },
    cols: [
      { key: 'title', col: 'A', label: 'Title of L&D / training', wide: true },
      { key: 'from', col: 'E', label: 'From' }, { key: 'to', col: 'F', label: 'To' }, { key: 'hours', col: 'G', label: 'Hours' },
      { key: 'type', col: 'H', label: 'Type (Managerial/Supervisory/Technical…)' },
      { key: 'by', col: 'I', label: 'Conducted / sponsored by', wide: true } ] },
  { id: 'voluntary', sheet: 'C3', section: 'voluntary', title: 'Voluntary work', rowLabel: 'entry', first: 14, last: 34,
    marker: true, markerCols: 'A:K', layout: { refRow: 14, merges: ['A:D', 'I:K'], from: 'A', to: 'K' },
    note: 'In your form this table sits under the "Voluntary Work" heading. Anything typed in its columns appears here.',
    cols: [
      { key: 'org', col: 'A', label: 'Name & address of organization / title', wide: true },
      { key: 'from', col: 'E', label: 'From' }, { key: 'to', col: 'F', label: 'To' }, { key: 'hours', col: 'G', label: 'Hours' },
      { key: 'position', col: 'H', label: 'Position / nature of work / type' },
      { key: 'detail', col: 'I', label: 'Other detail (last column)', wide: true } ] },
  { id: 'skills', sheet: 'C3', section: 'other', title: 'Special skills and hobbies', rowLabel: 'skill', first: 38, last: 44,
    marker: true, layout: { refRow: 38, merges: ['A:B', 'C:H', 'I:K'], from: 'A', to: 'K' },
    cols: [{ key: 'text', col: 'A', label: 'Skill / hobby', wide: true }] },
  { id: 'distinctions', sheet: 'C3', section: 'other', title: 'Non-academic distinctions / recognition', rowLabel: 'recognition', first: 38, last: 44,
    marker: true, layout: { refRow: 38, merges: ['A:B', 'C:H', 'I:K'], from: 'A', to: 'K' },
    cols: [{ key: 'text', col: 'C', label: 'Distinction / recognition', wide: true }] },
  { id: 'memberships', sheet: 'C3', section: 'other', title: 'Membership in association / organization', rowLabel: 'membership', first: 38, last: 44,
    marker: true, layout: { refRow: 38, merges: ['A:B', 'C:H', 'I:K'], from: 'A', to: 'K' },
    cols: [{ key: 'text', col: 'I', label: 'Association / organization', wide: true }] },
  { id: 'references', sheet: 'C4', section: 'references', title: 'References (not related to you)', rowLabel: 'reference', first: 52, last: 54,
    cols: [{ key: 'name', col: 'A', label: 'Name', wide: true }, { key: 'address', col: 'G', label: 'Office / residential address', wide: true },
      { key: 'contact', col: 'H', label: 'Contact no. and/or email' }] },
];

export const QUESTIONS: QuestionDef[] = [
  { id: 'q34a', num: '34 a', text: 'Related to the appointing/recommending authority, chief of bureau/office or person who has immediate supervision over you, within the third degree?', yes: 'H3', no: 'J3',
    details: { ref: 'H5', mode: 'cell' } },
  { id: 'q34b', num: '34 b', text: 'Related to the same, within the fourth degree (for Local Government Unit – Career Employees)?', yes: 'H8', no: 'J8',
    details: { ref: 'H10', mode: 'inline', prefix: 'If YES, give details: ' } },
  { id: 'q35a', num: '35 a', text: 'Have you ever been found guilty of any administrative offense?', yes: 'H13', no: 'J13',
    details: { ref: 'H14', mode: 'inline', prefix: 'If YES, give details: ' } },
  { id: 'q35b', num: '35 b', text: 'Have you been criminally charged before any court?', yes: 'H18', no: 'J18',
    details: { ref: 'L19', mode: 'cell' },
    extra: [{ key: 'dateFiled', label: 'Date filed', ref: 'L20' }, { key: 'status', label: 'Status of case/s', ref: 'L21' }] },
  { id: 'q36', num: '36', text: 'Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any court or tribunal?', yes: 'H23', no: 'J23',
    details: { ref: 'H24', mode: 'inline', prefix: 'If YES, give details: ' } },
  { id: 'q37', num: '37', text: 'Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped from the rolls, dismissal, termination, end of term, finished contract or phased out?', yes: 'H27', no: 'J27',
    details: { ref: 'H28', mode: 'inline', prefix: 'If YES, give details: ' } },
  { id: 'q38a', num: '38 a', text: 'Have you ever been a candidate in a national or local election held within the last year (except Barangay election)?', yes: 'H31', no: 'J31',
    details: { ref: 'L32', mode: 'cell' } },
  { id: 'q38b', num: '38 b', text: 'Have you resigned from the government service during the three (3)-month period before the last election to promote/actively campaign for a national or local candidate?', yes: 'H34', no: 'J34',
    details: { ref: 'L35', mode: 'cell' } },
  { id: 'q39', num: '39', text: 'Have you acquired the status of an immigrant or permanent resident of another country?', yes: 'H37', no: 'J37',
    details: { ref: 'H38', mode: 'inline', prefix: 'If YES, give details (country): ' } },
  { id: 'q40a', num: '40 a', text: 'Are you a member of any indigenous group?', yes: 'H43', no: 'J43',
    details: { ref: 'H44', mode: 'inline', prefix: 'If YES, please specify: ' } },
  { id: 'q40b', num: '40 b', text: 'Are you a person with disability?', yes: 'H45', no: 'J45',
    details: { ref: 'H46', mode: 'inline', prefix: 'If YES, please specify ID No: ' } },
  { id: 'q40c', num: '40 c', text: 'Are you a solo parent?', yes: 'H47', no: 'J47',
    details: { ref: 'H48', mode: 'inline', prefix: 'If YES, please specify ID No: ' } },
];

// Sanity checks used to recognise the right form version.
export const SIGNATURE = [
  { sheet: 'C1', ref: 'A2', includes: 'CS Form No. 212' },
  { sheet: 'C1', ref: 'A3', includes: 'Revised 2026' },
  { sheet: 'C1', ref: 'B10', includes: 'SURNAME' },
  { sheet: 'C1', ref: 'B55', includes: 'ELEMENTARY' },
  { sheet: 'C2', ref: 'B3', includes: 'CAREER SERVICE' },
  { sheet: 'C4', ref: 'C2', includes: 'related by consanguinity' },
] as const;
