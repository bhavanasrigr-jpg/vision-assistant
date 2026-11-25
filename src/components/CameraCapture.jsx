import { Camera, CameraOff, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, preferredCamera = '', onCameraChange, compact = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => stopCamera(), []);

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((device) => device.kind === 'videoinput'));
  }

  async function startCamera(deviceId = preferredCamera) {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser. You can upload an image instead.');
      return;
    }
    setBusy(true);
    stopCamera();
    try {
      const video = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: 'environment' } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      await refreshDevices();
    } catch (cameraError) {
      setError(cameraError.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser settings, or upload an image.'
        : 'We could not start the camera. Check that it is connected and not being used by another app.');
      setActive(false);
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError('Wait for the camera preview to appear, then try capturing again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.88));
    setError('');
  }

  return (
    <section className={`camera-card${compact ? ' camera-card-compact' : ''}`} aria-label="Camera capture">
      <div className="camera-preview">
        <video ref={videoRef} className={active ? 'video-visible' : ''} playsInline muted aria-label="Live camera preview" />
        {!active && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon"><Camera size={28} /></div>
            <strong>Camera preview</strong>
            <span>Start the camera when you are ready.</span>
          </div>
        )}
        {active && <span className="live-indicator"><i /> Live preview</span>}
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="camera-actions">
        {!active ? (
          <button className="button button-primary" type="button" onClick={() => startCamera()} disabled={busy}>
            <Camera size={18} /> {busy ? 'Starting…' : 'Start camera'}
          </button>
        ) : (
          <>
            <button className="button button-primary" type="button" onClick={capture}><Camera size={18} /> Capture image</button>
            <button className="button button-secondary" type="button" onClick={stopCamera}><CameraOff size={17} /> Stop</button>
          </>
        )}
        {active && devices.length > 1 && (
          <label className="camera-select-label">
            <span className="sr-only">Choose camera</span>
            <select
              aria-label="Choose camera"
              value={preferredCamera || devices[0]?.deviceId || ''}
              onChange={(event) => {
                onCameraChange?.(event.target.value);
                startCamera(event.target.value);
              }}
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
              ))}
            </select>
            <RefreshCw size={15} />
          </label>
        )}
        {onCapture && (
          <label className="button button-quiet upload-button">
            <Upload size={17} /> Upload image
            <input
              type="file"
              accept="image/*"
              aria-label="Upload an image"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onCapture(file);
                event.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </section>
  );
}
