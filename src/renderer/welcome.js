let seconds = 10;
const timerEl = document.getElementById('timer');
const interval = setInterval(() => {
  seconds--;
  if (seconds <= 0) { clearInterval(interval); closeWindow(); }
  else { timerEl.textContent = 'Closing in ' + seconds + 's'; }
}, 1000);

function closeWindow() {
  clearInterval(interval);
  if (window.__TAURI__) {
    window.__TAURI__.core.invoke('close_welcome').catch(() => window.close());
  } else {
    window.close();
  }
}

document.getElementById('close-btn').addEventListener('click', closeWindow);
