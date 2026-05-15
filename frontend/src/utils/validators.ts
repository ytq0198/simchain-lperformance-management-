import type { FormItemRule } from 'element-plus';

/** 学号：4～24 位字母、数字、下划线或连字符（可按学校规则改） */
export const studentIdRules: FormItemRule[] = [
  { required: true, message: '请输入学号', trigger: 'blur' },
  {
    pattern: /^[A-Za-z0-9_-]{4,24}$/,
    message: '学号须为 4～24 位字母、数字、_ 或 -',
    trigger: 'blur',
  },
];

/** 学期：如 2024-1、2024-09 */
export const semesterRules: FormItemRule[] = [
  { required: true, message: '请输入学期', trigger: 'blur' },
  {
    pattern: /^\d{4}-\d{1,2}$/,
    message: '学期格式建议为 年份-学期，如 2024-1',
    trigger: 'blur',
  },
];

export const courseIdRules: FormItemRule[] = [
  { required: true, message: '请输入课程代码', trigger: 'blur' },
  {
    min: 2,
    max: 32,
    message: '课程代码长度 2～32',
    trigger: 'blur',
  },
];
