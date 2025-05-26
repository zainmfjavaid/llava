const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startTranscription: () => ipcRenderer.invoke('start-transcription'),
  stopTranscription: () => ipcRenderer.invoke('stop-transcription'),
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', (event, data) => callback(data)),
  onTranscriptionError: (callback) => ipcRenderer.on('transcription-error', (event, error) => callback(error)),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  openSoundSettings: () => ipcRenderer.invoke('open-sound-settings'),
  openPrivacySettings: () => ipcRenderer.invoke('open-privacy-settings'),
  startAudioMonitoring: () => ipcRenderer.invoke('start-audio-monitoring'),
  stopAudioMonitoring: () => ipcRenderer.invoke('stop-audio-monitoring'),
  onAudioLevel: (callback) => ipcRenderer.on('audio-level', (event, level) => callback(level)),
  onAudioMonitoringError: (callback) => ipcRenderer.on('audio-monitoring-error', (event, error) => callback(error)),
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission')
}); 