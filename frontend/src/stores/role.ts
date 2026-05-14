import { ref } from 'vue';

export type DemoRole = 'admin' | 'teacher' | 'student' | 'third';

/** 演示用角色，不连接真实校园身份 */
export const currentRole = ref<DemoRole>('admin');

export function canWriteScores(): boolean {
  return currentRole.value === 'admin' || currentRole.value === 'teacher';
}
