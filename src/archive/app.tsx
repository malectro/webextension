import {browser} from 'webextension-polyfill-ts';
import * as React from 'react';
import {openDB, DBSchema, IDBPTransaction} from 'idb/with-async-ittr';

import {KyleMessage, TabInfo} from './messages';

import css from './app.css';

export const App: React.FC = function App() {
  const [recentTabs, setRecentTabs] = React.useState<Array<TabInfo>>([]);
  const [archivedTabs, setArchivedTabs] = React.useState<Array<TabInfo>>([]);

  React.useEffect(() => {
    browser.runtime
      .sendMessage({
        type: 'archive-loaded',
      })
      .then(async tabs => {
        setRecentTabs(tabs);
        addTabs(tabs);
      });
  }, []);

  const fetchRecent = async () => {
    const limit = 10;
    const tabs = [];
    const index = (await db).transaction('tabs').store.index('by-lastVisit');

    let i = 0;
    for await (const cursor of index.iterate()) {
      if (i >= limit) {
        break;
      }

      tabs.push(cursor.value);
      i++;
    }

    setArchivedTabs(tabs);
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

  return (
    <div className={css.root}>
      <h1>Tabs</h1>
      <h2>Just Archived</h2>
      {recentTabs.map(tab => (
        <Tab tab={tab} key={tab.url} onArchive={handleArchive} />
      ))}

      <h2>Recently Visited</h2>
      {archivedTabs.map(tab => (
        <Tab tab={tab} key={tab.url} onForget={handleForget} />
      ))}
    </div>
  );
};

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
  archived,
  onArchive,
  onForget,
}: {
  tab: TabInfo;
  archived?: unknown;
  onArchive?: (tab: TabInfo) => unknown;
  onForget?: (tab: TabInfo) => unknown;
}) {
  return (
    <div className={css.tab}>
      <div>
        <input type="checkbox" />
      </div>
      <div className={css.tabContent}>
        <div className={css.tabHeader}>
          <span className={css.tabTitle}>{tab.title}</span>
          <div className={css.tabActions}>
            <button>Read later</button>
            {!archived && onArchive && (
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
    dbTab.count++;
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
