const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('FFmpeg path from ffmpeg-static:', ffmpegStatic);

if (ffmpegStatic) {
  console.log('FFmpeg exists:', fs.existsSync(ffmpegStatic));
  
  // Test if ffmpeg can be executed
  const testProcess = spawn(ffmpegStatic, ['-version']);
  
  testProcess.on('error', (error) => {
    console.error('FFmpeg spawn error:', error);
  });
  
  testProcess.stdout.on('data', (data) => {
    console.log('FFmpeg version output:', data.toString().split('\n')[0]);
  });
  
  testProcess.stderr.on('data', (data) => {
    console.log('FFmpeg version output:', data.toString().split('\n')[0]);
  });
  
  testProcess.on('exit', (code) => {
    console.log('FFmpeg test completed with code:', code);
  });
} else {
  console.error('FFmpeg path is null - not supported on this platform/architecture');
} 