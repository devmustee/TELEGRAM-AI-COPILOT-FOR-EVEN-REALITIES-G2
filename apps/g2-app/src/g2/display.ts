import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { formatListItemLabel, truncateUtf8Bytes } from './formatter';

export type G2Layout =
  | {
      kind: 'text';
      header: string;
      body: string;
      footer: string;
    }
  | {
      kind: 'list';
      header: string;
      items: string[];
      footer: string;
    }
  | {
      kind: 'split';
      header: string;
      preview: string;
      items: string[];
      footer: string;
    };

const CONTAINER_ID = {
  header: 1,
  body: 2,
  footer: 3,
  list: 4,
  preview: 5,
} as const;

const CONTAINER_NAME = {
  header: 'hdr',
  body: 'body',
  footer: 'ftr',
  list: 'list',
  preview: 'prv',
} as const;

export class G2DisplayEngine {
  private readonly bridge: EvenAppBridge;
  private initialized = false;
  private activeKind: G2Layout['kind'] | null = null;
  private lastSignature = '';

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge;
  }

  async render(layout: G2Layout): Promise<void> {
    const signature = JSON.stringify(layout);
    if (signature === this.lastSignature) {
      return;
    }

    if (!this.initialized) {
      const startup = this.buildStartupPayload(layout);
      await this.bridge.createStartUpPageContainer(startup);
      this.initialized = true;
      this.activeKind = layout.kind;
      this.lastSignature = signature;
      return;
    }

    // Use flicker-free textContainerUpgrade when staying on the text layout.
    if (layout.kind === 'text' && this.activeKind === 'text') {
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID.header,
          containerName: CONTAINER_NAME.header,
          content: truncateUtf8Bytes(layout.header, 900),
        }),
      );
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID.body,
          containerName: CONTAINER_NAME.body,
          content: truncateUtf8Bytes(layout.body, 1900),
        }),
      );
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_ID.footer,
          containerName: CONTAINER_NAME.footer,
          content: truncateUtf8Bytes(layout.footer, 900),
        }),
      );
      this.lastSignature = signature;
      return;
    }

    const rebuild = this.buildRebuildPayload(layout);
    await this.bridge.rebuildPageContainer(rebuild);
    this.activeKind = layout.kind;
    this.lastSignature = signature;
  }

  async exitApp(): Promise<void> {
    await this.bridge.shutDownPageContainer(1);
  }

  private buildContainers(layout: G2Layout): {
    containerTotalNum: number;
    textObject: TextContainerProperty[];
    listObject?: ListContainerProperty[];
  } {
    const header = new TextContainerProperty({
      xPosition: 8,
      yPosition: 4,
      width: 560,
      height: 32,
      borderWidth: 0,
      paddingLength: 2,
      containerID: CONTAINER_ID.header,
      containerName: CONTAINER_NAME.header,
      content: truncateUtf8Bytes(layout.header, 900),
      isEventCapture: 0,
    });

    const footer = new TextContainerProperty({
      xPosition: 8,
      yPosition: 254,
      width: 560,
      height: 30,
      borderWidth: 0,
      paddingLength: 2,
      containerID: CONTAINER_ID.footer,
      containerName: CONTAINER_NAME.footer,
      content: truncateUtf8Bytes(layout.footer, 900),
      isEventCapture: 0,
    });

    if (layout.kind === 'text') {
      const body = new TextContainerProperty({
        xPosition: 8,
        yPosition: 40,
        width: 560,
        height: 210,
        borderWidth: 1,
        borderColor: 5,
        borderRadius: 4,
        paddingLength: 8,
        containerID: CONTAINER_ID.body,
        containerName: CONTAINER_NAME.body,
        content: truncateUtf8Bytes(layout.body, 950),
        isEventCapture: 1,
      });

      return {
        containerTotalNum: 3,
        textObject: [header, body, footer],
      };
    }

    if (layout.kind === 'list') {
      const safeItems = layout.items.slice(0, 20).map(formatListItemLabel);
      const list = new ListContainerProperty({
        xPosition: 8,
        yPosition: 40,
        width: 560,
        height: 210,
        borderWidth: 0,
        paddingLength: 4,
        containerID: CONTAINER_ID.list,
        containerName: CONTAINER_NAME.list,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: safeItems.length,
          itemWidth: 552,
          isItemSelectBorderEn: 1,
          itemName: safeItems,
        }),
      });

      return {
        containerTotalNum: 3,
        textObject: [header, footer],
        listObject: [list],
      };
    }

    // Split layout: preview box on top + selectable action list below.
    const safeItems = layout.items.slice(0, 20).map(formatListItemLabel);
    const preview = new TextContainerProperty({
      xPosition: 8,
      yPosition: 38,
      width: 560,
      height: 98,
      borderWidth: 1,
      borderColor: 5,
      borderRadius: 4,
      paddingLength: 6,
      containerID: CONTAINER_ID.preview,
      containerName: CONTAINER_NAME.preview,
      content: truncateUtf8Bytes(layout.preview, 950),
      isEventCapture: 0,
    });

    const list = new ListContainerProperty({
      xPosition: 8,
      yPosition: 140,
      width: 560,
      height: 110,
      borderWidth: 0,
      paddingLength: 2,
      containerID: CONTAINER_ID.list,
      containerName: CONTAINER_NAME.list,
      isEventCapture: 1,
      itemContainer: new ListItemContainerProperty({
        itemCount: safeItems.length,
        itemWidth: 552,
        isItemSelectBorderEn: 1,
        itemName: safeItems,
      }),
    });

    return {
      containerTotalNum: 4,
      textObject: [header, preview, footer],
      listObject: [list],
    };
  }

  private buildStartupPayload(layout: G2Layout): CreateStartUpPageContainer {
    const containers = this.buildContainers(layout);
    return new CreateStartUpPageContainer(containers);
  }

  private buildRebuildPayload(layout: G2Layout): RebuildPageContainer {
    const containers = this.buildContainers(layout);
    return new RebuildPageContainer(containers);
  }
}
