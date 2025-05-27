const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startTranscription: async () => {
    console.log('[Preload] Invoking start-transcription in main process...');
    try {
      const result = await ipcRenderer.invoke('start-transcription');
      console.log('[Preload] start-transcription completed with result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] start-transcription failed with error:', error);
      throw error;
    }
  },
  stopTranscription: async () => {
    console.log('[Preload] Invoking stop-transcription in main process...');
    try {
      const result = await ipcRenderer.invoke('stop-transcription');
      console.log('[Preload] stop-transcription completed with result:', result);
      return result;
    } catch (error) {
      console.error('[Preload] stop-transcription failed with error:', error);
      throw error;
    }
  },
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', (event, data) => callback(data)),
  onTranscriptionError: (callback) => ipcRenderer.on('transcription-error', (event, error) => callback(error)),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  openSoundSettings: () => ipcRenderer.invoke('open-sound-settings'),
  openPrivacySettings: () => ipcRenderer.invoke('open-privacy-settings'),
  startAudioMonitoring: () => ipcRenderer.invoke('start-audio-monitoring'),
  stopAudioMonitoring: () => ipcRenderer.invoke('stop-audio-monitoring'),
  onAudioLevel: (callback) => ipcRenderer.on('audio-level', (event, level) => callback(level)),
  onAudioMonitoringError: (callback) => ipcRenderer.on('audio-monitoring-error', (event, error) => callback(error)),
  onAudioMonitoringFallback: (callback) => ipcRenderer.on('audio-monitoring-fallback', (event, device) => callback(device)),
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  onDeviceChosen: (cb) => ipcRenderer.on('device-chosen', (e, name) => cb(name)),
  onFFmpegCapturingFrom: (cb) => ipcRenderer.on('ffmpeg-capturing-from', (e, device) => cb(device)),
  onTranscriptionStatus: (cb) => ipcRenderer.on('transcription-status', (e, status) => cb(status)),
  onAWSAudioConfigured: (cb) => ipcRenderer.on('aws-audio-configured', (e, config) => cb(config)),
  enableAudioOutput: () => ipcRenderer.invoke('enable-audio-output')
}); 