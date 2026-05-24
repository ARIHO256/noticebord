export const SCHOOLS = [
  'School of Business',
  'School of Computing and Informatics',
  'School of Education',
  'School of Health Sciences',
  'School of Natural Sciences',
  'School of Social Sciences',
  'School of Theology and Religious Studies',
];

export const DEPARTMENTS_BY_SCHOOL: Record<string, string[]> = {
  'School of Business': [
    'Department of Accounting and Finance',
    'Department of Management',
  ],
  'School of Computing and Informatics': [
    'Department of Systems Engineering',
    'Department of Information Systems',
  ],
  'School of Education': [
    'Department of Arts Education',
    'Department of Language Education',
    'Department of Science Education',
  ],
  'School of Health Sciences': [
    'Department of Nursing and Midwifery',
    'Department of Nutrition and Food Science and Technology',
  ],
  'School of Natural Sciences': [
    'Department of Agricultural Science',
    'Department of Life and Physical Sciences',
  ],
  'School of Social Sciences': [
    'Department of Developmental Studies',
    'Department of Public Administration and Management',
    'Department of Social Work and Social Administration',
  ],
  'School of Theology and Religious Studies': [
    'Department of Theology',
    'Department of Religious Studies',
  ],
};

export const COURSES_BY_DEPARTMENT: Record<string, string[]> = {
  'Department of Accounting and Finance': [
    'Bachelor of Business Administration (Accounting)',
    'Bachelor of Commerce (Finance)',
    'Diploma in Accounting',
  ],
  'Department of Management': [
    'Bachelor of Business Administration (Management)',
    'Bachelor of Business Administration (Entrepreneurship)',
    'Diploma in Management',
  ],
  'Department of Systems Engineering': [
    'Bachelor of Science in Systems Engineering',
    'Diploma in Systems Engineering',
  ],
  'Department of Information Systems': [
    'Bachelor of Science in Information Systems',
    'Diploma in Information Systems',
  ],
  'Department of Arts Education': [
    'Bachelor of Arts with Education',
    'Diploma in Arts Education',
  ],
  'Department of Language Education': [
    'Bachelor of Arts in Language Education',
    'Diploma in Language Education',
  ],
  'Department of Science Education': [
    'Bachelor of Science with Education',
    'Diploma in Science Education',
  ],
  'Department of Nursing and Midwifery': [
    'Bachelor of Science in Nursing',
    'Diploma in Nursing',
    'Diploma in Midwifery',
  ],
  'Department of Nutrition and Food Science and Technology': [
    'Bachelor of Science in Nutrition',
    'Bachelor of Science in Food Science and Technology',
    'Diploma in Nutrition',
  ],
  'Department of Agricultural Science': [
    'Bachelor of Science in Agricultural Science',
    'Diploma in Agricultural Science',
  ],
  'Department of Life and Physical Sciences': [
    'Bachelor of Science in Life Sciences',
    'Bachelor of Science in Physical Sciences',
  ],
  'Department of Developmental Studies': [
    'Bachelor of Arts in Developmental Studies',
    'Diploma in Developmental Studies',
  ],
  'Department of Public Administration and Management': [
    'Bachelor of Public Administration',
    'Diploma in Public Administration',
  ],
  'Department of Social Work and Social Administration': [
    'Bachelor of Social Work and Social Administration',
    'Diploma in Social Work',
  ],
  'Department of Theology': [
    'Bachelor of Theology',
    'Diploma in Theology',
  ],
  'Department of Religious Studies': [
    'Bachelor of Arts in Religious Studies',
    'Diploma in Religious Studies',
  ],
};

const startYear = 2010;
const endYear = 2026;
export const ACADEMIC_YEARS = Array.from({ length: endYear - startYear }, (_, idx) => {
  const first = startYear + idx;
  const second = first + 1;
  return `${first}-${second}`;
});

// Cross-cutting official departments that send notices to all students
export const CROSS_CUTTING_OFFICIAL_DEPARTMENTS = [
  'Registrar',
  'Vice Chancellor',
  'Business Office',
  'Head of Security',
  'Chaplain',
];
