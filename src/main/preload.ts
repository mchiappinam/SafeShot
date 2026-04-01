import { contextBridge, ipcRenderer } from 'electron';
import {
  CAPTURE_START,
  CAPTURE_CANCEL,
  SAVE_REQUEST,
  SAVE_RESULT,
  COPY_REQUEST,
  PRINT_REQUEST,
  OVERLAY_CLOSE,
  ABOUT_OPEN,
  TRAY_ACTION,
} from '../shared/ipc-channels';

const SEND_CHANNELS = new Set([CAPTURE_CANCEL, COPY_REQUEST, PRINT_REQUEST, OVERLAY_CLOSE]);
const INVOKE_CHANNELS = new Set([SAVE_REQUEST]);
const RECEIVE_CHANNELS = new Set([CAPTURE_START, SAVE_RESULT, ABOUT_OPEN, TRAY_ACTION]);

function safeOn(channel: string, callback: (...args: unknown[]) => void) {
  if (RECEIVE_CHANNELS.has(channel)) {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onCaptureStart: (callback: (payload: unknown) => void) => safeOn(CAPTURE_START, callback),
  onSaveResult: (callback: (payload: unknown) => void) => safeOn(SAVE_RESULT, callback),
  onAboutOpen: (callback: () => void) => safeOn(ABOUT_OPEN, callback),
  onTrayAction: (callback: (payload: unknown) => void) => safeOn(TRAY_ACTION, callback),
  send: (channel: string, payload: unknown) => {
    if (SEND_CHANNELS.has(channel)) ipcRenderer.send(channel, payload);
  },
  invoke: (channel: string, payload: unknown): Promise<unknown> => {
    if (INVOKE_CHANNELS.has(channel)) return ipcRenderer.invoke(channel, payload);
    return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
  },
});
