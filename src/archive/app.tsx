import { browser } from "webextension-polyfill-ts";
import * as React from "react";

import { KyleMessage, TabInfo } from "./messages";

import css from "./app.css";

export const App: React.FC = function App() {
  const [recentTabs, setRecentTabs] = React.useState<Array<TabInfo>>([]);

  React.useEffect(() => {
    browser.runtime.sendMessage({
      type: 'archive-loaded',
    }).then(tabs => {
      setRecentTabs(tabs);
    });
  }, []);

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

  return (
    <div className={css.root}>
      <h1>Tabs</h1>
      {recentTabs.map(tab => (
        <div className={css.tab} key={tab.url}>
          <div className={css.tabTitle}>{tab.title}</div>
          <div>{tab.url}</div>
        </div>
      ))}
    </div>
  );
};
