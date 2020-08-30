import {browser} from 'webextension-polyfill-ts';
import * as React from 'react';
import {openDB, DBSchema} from 'idb/with-async-ittr';

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

  React.useEffect(() => {
    const run = async () => {
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
    run();
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

  return (
    <div className={css.root}>
      <h1>Tabs</h1>
      <h2>Just Archived</h2>
      {recentTabs.map(tab => (
        <Tab tab={tab} key={tab.url} />
      ))}

      <h2>Recently Visited</h2>
      {archivedTabs.map(tab => (
        <Tab tab={tab} key={tab.url} />
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

function Tab({tab}: {tab: TabInfo}) {
  return (
    <div className={css.tab}>
      <div className={css.tabTitle}>{tab.title}</div>
      <a href={tab.url}>{tab.url}</a>
      <div className={css.tabDetails}>
        <span>Last Visit: {formatRelativeTime(tab.lastVisit)}</span>
        <span>Visits: {tab.count}</span>
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

async function addTabs(tabs: Array<TabInfo>) {
  const tx = (await db).transaction('tabs', 'readwrite');

  try {
    await Promise.all([
      ...tabs.map(async tab => {
        let dbTab = await tx.store.get(tab.url);
        if (!dbTab) {
          dbTab = tab;
        } else {
          dbTab.count++;
        }
        await tx.store.put(dbTab);
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
