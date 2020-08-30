import {browser, Runtime} from 'webextension-polyfill-ts';

import {KyleMessage} from './archive/messages';

browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({currentWindow: true, pinned: false});
  const newTab = await browser.tabs.create({
    active: true,
    url: '/archive.html',
  });

  const listener = (message: KyleMessage, sender: Runtime.MessageSender) => {
    if (sender.tab?.id === newTab.id && message.type === 'archive-loaded') {
      browser.runtime.onMessage.removeListener(listener);
      return Promise.resolve(tabsInfo);
    }
  };
  browser.runtime.onMessage.addListener(listener);

  if (!newTab.id) {
    throw new Error('Failed to create new tab.');
  }

  const tabsMap = new Map();
  for (const tab of tabs) {
    let tabInfo = tabsMap.get(tab.url);
    if (!tabInfo) {
      tabInfo = {
        title: tab.title,
        url: tab.url,
        count: 1,
        lastVisit: new Date(),
      };
      tabsMap.set(tabInfo.url, tabInfo);
    }
    tabInfo.count++;
  }

  const tabsInfo = [...tabsMap.values()];

  try {
    const response = await browser.tabs.sendMessage(newTab.id, {
      type: 'archive-tabs',
      payload: tabsInfo,
    });
    console.log('response', response);
  } catch (error) {
    console.error(error);
  }

  /*
  await browser.tabs.remove(
    tabs.map(tab => tab.id).filter(isDefined)
  );
  */
});

function isDefined<V>(value: V | null | undefined): value is V {
  return value != null;
}
