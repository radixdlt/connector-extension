window.addEventListener('radix#chromeExtension#send', (event) => {
  chrome.runtime.sendMessage({})
})
