import { EventEmitter } from 'events';

export type FabricCommitPayload = {
  kind: string;
  transactionId: string;
  at: number;
  detail?: Record<string, unknown>;
};

export const commitBus = new EventEmitter();
commitBus.setMaxListeners(200);

export function emitFabricCommit(payload: FabricCommitPayload): void {
  commitBus.emit('commit', payload);
}
