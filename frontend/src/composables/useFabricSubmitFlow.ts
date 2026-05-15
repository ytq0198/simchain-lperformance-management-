import { ref } from 'vue';

const STEPS = [
  'Step 1：向背书节点发送提案（Endorsing）…',
  'Step 2：Orderer 排序与广播（Ordering）…',
  'Step 3：等待提交状态（Committing）…',
  'Step 4：区块同步与状态落账…',
] as const;

/**
 * 在真实 axios 请求进行的同时轮播 Fabric 流程说明，缓解等待焦虑。
 * 请求结束后自动清空文案。
 */
export function useFabricSubmitFlow() {
  const stepIndex = ref(-1);
  const stepLabel = ref('');
  let timer: ReturnType<typeof setInterval> | null = null;

  function clearTimer() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
    stepIndex.value = -1;
    stepLabel.value = '';
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    clearTimer();
    let i = 0;
    stepLabel.value = STEPS[0];
    stepIndex.value = 0;
    timer = setInterval(() => {
      i = (i + 1) % STEPS.length;
      stepIndex.value = i;
      stepLabel.value = STEPS[i];
    }, 900);
    try {
      return await fn();
    } finally {
      clearTimer();
    }
  }

  return { stepLabel, stepIndex, run, STEPS };
}
