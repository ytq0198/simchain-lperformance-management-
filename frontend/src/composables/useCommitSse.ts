import { watch } from 'vue';
import { ElNotification } from 'element-plus';
import { authToken } from '../stores/auth';

let es: EventSource | null = null;

/** 订阅后端提交成功事件（SSE；EventSource 无法自定义 Header，使用 `?token=` 演示内网） */
export function setupCommitSse(): void {
  watch(
    () => authToken.value,
    (t) => {
      es?.close();
      es = null;
      if (!t) return;
      const base = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';
      if (!base) return;
      const url = `${base}/api/events/stream?token=${encodeURIComponent(t)}`;
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data) as { kind?: string; transactionId?: string };
          ElNotification({
            title: '链上事件',
            message: `${d.kind ?? 'commit'} · ${d.transactionId ?? ''}`.trim(),
            type: 'success',
            duration: 6500,
          });
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
      };
    },
    { immediate: true },
  );
}
