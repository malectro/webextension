import {browser} from 'webextension-polyfill-ts';

console.log('hello');

browser.browserAction.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({currentWindow: true, pinned: false})
  const newTab = await browser.tabs.create({active: true});

  await browser.tabs.remove(
    tabs.map(tab => tab.id).filter(isDefined)
  );
});


function isDefined<V>(value: V | null | undefined): value is V {
  return value != null;
}
