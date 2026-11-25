import {
  EventSourceType,
  OsEventTypeList,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';

export type HardwareAction =
  | { type: 'click'; listIndex?: number; source: string }
  | { type: 'double_click'; source: string }
  | { type: 'scroll_up'; listIndex?: number; source: string }
  | { type: 'scroll_down'; listIndex?: number; source: string }
  | { type: 'system_exit'; source: string }
  | { type: 'audio'; audioPcm: Uint8Array };

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null;
  // Protobuf omits zero-value fields on the wire, so CLICK_EVENT (0) arrives as undefined.
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT;
}

function sourceNameOf(source?: EventSourceType): string {
  switch (source) {
    case EventSourceType.TOUCH_EVENT_FROM_RING:
      return 'R1 Ring';
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_R:
      return 'G2 Right';
    case EventSourceType.TOUCH_EVENT_FROM_GLASSES_L:
      return 'G2 Left';
    default:
      return 'Hardware';
  }
}

export function normalizeEvenHubEvent(event: EvenHubEvent): HardwareAction | null {
  if (event.audioEvent?.audioPcm) {
    return { type: 'audio', audioPcm: event.audioEvent.audioPcm };
  }

  const sysType = eventTypeOf(event.sysEvent);
  const textType = eventTypeOf(event.textEvent);
  const listType = eventTypeOf(event.listEvent);
  const source = sourceNameOf(event.sysEvent?.eventSource);

  if (
    sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
    sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    return { type: 'system_exit', source };
  }

  // Always check DOUBLE_CLICK_EVENT before CLICK_EVENT.
  if (
    sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    textType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    listType === OsEventTypeList.DOUBLE_CLICK_EVENT
  ) {
    return { type: 'double_click', source };
  }

  if (
    sysType === OsEventTypeList.SCROLL_TOP_EVENT ||
    textType === OsEventTypeList.SCROLL_TOP_EVENT ||
    listType === OsEventTypeList.SCROLL_TOP_EVENT
  ) {
    const listIndex = event.listEvent ? (event.listEvent.currentSelectItemIndex ?? 0) : undefined;
    return { type: 'scroll_up', listIndex, source };
  }

  if (
    sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
    textType === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
    listType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    const listIndex = event.listEvent ? (event.listEvent.currentSelectItemIndex ?? 0) : undefined;
    return { type: 'scroll_down', listIndex, source };
  }

  if (event.listEvent && listType === OsEventTypeList.CLICK_EVENT) {
    return {
      type: 'click',
      // Protobuf omits zero-value index 0 on wire.
      listIndex: event.listEvent.currentSelectItemIndex ?? 0,
      source,
    };
  }

  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    return { type: 'click', source };
  }

  return null;
}
