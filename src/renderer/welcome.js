let seconds = 10;
const timerEl = document.getElementById('timer');
const interval = setInterval(function() {
  seconds--;
  if (seconds <= 0) { clearInterval(interval); doClose(); }
  else { timerEl.textContent = seconds; }
}, 1000);

function doClose() {
  clearInterval(interval);
  try {
    window.__TAURI__.core.invoke('close_welcome');
  } catch(e) {
    window.close();
  }
}

document.getElementById('close-btn').addEventListener('click', doClose);

document.getElementById('dev-link').addEventListener('click', function() {
  if (window.__TAURI__) {
    window.__TAURI__.core.invoke('open_url', { url: 'https://chiappina.com' }).catch(function() {});
  }
});
