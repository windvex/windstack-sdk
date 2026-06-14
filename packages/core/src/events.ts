export type EventHandler<TPayload = unknown> = (payload: TPayload) => void;
export type EventMap = Record<string, unknown>;

export class WispEventEmitter<TEvents extends EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<EventHandler<TEvents[keyof TEvents]>>>();

  on<TEvent extends keyof TEvents>(event: TEvent, handler: EventHandler<TEvents[TEvent]>): void {
    const current = this.listeners.get(event) ?? new Set<EventHandler<TEvents[keyof TEvents]>>();
    current.add(handler as EventHandler<TEvents[keyof TEvents]>);
    this.listeners.set(event, current);
  }

  off<TEvent extends keyof TEvents>(event: TEvent, handler: EventHandler<TEvents[TEvent]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<TEvents[keyof TEvents]>);
  }

  once<TEvent extends keyof TEvents>(event: TEvent, handler: EventHandler<TEvents[TEvent]>): void {
    const onceHandler: EventHandler<TEvents[TEvent]> = (payload) => {
      this.off(event, onceHandler);
      handler(payload);
    };
    this.on(event, onceHandler);
  }

  emit<TEvent extends keyof TEvents>(event: TEvent, payload: TEvents[TEvent]): void {
    const current = this.listeners.get(event);
    if (!current) return;
    for (const handler of [...current]) handler(payload as TEvents[keyof TEvents]);
  }

  removeAllListeners<TEvent extends keyof TEvents>(event?: TEvent): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.clear();
  }
}
