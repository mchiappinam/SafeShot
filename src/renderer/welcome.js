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
