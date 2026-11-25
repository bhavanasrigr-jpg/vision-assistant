import {
  Activity, ArrowRight, AudioLines, BookOpenText, Camera, Check, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, Eye, EyeOff, FileText, Headphones, History as HistoryIcon, Image, Keyboard,
  LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, Mic, MicOff, MoreHorizontal, Pause, Play,
  Search, Settings as SettingsIcon, ShieldCheck, Sparkles, Square, Trash2, Volume2,
  WandSparkles, X, ScanText, Boxes,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CameraCapture from './components/CameraCapture.jsx';
import Toast from './components/Toast.jsx';
import { askAssistant, demoDescription, demoDetections, describeImage, detectObjects, getApiHealth, isDemoFallback, toDataUrl } from './services/visionApi.js';
import { defaultSettings, getHistory, getSettings, saveHistory, saveSettings } from './services/storage.js';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Vision', icon: Eye },
  { id: 'reader', label: 'Text Reader', icon: ScanText },
  { id: 'objects', label: 'Object Detection', icon: Boxes },
  { id: 'assistant', label: 'Voice Assistant', icon: AudioLines },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const titleByPage = Object.fromEntries(navigation.map(({ id, label }) => [id, label]));
const DEMO_SESSION_KEY = 'vision-assistant-demo-session';
const REMEMBERED_EMAIL_KEY = 'vision-assistant-remembered-email';

function getDemoSession() {
  return sessionStorage.getItem(DEMO_SESSION_KEY) || localStorage.getItem(DEMO_SESSION_KEY) || '';
}

function speak(text, settings) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(settings.speechRate) || 1;
  utterance.volume = Number(settings.volume);
  utterance.lang = settings.language;
  window.speechSynthesis.speak(utterance);
  return true;
}

function summarizeResult(result) {
  if (typeof result === 'string') return result;
  if (result?.result) return result.result;
  if (result?.details?.overall) return result.details.overall;
  return JSON.stringify(result);
}

function App() {
  const [signedInEmail, setSignedInEmail] = useState(getDemoSession);
  const [rememberedEmail, setRememberedEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) || '');
  const [profileOpen, setProfileOpen] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [settings, setSettings] = useState(getSettings);
  const [history, setHistory] = useState(getHistory);
  const [demoMode, setDemoMode] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [detailsEntry, setDetailsEntry] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      getApiHealth().then((health) => {
        if (!active) return;
        setDemoMode(!health.ai_configured);
        setAppReady(true);
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    const clearHistory = () => setHistory([]);
    window.addEventListener('vision-clear-history', clearHistory);
    return () => window.removeEventListener('vision-clear-history', clearHistory);
  }, []);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    window.clearTimeout(toastTimer.current);
  }, []);

  function notify(message, type = 'success') {
    setToast({ message, type });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }

  function updateSetting(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function addHistory(type, query, result, status) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      query,
      result: summarizeResult(result),
      status,
      createdAt: new Date().toISOString(),
    };
    setHistory((current) => [entry, ...current].slice(0, 100));
  }

  function openPage(next) {
    setPage(next);
    setMobileNav(false);
    setDetailsEntry(null);
  }

  function signIn(email, rememberMe) {
    const normalizedEmail = email.trim().toLowerCase();
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
    if (rememberMe) {
      localStorage.setItem(DEMO_SESSION_KEY, normalizedEmail);
      localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
      setRememberedEmail(normalizedEmail);
    } else {
      sessionStorage.setItem(DEMO_SESSION_KEY, normalizedEmail);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      setRememberedEmail('');
    }
    setSignedInEmail(normalizedEmail);
  }

  function signOut() {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
    setSignedInEmail('');
    setProfileOpen(false);
    window.speechSynthesis?.cancel();
  }

  if (!appReady) {
    return <StartupScreen />;
  }

  if (!signedInEmail) {
    return (
      <LoginPage
        rememberedEmail={rememberedEmail}
        onSignIn={signIn}
      />
    );
  }

  return (
    <div className={`app-shell${settings.accessibilityMode ? ' accessibility-mode' : ''}`}>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}${mobileNav ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); openPage('dashboard'); }} aria-label="Vision Assistant home">
          <span className="brand-mark"><Eye size={22} strokeWidth={2.2} /></span>
          {!collapsed && <span className="brand-name">VISION<span>ASSISTANT</span></span>}
        </a>
        <div className="nav-label">{!collapsed && 'WORKSPACE'}</div>
        <nav className="main-nav">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nav-item${page === id ? ' nav-item-active' : ''}`} onClick={() => openPage(id)} aria-current={page === id ? 'page' : undefined} title={collapsed ? label : undefined}>
              <Icon size={19} aria-hidden="true" /><span>{label}</span>{page === id && <i className="nav-active-mark" />}
            </button>
          ))}
        </nav>
        {!collapsed && (
          <div className="sidebar-bottom">
            <div className="sidebar-help"><div className="help-icon"><CircleHelp size={18} /></div><strong>Need a hand?</strong><p>Explore quick accessibility tips to get started.</p><button type="button" onClick={() => openPage('dashboard')}>View quick tips <ArrowRight size={14} /></button></div>
            <div className="sidebar-version"><span className="online-dot" /> All systems ready <span>v1.0</span></div>
          </div>
        )}
        <button className="collapse-control" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          {!collapsed && <span>Collapse menu</span>}
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
            <div><p className="eyebrow">YOUR ACCESSIBLE AI COMPANION</p><h1>{titleByPage[page]}</h1></div>
          </div>
          <div className="topbar-actions">
            <div className="status-pill"><span className="online-dot" /> <span>Accessibility ready</span></div>
            {demoMode && <div className="demo-status" title="AI backend is not configured; analysis responses are demonstrations"><Sparkles size={13} /><span>AI demo mode</span></div>}
            <div className="profile-wrap">
              <button className="avatar-button" type="button" aria-label="Account options" aria-expanded={profileOpen} title="Account options" onClick={() => setProfileOpen((open) => !open)}><span>{signedInEmail.slice(0, 2).toUpperCase()}</span></button>
              {profileOpen && <div className="profile-menu"><strong>{signedInEmail}</strong><span>Demo account</span><button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>}
            </div>
          </div>
        </header>
        <div className="page-content" key={page}>
          {page === 'dashboard' && <Dashboard go={openPage} history={history} settings={settings} />}
          {page === 'live' && <LiveVision settings={settings} addHistory={addHistory} notify={notify} />}
          {page === 'reader' && <TextReader settings={settings} addHistory={addHistory} notify={notify} />}
          {page === 'objects' && <ObjectDetection settings={settings} addHistory={addHistory} notify={notify} />}
          {page === 'assistant' && <VoiceAssistant settings={settings} addHistory={addHistory} notify={notify} />}
          {page === 'history' && <HistoryPage history={history} setHistory={setHistory} notify={notify} onDetails={setDetailsEntry} />}
          {page === 'settings' && <SettingsPage settings={settings} updateSetting={updateSetting} setDialog={setDialog} notify={notify} />}
        </div>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {dialog && <ConfirmDialog {...dialog} onClose={() => setDialog(null)} />}
      {detailsEntry && <HistoryDetails entry={detailsEntry} onClose={() => setDetailsEntry(null)} settings={settings} />}
    </div>
  );
}

function StartupScreen() {
  return (
    <main className="startup-screen" role="status" aria-live="polite">
      <span className="brand-mark startup-mark"><Eye size={25} strokeWidth={2.2} /></span>
      <p className="eyebrow">YOUR ACCESSIBLE AI COMPANION</p>
      <h1>VISION <span>ASSISTANT</span></h1>
      <p className="startup-message">Preparing your accessible workspace…</p>
      <span className="startup-progress" aria-hidden="true"><i /></span>
    </main>
  );
}

function LoginPage({ rememberedEmail, onSignIn }) {
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);

  function submit(event) {
    event.preventDefault();
    onSignIn(email, rememberMe);
  }

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Vision Assistant introduction">
        <a className="brand login-brand" href="#login" aria-label="Vision Assistant">
          <span className="brand-mark"><Eye size={22} strokeWidth={2.2} /></span>
          <span className="brand-name">VISION<span>ASSISTANT</span></span>
        </a>
        <div className="login-hero">
          <span className="welcome-chip"><Sparkles size={14} /> YOUR ACCESSIBLE AI COMPANION</span>
          <h1>See the world<br /><span>differently.</span></h1>
          <p>Understand it effortlessly with a little help from your intelligent visual assistant.</p>
        </div>
        <div className="login-art" aria-hidden="true">
          <div className="login-orbit login-orbit-one" />
          <div className="login-orbit login-orbit-two" />
          <div className="login-orbit-core"><Eye size={45} /></div>
          <span className="login-orbit-dot login-dot-one" />
          <span className="login-orbit-dot login-dot-two" />
          <div className="login-art-caption"><AudioLines size={17} /> Clarity, in every moment</div>
        </div>
        <p className="login-tagline">Thoughtfully designed for a more accessible world.</p>
      </section>

      <section className="login-content">
        <div className="login-card">
          <span className="login-card-icon"><LockKeyhole size={19} /></span>
          <p className="eyebrow">WELCOME TO VISION ASSISTANT</p>
          <h2>Welcome back</h2>
          <p className="login-description">Sign in to continue to your accessible workspace.</p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            <div className="password-label-row">
              <label htmlFor="login-password">Password</label>
              <button type="button" className="forgot-link" onClick={() => setShowRecoveryInfo(true)}>Forgot password?</button>
            </div>
            <div className="login-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me on this device</span></label>
            <button type="submit" className="button button-primary login-submit">Continue to demo <ArrowRight size={17} /></button>
          </form>
          <div className="demo-login-note"><Sparkles size={16} /><p><strong>Demo sign-in</strong><span>Use any valid email and a non-empty password. No account is created, and your password is never saved or sent.</span></p></div>
          <p className="login-privacy"><ShieldCheck size={14} /> Your accessibility preferences and history stay on this device.</p>
        </div>
      </section>

      {showRecoveryInfo && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRecoveryInfo(false); }}><section className="confirm-dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><button type="button" className="modal-close" onClick={() => setShowRecoveryInfo(false)} aria-label="Close dialog"><X size={19} /></button><span className="confirm-icon"><Mail size={20} /></span><h2 id="recovery-title">Password recovery</h2><p>This demo does not use real accounts, so password reset is not available. Enter any valid email and a password to continue.</p><button className="button button-primary dialog-primary" type="button" onClick={() => setShowRecoveryInfo(false)}>Got it</button></section></div>}
    </main>
  );
}

function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>
      {children}
    </div>
  );
}

function Dashboard({ go, history, settings }) {
  const actions = [
    { page: 'live', icon: Eye, label: 'Describe my surroundings', detail: 'Capture a scene and hear a helpful overview.', accent: 'cyan' },
    { page: 'reader', icon: ScanText, label: 'Read text', detail: 'Turn printed words into spoken audio.', accent: 'violet' },
    { page: 'objects', icon: Boxes, label: 'Identify objects', detail: 'Explore objects in an image with assistance.', accent: 'blue' },
    { page: 'assistant', icon: AudioLines, label: 'Ask AI assistant', detail: 'Ask questions by voice or text.', accent: 'green' },
  ];
  return (
    <div className="dashboard-page">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-chip"><Sparkles size={14} /> A little more clarity, every day</span>
          <h2>Hello, welcome to<br /><span>Vision Assistant</span></h2>
          <p>Your intelligent companion for understanding the world around you.</p>
          <button className="button button-light" type="button" onClick={() => go('live')}>Start exploring <ArrowRight size={17} /></button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Eye size={48} /></div>
          <span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" />
          <div className="art-caption"><AudioLines size={17} /><span>See the world differently.<br /><b>Understand it effortlessly.</b></span></div>
        </div>
      </section>

      <div className="section-heading"><div><p className="eyebrow">GET STARTED</p><h3>What would you like to do?</h3></div><span className="subtle-count">4 quick actions</span></div>
      <section className="quick-grid">
        {actions.map(({ page, icon: Icon, label, detail, accent }) => (
          <button type="button" className="quick-card" key={page} onClick={() => go(page)}>
            <span className={`quick-icon accent-${accent}`}><Icon size={21} /></span><span className="quick-card-copy"><strong>{label}</strong><small>{detail}</small></span><ArrowRight className="quick-arrow" size={18} />
          </button>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <div className="panel-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h3>Recent activity</h3></div><button className="text-button" type="button" onClick={() => go('history')}>View history <ArrowRight size={15} /></button></div>
          {history.length ? <div className="recent-list">{history.slice(0, 4).map((item) => <RecentItem key={item.id} item={item} />)}</div> : <EmptyState icon={Clock3} title="Your journey starts here" text="Your recent activities will appear here after you try a feature." />}
        </section>
        <section className="panel stats-panel">
          <div className="panel-heading"><div><p className="eyebrow">AT A GLANCE</p><h3>Your workspace</h3></div><span className="stat-live"><i /> Ready</span></div>
          <div className="stat-row"><span className="stat-icon"><Activity size={18} /></span><span><small>Activities saved</small><strong>{history.length}</strong></span></div>
          <div className="stat-row"><span className="stat-icon"><Headphones size={18} /></span><span><small>Voice feedback</small><strong>{settings.voiceFeedback ? 'On' : 'Off'}</strong></span></div>
          <div className="stat-row"><span className="stat-icon"><ShieldCheck size={18} /></span><span><small>Privacy-first</small><strong>Images not stored</strong></span></div>
          <button type="button" className="settings-link" onClick={() => go('settings')}>Personalize your experience <ArrowRight size={15} /></button>
        </section>
      </div>
      <section className="tips-strip">
        <div className="tips-icon"><Keyboard size={20} /></div><div><strong>Designed around your comfort</strong><p>Use Tab to move through controls, Enter to activate, and turn on Accessibility mode for larger controls and a simplified layout.</p></div>
        <button type="button" className="text-button" onClick={() => go('settings')}>Accessibility settings <ArrowRight size={15} /></button>
      </section>
      <p className="privacy-footnote"><ShieldCheck size={14} /> Your camera stays off until you choose to turn it on. Images are never saved in your history.</p>
    </div>
  );
}

function RecentItem({ item }) {
  const icon = item.type === 'Text Reader' ? FileText : item.type === 'Object Detection' ? Boxes : item.type === 'Voice Assistant' ? AudioLines : Eye;
  const Icon = icon;
  return <div className="recent-item"><span className="recent-icon"><Icon size={17} /></span><span className="recent-copy"><strong>{item.type}</strong><small>{item.query}</small></span><span className={`activity-status ${item.status === 'Demo' ? 'status-demo' : ''}`}>{item.status}</span><time>{formatDate(item.createdAt)}</time></div>;
}

function LiveVision({ settings, addHistory, notify }) {
  const [image, setImage] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [camera, setCamera] = useState(settings.preferredCamera);
  const [error, setError] = useState('');
  async function acceptImage(value) {
    try { setImage(typeof value === 'string' ? value : await toDataUrl(value)); setResult(null); setError(''); }
    catch (readError) { setError(readError.message); }
  }
  async function analyze() {
    if (!image) return;
    setLoading(true); setError('');
    let response;
    try { response = await describeImage(image); }
    catch (requestError) {
      if (isDemoFallback(requestError)) response = demoDescription();
      else { setError(requestError.message); setLoading(false); return; }
    }
    if (!response?.result && !response?.details) {
      setError('The analysis service returned an unexpected response. Please try again.');
      setLoading(false);
      return;
    }
    setResult(response);
    addHistory('Live Vision', 'Describe my surroundings', response, response.demo ? 'Demo' : 'Complete');
    notify(response.demo ? 'Demo mode: no image analysis was performed.' : 'Your scene description is ready.', response.demo ? 'error' : 'success');
    setLoading(false);
  }
  const details = result?.details || {};
  return (
    <div className="feature-page">
      <PageIntro eyebrow="LIVE VISION" title="Understand the scene around you" description="Capture a still image when you are ready. Nothing is sent for analysis until you ask.">
        <span className="privacy-badge"><ShieldCheck size={16} /> Capture only on request</span>
      </PageIntro>
      <div className="feature-layout">
        <div className="feature-main">
          {image ? (
            <div className="image-preview-card"><img src={image} alt="Captured image preview" /><div className="preview-toolbar"><span><Check size={15} /> Image ready to analyze</span><button type="button" className="text-button" onClick={() => { setImage(''); setResult(null); }}>Retake image</button></div></div>
          ) : <CameraCapture onCapture={acceptImage} preferredCamera={camera} onCameraChange={setCamera} />}
          {image && (
            <div className="action-row">
              <button className="button button-primary" type="button" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner" /> Analyzing image…</> : <><WandSparkles size={18} /> Analyze captured image</>}</button>
              <button className="button button-secondary" type="button" onClick={() => { setImage(''); setResult(null); }}>Retake / choose another</button>
            </div>
          )}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {loading && <div className="loading-card" role="status"><span className="spinner spinner-large" /><div><strong>Working on your request</strong><p>Your still image is being sent to the configured analysis service.</p></div></div>}
          {result && <SceneResult result={result} settings={settings} />}
        </div>
        <aside className="feature-aside">
          <div className="panel guide-panel"><span className="aside-icon"><Camera size={19} /></span><h3>How it works</h3><ol><li><b>1</b><span>Start the camera or upload an image.</span></li><li><b>2</b><span>Capture a still frame, then review it.</span></li><li><b>3</b><span>Choose Analyze to request a description.</span></li></ol></div>
          <div className="panel demo-panel"><div className="demo-heading"><Sparkles size={17} /><strong>About demo mode</strong></div><p>Without a configured backend model, requests show a labeled demo response. The app will not pretend the image was analyzed.</p><span className="demo-tag">DEMO MODE AVAILABLE</span></div>
          <SafetyNote />
        </aside>
      </div>
    </div>
  );
}

function SceneResult({ result, settings }) {
  const details = result.details || {};
  const sections = [
    ['Overall scene', details.overall || result.result],
    ['Objects identified', Array.isArray(details.objects) ? (details.objects.length ? details.objects.join(', ') : 'No objects were provided by the analysis service.') : details.objects],
    ['Important visual details', details.importantDetails],
    ['Text detected', details.text],
    ['Spatial information', details.spatial],
    ['Uncertainty', details.uncertainty || 'Visual descriptions can be incomplete. Do not rely on this result for safety-critical decisions.'],
  ].filter(([, value]) => value);
  const spoken = sections.map(([title, text]) => `${title}. ${text}`).join('. ');
  return <section className={`result-card${result.demo ? ' result-demo' : ''}`} aria-live="polite">
    <div className="result-heading"><div><span className="result-icon"><Eye size={18} /></span><div><p className="eyebrow">{result.demo ? 'DEMONSTRATION' : 'ANALYSIS RESULT'}</p><h3>{result.demo ? 'Demo response' : 'Scene description'}</h3></div></div><button className="button button-secondary button-small" type="button" onClick={() => speak(spoken, settings)} disabled={!settings.voiceFeedback}><Volume2 size={16} /> Speak description</button></div>
    {result.demo && <p className="demo-banner"><Sparkles size={15} /> Demo mode — no genuine AI analysis has taken place.</p>}
    <div className="result-sections">{sections.map(([title, text]) => <div key={title}><h4>{title}</h4><p>{Array.isArray(text) ? text.join(', ') : text}</p></div>)}</div>
  </section>;
}

function SafetyNote() {
  return <div className="safety-note"><ShieldCheck size={17} /><p><strong>A helpful companion, not a safety guarantee.</strong> Verify important details independently and avoid relying on visual AI for hazards or urgent decisions.</p></div>;
}

function TextReader({ settings, addHistory, notify }) {
  const [image, setImage] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  async function acceptImage(value) {
    try { setImage(typeof value === 'string' ? value : await toDataUrl(value)); setText(''); setError(''); }
    catch (readError) { setError(readError.message); }
  }
  async function extractText() {
    if (!image) return;
    setLoading(true); setError(''); setProgress(0);
    let worker;
    try {
      const { createWorker } = await import('tesseract.js');
      const ocrLanguage = settings.language?.startsWith('es') ? 'spa'
        : settings.language?.startsWith('fr') ? 'fra'
          : settings.language?.startsWith('de') ? 'deu' : 'eng';
      worker = await createWorker(ocrLanguage, 1, {
        logger: (message) => { if (message.status === 'recognizing text') setProgress(Math.round(message.progress * 100)); },
      });
      const { data } = await worker.recognize(image);
      const extracted = data.text.trim();
      setText(extracted);
      if (extracted) {
        addHistory('Text Reader', 'Extract text from image', extracted, 'Complete');
        notify('Text extraction complete.');
      } else {
        notify('No readable text was found in the image.', 'error');
      }
    } catch (ocrError) {
      setError(`OCR could not run: ${ocrError.message}. Check your connection and try again.`);
    } finally {
      await worker?.terminate();
      setLoading(false);
    }
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(text); notify('Text copied to clipboard.'); }
    catch { setError('Clipboard access is unavailable. Select the text and copy it manually.'); }
  }
  function speech(action) {
    if (action === 'pause') window.speechSynthesis.pause();
    else if (action === 'resume') window.speechSynthesis.resume();
    else if (action === 'stop') window.speechSynthesis.cancel();
    else if (settings.voiceFeedback && text) speak(text, settings);
  }
  return (
    <div className="feature-page">
      <PageIntro eyebrow="TEXT READER" title="Turn printed words into audio" description="Capture or upload a clear image of text. OCR runs in your browser and does not send the image to the backend." />
      <div className="feature-layout">
        <div className="feature-main">
          {!image ? <CameraCapture onCapture={acceptImage} preferredCamera={settings.preferredCamera} /> : <div className="image-preview-card reader-image"><img src={image} alt="Image selected for text recognition" /><div className="preview-toolbar"><span><Check size={15} /> Image ready for OCR</span><button type="button" className="text-button" onClick={() => { setImage(''); setText(''); }}>Choose another</button></div></div>}
          {image && <div className="action-row"><button className="button button-primary" type="button" onClick={extractText} disabled={loading}>{loading ? <><span className="spinner" /> Recognizing text {progress}%</> : <><ScanText size={18} /> Extract text with OCR</>}</button><span className="tiny-note">Runs locally in your browser</span></div>}
          {loading && <div className="progress-track" aria-label={`OCR progress ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <section className="panel text-output">
            <div className="panel-heading"><div><p className="eyebrow">RECOGNIZED CONTENT</p><h3>Extracted text</h3></div><div className="output-actions">
              <button className="icon-button" type="button" onClick={() => speech('start')} aria-label="Read text aloud" disabled={!text || !settings.voiceFeedback}><Volume2 size={17} /></button>
              <button className="icon-button" type="button" onClick={() => speech('pause')} aria-label="Pause speech" disabled={!text}><Pause size={16} /></button>
              <button className="icon-button" type="button" onClick={() => speech('resume')} aria-label="Resume speech" disabled={!text}><Play size={16} /></button>
              <button className="icon-button" type="button" onClick={() => speech('stop')} aria-label="Stop speech"><Square size={15} /></button>
              <button className="icon-button" type="button" onClick={copyText} aria-label="Copy extracted text" disabled={!text}><FileText size={16} /></button>
              <button className="icon-button" type="button" onClick={() => { setText(''); setImage(''); }} aria-label="Clear content"><Trash2 size={16} /></button>
            </div></div>
            {text ? <textarea className="recognized-text" aria-label="Extracted text, editable" value={text} onChange={(event) => setText(event.target.value)} /> : <EmptyState icon={BookOpenText} title="Your text will appear here" text="Choose an image and run OCR to extract the words." />}
          </section>
        </div>
        <aside className="feature-aside">
          <div className="panel guide-panel"><span className="aside-icon"><ScanText size={19} /></span><h3>Tips for clear text</h3><ul className="plain-list"><li>Keep the camera steady and text in focus.</li><li>Use even lighting and avoid glare.</li><li>Include the full page in the frame.</li></ul></div>
          <div className="panel demo-panel"><div className="demo-heading"><ShieldCheck size={17} /><strong>Private by design</strong></div><p>OCR is performed on-device in your browser. The image is not saved in history or uploaded to our backend.</p><span className="demo-tag">BROWSER OCR</span></div>
        </aside>
      </div>
    </div>
  );
}

function ObjectDetection({ settings, addHistory, notify }) {
  const [image, setImage] = useState('');
  const [detections, setDetections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function acceptImage(value) {
    try { setImage(typeof value === 'string' ? value : await toDataUrl(value)); setDetections(null); setError(''); }
    catch (readError) { setError(readError.message); }
  }
  async function detect() {
    setLoading(true); setError('');
    let response;
    try { response = await detectObjects(image); }
    catch (requestError) {
      if (isDemoFallback(requestError)) response = demoDetections();
      else { setError(requestError.message); setLoading(false); return; }
    }
    if (!Array.isArray(response?.detections)) { setError('The detection service returned an unexpected response.'); setLoading(false); return; }
    setDetections(response);
    addHistory('Object Detection', 'Identify objects in image', response.detections.map((item) => item.name).join(', '), response.demo ? 'Demo' : 'Complete');
    notify(response.demo ? 'Demo mode: object detections are simulated.' : 'Object detection is complete.', response.demo ? 'error' : 'success');
    setLoading(false);
  }
  const spoken = detections?.detections?.map((item) => item.name).join('. ') || '';
  return (
    <div className="feature-page">
      <PageIntro eyebrow="OBJECT DETECTION" title="Find objects in an image" description="Capture or upload a still image to request object detection. Results are not a substitute for careful observation." />
      <div className="feature-layout">
        <div className="feature-main">
          {!image ? <CameraCapture onCapture={acceptImage} preferredCamera={settings.preferredCamera} /> : <div className="image-preview-card"><img src={image} alt="Image selected for object detection" /><div className="preview-toolbar"><span><Check size={15} /> Image ready</span><button className="text-button" type="button" onClick={() => { setImage(''); setDetections(null); }}>Choose another</button></div></div>}
          {image && <div className="action-row"><button className="button button-primary" type="button" onClick={detect} disabled={loading}>{loading ? <><span className="spinner" /> Detecting objects…</> : <><Boxes size={18} /> Detect objects</>}</button><button className="button button-secondary" type="button" onClick={() => { setImage(''); setDetections(null); }}>Retake / choose another</button></div>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {detections && <section className={`result-card${detections.demo ? ' result-demo' : ''}`} aria-live="polite">
            <div className="result-heading"><div><span className="result-icon"><Boxes size={18} /></span><div><p className="eyebrow">{detections.demo ? 'SIMULATED RESULTS' : 'DETECTION RESULTS'}</p><h3>{detections.demo ? 'Demo detections' : 'Objects found'}</h3></div></div><button className="button button-secondary button-small" type="button" onClick={() => speak(spoken, settings)} disabled={!settings.voiceFeedback}><Volume2 size={16} /> Read objects aloud</button></div>
            {detections.demo && <p className="demo-banner"><Sparkles size={15} /> These results are simulated and were not detected in your image.</p>}
            <div className="detection-list">{detections.detections.length ? detections.detections.map((item, index) => <div key={`${item.name}-${index}`} className="detection-item"><span className="detection-number">{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong>{Number.isFinite(item.confidence) && <span className="confidence">{Math.round(item.confidence * 100)}% confidence</span>}</div>) : <EmptyState icon={Boxes} title="No objects returned" text="Try another image or check the configured model." />}</div>
          </section>}
          <SafetyNote />
        </div>
        <aside className="feature-aside">
          <div className="panel guide-panel"><span className="aside-icon"><Image size={19} /></span><h3>Detection notes</h3><p className="aside-copy">Object detection needs a vision model configured in the optional backend. No confidence score is shown unless the configured model returns one.</p></div>
          <div className="panel demo-panel"><div className="demo-heading"><Sparkles size={17} /><strong>Demo mode</strong></div><p>When no service is available, the app returns simulated sample entries and labels them clearly.</p><span className="demo-tag">NO REAL DETECTIONS</span></div>
        </aside>
      </div>
    </div>
  );
}

function VoiceAssistant({ settings, addHistory, notify }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const recognitionRef = useRef(null);
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechAvailable(Boolean(SpeechRecognition));
    if (!SpeechRecognition) return undefined;
    const recognition = new SpeechRecognition();
    recognition.lang = settings.language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setQuestion(transcript);
      if (event.results[event.results.length - 1].isFinal) setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => { recognition.stop(); recognitionRef.current = null; };
  }, [settings.language]);
  function toggleListen() {
    if (!speechAvailable) { notify('Speech recognition is not supported in this browser. Type your question instead.', 'error'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    else {
      try { setQuestion(''); recognitionRef.current?.start(); setListening(true); }
      catch { notify('Microphone could not start. Check your browser microphone permission.', 'error'); }
    }
  }
  async function submit(event) {
    event.preventDefault();
    const query = question.trim();
    if (!query || loading) return;
    setLoading(true);
    let response;
    try { response = await askAssistant(query); }
    catch (requestError) {
      if (isDemoFallback(requestError)) response = { demo: true, answer: demoAnswer(query) };
      else { notify(requestError.message, 'error'); setLoading(false); return; }
    }
    if (typeof response?.answer !== 'string') { notify('The assistant returned an unexpected response.', 'error'); setLoading(false); return; }
    setAnswer(response);
    addHistory('Voice Assistant', query, response.answer, response.demo ? 'Demo' : 'Complete');
    if (settings.voiceFeedback) speak(response.answer, settings);
    setLoading(false);
  }
  return (
    <div className="feature-page assistant-page">
      <PageIntro eyebrow="VOICE ASSISTANT" title="Ask in your own words" description="Speak a question or type it below. Voice recognition depends on browser support and permission." />
      <div className="assistant-layout">
        <section className="assistant-card">
          <div className="assistant-orb" aria-hidden="true"><div><AudioLines size={35} /></div><i /><i /><i /></div>
          <p className="eyebrow">YOUR ASSISTANT</p><h3>{listening ? 'I’m listening…' : 'How can I help you?'}</h3>
          <p className="assistant-hint">{speechAvailable ? 'Tap the microphone or use the text box below.' : 'Speech recognition is unavailable. You can still type your question.'}</p>
          <button type="button" className={`mic-button${listening ? ' mic-listening' : ''}`} onClick={toggleListen} aria-label={listening ? 'Stop listening' : 'Start voice input'} aria-pressed={listening} disabled={!speechAvailable}>
            {listening ? <MicOff size={25} /> : <Mic size={25} />}
          </button>
          <span className={`mic-status${listening ? ' mic-status-active' : ''}`}>{listening ? 'Listening — tap to stop' : speechAvailable ? 'Tap to speak' : 'Voice input not supported'}</span>
          <form className="assistant-form" onSubmit={submit}>
            <label htmlFor="assistant-question">Or type a question</label>
            <div className="assistant-input-wrap"><input id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What would you like to know?" autoComplete="off" /><button className="button button-primary" type="submit" disabled={!question.trim() || loading}>{loading ? <span className="spinner" /> : <ArrowRight size={18} />}<span className="sr-only">Send question</span></button></div>
          </form>
          {answer && <div className={`assistant-answer${answer.demo ? ' result-demo' : ''}`} aria-live="polite"><div className="answer-top"><span><Sparkles size={16} /> {answer.demo ? 'DEMO RESPONSE' : 'ASSISTANT RESPONSE'}</span><div><button className="icon-button" type="button" aria-label="Speak response" onClick={() => speak(answer.answer, settings)} disabled={!settings.voiceFeedback}><Volume2 size={16} /></button><button className="icon-button" type="button" aria-label="Stop speaking" onClick={() => window.speechSynthesis.cancel()}><Square size={14} /></button></div></div><p>{answer.answer}</p>{answer.demo && <small>This is a demo response, not an AI-generated answer.</small>}</div>}
        </section>
        <aside className="assistant-aside">
          <section className="panel suggestion-panel"><p className="eyebrow">TRY ASKING</p><h3>Some ideas to get started</h3>
            {['Describe my surroundings.', 'Read the text.', 'Identify the objects.', 'What is in this picture?'].map((prompt) => <button key={prompt} type="button" className="suggestion" onClick={() => setQuestion(prompt)}><span><AudioLines size={16} /></span>{prompt}<ArrowRight size={15} /></button>)}
          </section>
          <div className="safety-note"><ShieldCheck size={17} /><p><strong>Demo responses are not AI advice.</strong> Connect a backend model for genuine question answering. No image context is included with your typed question.</p></div>
        </aside>
      </div>
    </div>
  );
}

function demoAnswer(question) {
  const normalized = question.toLowerCase();
  if (normalized.includes('read') || normalized.includes('text')) return 'Demo mode: no image or text was analyzed. Open Text Reader, upload or capture an image, then run browser OCR to read text.';
  if (normalized.includes('object') || normalized.includes('picture') || normalized.includes('surround')) return 'Demo mode: I cannot see your surroundings in this response. Capture an image in Live Vision or Object Detection to request analysis from a configured model.';
  return 'Demo mode: this is a sample response, not an AI-generated answer. Add a backend model configuration to enable genuine assistance.';
}

function HistoryPage({ history, setHistory, notify, onDetails }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const filtered = useMemo(() => history.filter((entry) => (filter === 'All' || entry.type === filter) && `${entry.type} ${entry.query} ${entry.result}`.toLowerCase().includes(search.toLowerCase())), [history, filter, search]);
  function remove(id) {
    setHistory((items) => items.filter((item) => item.id !== id));
    notify('Activity deleted.');
  }
  return (
    <div className="feature-page">
      <PageIntro eyebrow="YOUR ACTIVITY" title="History" description="Review saved activity summaries. Captured images are never included in history." />
      <section className="panel history-panel">
        <div className="history-toolbar">
          <label className="search-field"><Search size={17} /><span className="sr-only">Search history</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activities…" /></label>
          <label className="filter-field"><span className="sr-only">Filter by feature</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{navigation.slice(1, 5).map((item) => <option key={item.label}>{item.label}</option>)}</select></label>
          <button type="button" className="button button-secondary button-small" onClick={() => setHistory([])} disabled={!history.length}><Trash2 size={15} /> Clear history</button>
        </div>
        {!filtered.length ? <EmptyState icon={HistoryIcon} title={history.length ? 'No matching activities' : 'Nothing here yet'} text={history.length ? 'Try another search or filter.' : 'Completed activities will show up here. Your images are not stored.'} /> : <div className="history-list">{filtered.map((entry) => {
          const Icon = navigation.find((item) => item.label === entry.type)?.icon || MoreHorizontal;
          return <article className="history-row" key={entry.id}><span className="history-feature-icon"><Icon size={18} /></span><div className="history-content"><div><strong>{entry.type}</strong><span className={`activity-status ${entry.status === 'Demo' ? 'status-demo' : ''}`}>{entry.status}</span></div><p>{entry.query}</p><small>{entry.result}</small></div><time>{formatDate(entry.createdAt)}</time><div className="history-controls"><button className="icon-button" type="button" aria-label={`View details for ${entry.type}`} onClick={() => onDetails(entry)}><MoreHorizontal size={17} /></button><button className="icon-button" type="button" aria-label={`Delete ${entry.type} activity`} onClick={() => remove(entry.id)}><Trash2 size={16} /></button></div></article>;
        })}</div>}
      </section>
      <p className="privacy-footnote"><ShieldCheck size={14} /> History is stored on this device only. Clear it any time from this page or Settings.</p>
    </div>
  );
}

function SettingsPage({ settings, updateSetting, setDialog, notify }) {
  const [cameraDevices, setCameraDevices] = useState([]);
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((items) => setCameraDevices(items.filter((item) => item.kind === 'videoinput'))).catch(() => {});
  }, []);
  function reset() {
    setDialog({
      title: 'Clear saved activity?',
      message: 'This will permanently remove all activity summaries stored on this device. Captured images are not part of history.',
      confirmLabel: 'Clear history',
      onConfirm: () => { saveHistory([]); window.dispatchEvent(new CustomEvent('vision-clear-history')); notify('Saved history cleared.'); },
    });
  }
  return (
    <div className="feature-page settings-page">
      <PageIntro eyebrow="MAKE IT YOURS" title="Settings & preferences" description="Adjust voice, camera, and accessibility to make Vision Assistant work for you." />
      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-section"><div className="settings-section-head"><span className="settings-icon"><Volume2 size={19} /></span><div><h3>Voice & language</h3><p>Control spoken responses and audio playback.</p></div></div>
            <SettingToggle title="Voice feedback" description="Speak results aloud when an activity is complete." checked={settings.voiceFeedback} onChange={(value) => updateSetting('voiceFeedback', value)} />
            <div className="setting-row"><div><strong>Speech rate</strong><p>Adjust how quickly spoken results are read.</p></div><div className="range-control"><input type="range" min="0.6" max="1.5" step="0.1" value={settings.speechRate} onChange={(event) => updateSetting('speechRate', Number(event.target.value))} aria-label="Speech rate" /><output>{Number(settings.speechRate).toFixed(1)}×</output></div></div>
            <div className="setting-row"><div><strong>Volume</strong><p>Set the volume of spoken responses.</p></div><div className="range-control"><input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => updateSetting('volume', Number(event.target.value))} aria-label="Speech volume" /><output>{Math.round(settings.volume * 100)}%</output></div></div>
            <div className="setting-row"><div><strong>Preferred language</strong><p>Used for speech and text recognition.</p></div><select className="setting-select" value={settings.language} onChange={(event) => updateSetting('language', event.target.value)} aria-label="Preferred language"><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option></select></div>
          </section>
          <section className="panel settings-section"><div className="settings-section-head"><span className="settings-icon"><Eye size={19} /></span><div><h3>Appearance & accessibility</h3><p>Choose the layout and contrast that feel comfortable.</p></div></div>
            <SettingToggle title="Accessibility mode" description="Use a simplified layout, larger controls, and increased text size." checked={settings.accessibilityMode} onChange={(value) => updateSetting('accessibilityMode', value)} />
            <div className="setting-row"><div><strong>Theme preference</strong><p>Choose your preferred interface appearance.</p></div><select className="setting-select" value={settings.theme} onChange={(event) => updateSetting('theme', event.target.value)} aria-label="Theme preference"><option value="dark">Dark (recommended)</option><option value="light">Light</option></select></div>
          </section>
          <section className="panel settings-section"><div className="settings-section-head"><span className="settings-icon"><Camera size={19} /></span><div><h3>Camera preferences</h3><p>Choose the camera to use when multiple devices are available.</p></div></div>
            <div className="setting-row"><div><strong>Preferred camera</strong><p>{cameraDevices.length ? `${cameraDevices.length} camera${cameraDevices.length === 1 ? '' : 's'} available` : 'Camera selection is available when you start a camera.'}</p></div><select className="setting-select" value={settings.preferredCamera} onChange={(event) => updateSetting('preferredCamera', event.target.value)} aria-label="Preferred camera"><option value="">Default camera</option>{cameraDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></div>
          </section>
          <section className="panel settings-section danger-section"><div className="settings-section-head"><span className="settings-icon danger-icon"><Trash2 size={19} /></span><div><h3>Saved data</h3><p>Manage activity summaries stored on this device.</p></div></div><div className="setting-row"><div><strong>Clear saved history</strong><p>Remove all local activity records. Images are never stored.</p></div><button type="button" className="button button-danger button-small" onClick={reset}><Trash2 size={15} /> Clear history</button></div></section>
        </div>
        <aside className="settings-aside">
          <section className="panel privacy-panel"><span className="aside-icon"><ShieldCheck size={20} /></span><p className="eyebrow">PRIVACY FIRST</p><h3>Your privacy matters</h3><ul><li>Camera access is requested only when you start it.</li><li>Images are captured only when you choose to capture.</li><li>Images are not stored in history or by default.</li><li>Configured AI analysis may send an image to that service.</li><li>Avoid capturing sensitive personal information.</li><li>Demo mode does not perform genuine AI analysis.</li></ul></section>
          <div className="accessibility-card"><div><Check size={16} /> Keyboard friendly</div><p>Every action is available without a mouse. Use Tab, Enter, and Space to navigate.</p></div>
        </aside>
      </div>
    </div>
  );
}

function SettingToggle({ title, description, checked, onChange }) {
  return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div><button className={`toggle${checked ? ' toggle-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)}><span /></button></div>;
}

function HistoryDetails({ entry, onClose, settings }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="confirm-dialog detail-dialog" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><button type="button" className="modal-close" onClick={onClose} aria-label="Close details"><X size={19} /></button><p className="eyebrow">ACTIVITY DETAILS</p><h2 id="history-detail-title">{entry.type}</h2><p className="detail-date">{new Date(entry.createdAt).toLocaleString()}</p><div className="detail-field"><span>Activity</span><p>{entry.query}</p></div><div className="detail-field"><span>Status</span><p>{entry.status}</p></div><div className="detail-field"><span>Result</span><p>{entry.result}</p></div><button className="button button-primary dialog-primary" type="button" onClick={() => speak(entry.result, settings)} disabled={!settings.voiceFeedback}><Volume2 size={16} /> Read details aloud</button></section></div>;
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span className="confirm-icon"><Trash2 size={21} /></span><h2 id="confirm-title">{title}</h2><p>{message}</p><div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-danger" type="button" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div></section></div>;
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><span><Icon size={23} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default App;
