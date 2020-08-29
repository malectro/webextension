export interface TabInfo {
  title: string;
  url: string;
}

export interface ArchiveMessage {
  type: 'archive-tabs',
  payload: Array<TabInfo>,
}

export interface ArchiveLoaded {
  type: 'archive-loaded',
}

export type KyleMessage = ArchiveMessage | ArchiveLoaded;
