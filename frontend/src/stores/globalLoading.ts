import NProgress from 'nprogress';

NProgress.configure({ showSpinner: false, trickleSpeed: 280, minimum: 0.12 });

let count = 0;

export function loadingStart(): void {
  count += 1;
  if (count === 1) {
    NProgress.start();
  }
}

export function loadingDone(): void {
  count = Math.max(0, count - 1);
  if (count === 0) {
    NProgress.done();
  }
}
