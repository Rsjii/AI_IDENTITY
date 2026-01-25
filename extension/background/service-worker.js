// Background service worker for Identity Mirror extension
// Currently minimal - can be extended for cross-tab messaging, etc.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Identity Mirror extension installed');
});


