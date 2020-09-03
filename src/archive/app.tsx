import {browser} from 'webextension-polyfill-ts';
import * as React from 'react';
import {openDB, DBSchema, IDBPTransaction} from 'idb/with-async-ittr';

import {KyleMessage, TabInfo} from './messages';

import css from './app.css';

export const App: React.FC = function App() {
  const [recentTabs, setRecentTabs] = React.useState<Array<TabInfo>>([]);
  const [{tabs: archivedTabs, hasMore}, setArchivedTabs] = React.useState<{
    tabs: Array<TabInfo>;
    hasMore: boolean;
  }>({tabs: [], hasMore: false});

  React.useEffect(() => {
    browser.runtime
      .sendMessage({
        type: 'archive-loaded',
      })
      .then(async tabs => {
        for (const tab of tabs) {
          tab.lastVisit = new Date(tab.lastVisit);
        }
        setRecentTabs(tabs);
        addTabs(tabs);
      });
  }, []);

  const limit = 20;
  const fetchRecent = async () => {
    setArchivedTabs(await fetchSlice(0, limit));
  };

  const fetchMore = async () => {
    const page = await fetchSlice(archivedTabs.length, limit);
    setArchivedTabs({
      tabs: [...archivedTabs, ...page.tabs],
      hasMore: page.hasMore,
    });
  };

  const fetchSlice = async (offset: number, limit: number) => {
    const tabs = [];
    const index = (await db).transaction('tabs').store.index('by-lastVisit');

    for await (const cursor of take(drop(index.iterate(), offset), limit)) {
      tabs.push(cursor.value);
    }

    const hasMore = tabs.length >= limit;

    return {tabs: hasMore ? tabs.slice(0, -1) : tabs, hasMore};
  };

  React.useEffect(() => {
    fetchRecent();
  }, [recentTabs]);

  /*
  React.useEffect(() => {
    const listener = (message: KyleMessage) => {
      console.log('got message', message);
      if (message.type === "archive-tabs") {
        setRecentTabs(message.payload);
      }
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);
   */

  const handleArchive = async (tab: TabInfo) => {
    setRecentTabs(recentTabs.filter(recentTab => recentTab !== tab));
    const dbTab = await (await db).get('tabs', tab.url);
    if (!dbTab) {
      await addTab(tab);
      await fetchRecent();
    }
  };

  const handleForget = async (tab: TabInfo) => {
    await (await db).delete('tabs', tab.url);
    fetchRecent();
  };

  const batchArchive = (tabsToArchive: Set<TabInfo>) => {
    const nextTabs = recentTabs.filter(tab => !tabsToArchive.has(tab));
    setRecentTabs(nextTabs);
    addTabs([...tabsToArchive]);
  };
  const archiveAll = () => {
    batchArchive(new Set(recentTabs));
  };

  const batchForget = async (tabsToForget: Set<TabInfo>) => {
    const tx = (await db).transaction('tabs', 'readwrite');

    await Promise.all([
      ...[...tabsToForget].map(tab => tx.store.delete(tab.url)),
      tx.done,
    ]);

    await fetchRecent();
  };

  return (
    <div className={css.root}>
      <h1>Tabs</h1>
      {recentTabs.length > 0 && (
        <TabSection
          title="Just Archived"
          tabs={recentTabs}
          batchActions={[
            {label: 'Archive', onAction: batchArchive},
            {label: 'Archive all', onAction: archiveAll},
          ]}
          onArchive={handleArchive}
        />
      )}

      <TabSection
        title="Recently Visited"
        tabs={archivedTabs}
        batchActions={[{label: 'Forget', onAction: batchForget}]}
        onForget={handleForget}
      />
      {hasMore && <button onClick={fetchMore}>More</button>}
    </div>
  );
};

function TabSection({
  title,
  tabs,
  batchActions,
  onArchive,
  onForget,
}: {
  title: string;
  tabs: Array<TabInfo>;
  batchActions: Array<{
    label: string;
    onAction: (tabs: Set<TabInfo>) => unknown;
  }>;
  onArchive?: (tab: TabInfo) => unknown;
  onForget?: (tab: TabInfo) => unknown;
}) {
  const [selectedTabs, setSelectedTabs] = React.useState<Set<TabInfo>>(
    new Set(),
  );

  const handleSelect = (tab: TabInfo, isSelected: boolean) => {
    const nextSet = new Set(selectedTabs);
    if (isSelected) {
      nextSet.delete(tab);
    } else {
      nextSet.add(tab);
    }
    setSelectedTabs(nextSet);
  };

  return (
    <div className={css.tabSection}>
      <h2>{title}</h2>
      <div>
        batch actions:{' '}
        {batchActions.map(({label, onAction}) => (
          <button
            key={label}
            onClick={() => {
              onAction(selectedTabs);
              setSelectedTabs(new Set());
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tabs.map(tab => (
        <Tab
          tab={tab}
          key={tab.url}
          onArchive={onArchive}
          onForget={onForget}
          isSelected={selectedTabs.has(tab)}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, {
  style: 'long',
});
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
function formatRelativeTime(date: Date, currentDate = new Date()) {
  const diff = date.getTime() - currentDate.getTime();
  if (diff > -3_600_000) {
    return relativeTimeFormat.format(
      Math.round(Math.min(diff / 60_000, -1)),
      'minutes',
    );
  } else if (diff > -86_400_000) {
    return relativeTimeFormat.format(Math.round(diff / 3_600_000), 'hours');
  } else {
    return dateFormat.format(date);
  }
}

function Tab({
  tab,
  isSelected,
  onArchive,
  onForget,
  onSelect,
}: {
  tab: TabInfo;
  isSelected: boolean;
  onArchive?: (tab: TabInfo) => unknown;
  onForget?: (tab: TabInfo) => unknown;
  onSelect: (tab: TabInfo, isSelected: boolean) => unknown;
}) {
  return (
    <div className={css.tab}>
      <div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(tab, isSelected)}
        />
      </div>
      <div className={css.tabContent}>
        <div className={css.tabHeader}>
          <span className={css.tabTitle}>
            <img className={css.favicon} src={tab.favIconUrl} /> {tab.title}
          </span>
          <div className={css.tabActions}>
            <button>Read later</button>
            {onArchive && (
              <button onClick={() => onArchive(tab)}>Archive</button>
            )}
            {onForget && <button onClick={() => onForget(tab)}>Forget</button>}
          </div>
        </div>
        <span>
          <a href={tab.url}>{tab.url}</a>
        </span>
        <div className={css.tabDetails}>
          <span>Last Visit: {formatRelativeTime(tab.lastVisit)}</span>
          <span>Visits: {tab.count}</span>
        </div>
      </div>
    </div>
  );
}

const db = ((window as any).myDb = openDB<TabDb>('tab-db', 1, {
  upgrade(db) {
    const tabStore = db.createObjectStore('tabs', {
      keyPath: 'url',
    });
    tabStore.createIndex('by-title', 'title');
    tabStore.createIndex('by-lastVisit', 'lastVisit');
  },
}));

async function _addTab(tab: TabInfo, tx: IDBPTransaction<TabDb, ['tabs']>) {
  let dbTab = await tx.store.get(tab.url);
  if (!dbTab) {
    dbTab = tab;
  } else {
    dbTab = {...dbTab, ...tab, count: dbTab.count + 1};
  }
  await tx.store.put(dbTab);
}

async function addTab(tab: TabInfo) {
  const tx = (await db).transaction('tabs', 'readwrite');
  return _addTab(tab, tx);
}

async function addTabs(tabs: Array<TabInfo>) {
  const tx = (await db).transaction('tabs', 'readwrite');

  try {
    await Promise.all([
      ...tabs.map(async tab => {
        return _addTab(tab, tx);
      }),
      tx.done,
    ]);
  } catch (error) {
    console.error(error);
  }
}

interface TabDb extends DBSchema {
  tabs: {
    value: {
      title: string;
      url: string;
      count: number;
      lastVisit: Date;
    };
    key: string;
    indexes: {
      'by-title': string;
      'by-lastVisit': string;
    };
  };
}

async function* drop<T>(
  iter: AsyncIterableIterator<T>,
  count: number,
): AsyncIterableIterator<T> {
  let i = 0;
  for await (let val of iter) {
    if (i >= count) {
      yield val;
    }
    i++;
  }
}

async function* take<T>(
  iter: AsyncIterableIterator<T>,
  count: number,
): AsyncIterableIterator<T> {
  let i = 0;
  for await (let value of iter) {
    if (i > count) {
      return;
    }
    yield value;
    i++;
  }
}
