export interface TabInfo {
  title: string;
  url: string;
  favIconUrl: string;
  count: number;
  lastVisit: Date;
}

export interface ArchiveMessage {
  type: 'archive-tabs',
  payload: Array<TabInfo>,
}

export interface ArchiveLoaded {
  type: 'archive-loaded',
}

export type KyleMessage = ArchiveMessage | ArchiveLoaded;
