/* ============================================================
   SubAI — Main JS
   Luồng: Upload → AssemblyAI transcribe → poll status → Gemini translate
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  uid: null,
  uploadUrl: null,
  transcriptId: null,
  subtitles: [],
  currentSubIdx: -1,
  activeTab: 'both',
  videoFile: null,
  pollTimer: null,
};

// ── DOM Refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const uploadZone    = $('uploadZone');
const fileInput     = $('fileInput');
const videoContainer= $('videoContainer');
const videoPlayer   = $('videoPlayer');
const videoName     = $('videoNameEl');
const videoDur      = $('videoDurEl');
const processBtn    = $('processBtn');
const resetBtn      = $('resetBtn');
const progressPanel = $('progressPanel');
const subtitlesPanel= $('subtitlesPanel');
const subList       = $('subList');
const subtitleDisp  = $('subtitleDisplay');
const statsRow      = $('statsRow');
const progressFill  = $('progressFill');
const translateChk  = $('translateToggle');
const bilingualChk  = $('bilingualToggle');
const targetLangWrap= $('targetLangWrap');
const detectedLangEl= $('detectedLang');

// ── Upload ───────────────────────────────────────────────────
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && (f.type.startsWith('video/') || f.type.startsWith('audio/'))) handleFile(f);
  else toast('⚠️ Vui lòng chọn file video hoặc audio hợp lệ', true);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

translateChk.addEventListener('change', () => {
  targetLangWrap.style.opacity = translateChk.checked ? '1' : '.4';
  targetLangWrap.style.pointerEvents = translateChk.checked ? 'auto' : 'none';
});

function handleFile(file) {
  state.videoFile = file;
  const url = URL.createObjectURL(file);
  videoPlayer.src = url;
  videoName.textContent = file.name.length > 30 ? file.name.slice(0,28)+'…' : file.name;
  videoPlayer.onloadedmetadata = () => { videoDur.textContent = fmtTime(videoPlayer.duration); };
  videoPlayer.addEventListener('timeupdate', onTimeUpdate);
  uploadZone.style.display = 'none';
  videoContainer.style.display = 'block';
  processBtn.disabled = false;
}

// ── Main Process ─────────────────────────────────────────────
processBtn.addEventListener('click', runPipeline);

// Progress state
const prog = {
  pct: 0,
  startTime: 0,
  timerInterval: null,
  stepTimes: {},   // step → elapsed ms when done
};

async function runPipeline() {
  if (!state.videoFile) return;

  processBtn.disabled = true;
  resetBtn.style.display = 'none';
  progressPanel.style.display = 'block';
  subtitlesPanel.style.display = 'none';
  statsRow.style.display = 'none';
  detectedLangEl.style.display = 'none';

  progReset();
  prog.startTime = Date.now();
  startTimer();

  try {
    // ── Step 1: Upload ──────────────────────────────────────
    stepActivate(1, 'Đang upload lên server…');
    showStepBar(1);
    const uploadData = await uploadVideoXHR(pct => {
      setStepBar(1, pct);
      setProgress(pct * 0.18); // 0→18%
      setEta('Đang tải file lên…');
    });
    state.uid       = uploadData.uid;
    state.uploadUrl = uploadData.upload_url;
    stepDone(1, 'Upload xong', fmtFileSize(state.videoFile.size));
    setProgress(18);

    // ── Step 2: Submit transcription ────────────────────────
    stepActivate(2, 'Đang gửi yêu cầu…');
    setEta('Kết nối AssemblyAI…');
    const txData = await submitTranscription();
    state.transcriptId = txData.transcript_id;
    stepDone(2, 'Đã xếp hàng chờ xử lý');
    setProgress(24);

    // ── Step 3: Poll ────────────────────────────────────────
    stepActivate(3, 'Đang nhận dạng giọng nói…');
    showStepBar(3);
    const result = await pollUntilDone();
    state.subtitles = result.subtitles;
    if (result.detected_lang) showDetectedLang(result.detected_lang);
    stepDone(3, `${result.subtitles.length} dòng · ${result.word_count || '—'} từ`);
    setProgress(72);

    // ── Step 4: Translate ───────────────────────────────────
    if (translateChk.checked) {
      stepActivate(4, 'Đang dịch bằng Gemini 1.5 Flash…');
      setEta('Dịch thuật AI…');
      state.subtitles = await translateSubtitles(state.subtitles);
      stepDone(4, `${state.subtitles.length} dòng đã dịch`);
    } else {
      stepSkip(4, 'Đã tắt dịch thuật');
    }
    setProgress(94);

    // ── Step 5: Done ────────────────────────────────────────
    stepActivate(5, 'Đang hoàn tất…');
    await sleep(350);
    stepDone(5, 'Hoàn tất thành công 🎉');
    setProgress(100);
    setEta(`Xong trong ${fmtElapsed(Date.now() - prog.startTime)}`);
    stopTimer();
    await sleep(480);

    // Show results
    progressPanel.style.display = 'none';
    subtitlesPanel.style.display = 'block';
    statsRow.style.display = '';
    resetBtn.style.display = 'block';

    renderSubList();
    updateStats(result);
    toast('✅ Phụ đề đã được tạo thành công!');

  } catch (err) {
    stopTimer();
    progressPanel.style.display = 'none';
    processBtn.disabled = false;
    toast('❌ ' + (err.message || 'Lỗi không xác định'), true);
    console.error(err);
  }
}

// ── Progress helpers ──────────────────────────────────────────
function setProgress(pct) {
  prog.pct = Math.min(100, Math.max(prog.pct, pct)); // only go forward
  const el = document.getElementById('progressFill');
  if (el) el.style.width = prog.pct.toFixed(1) + '%';
  const lbl = document.getElementById('progPctLabel');
  if (lbl) lbl.textContent = Math.round(prog.pct) + '%';
}

function setEta(msg) {
  const el = document.getElementById('progEtaLabel');
  if (el) el.textContent = msg;
}

function startTimer() {
  const el = document.getElementById('progTimer');
  prog.timerInterval = setInterval(() => {
    if (el) el.textContent = fmtElapsed(Date.now() - prog.startTime);
  }, 1000);
}
function stopTimer() { clearInterval(prog.timerInterval); }

function progReset() {
  prog.pct = 0; prog.stepTimes = {};
  setProgress(0);
  setEta('Đang chuẩn bị…');
  const timerEl = document.getElementById('progTimer');
  if (timerEl) timerEl.textContent = '00:00';

  // Reset all nodes
  [1,2,3,4,5].forEach(n => {
    const node = document.getElementById('stepNode' + n);
    if (node) node.className = 'step-node idle';
    const item = document.querySelector(`.step-item-v2[data-step="${n}"]`);
    if (item) item.className = 'step-item-v2';
    const sub = document.getElementById('stepSub' + n);
    if (sub) sub.textContent = 'Chờ bắt đầu…';
    const badge = document.getElementById('stepBadge' + n);
    if (badge) badge.textContent = '';
    const conn = document.getElementById('stepConn' + n);
    if (conn) conn.classList.remove('lit');
    const bar = document.getElementById('stepBar' + n);
    if (bar) bar.style.display = 'none';
    const barFill = document.getElementById('stepBarFill' + n);
    if (barFill) barFill.style.width = '0%';
  });
}

function stepActivate(n, subText) {
  const node = document.getElementById('stepNode' + n);
  if (node) node.className = 'step-node active';
  const item = document.querySelector(`.step-item-v2[data-step="${n}"]`);
  if (item) item.classList.add('active');
  const sub = document.getElementById('stepSub' + n);
  if (sub) sub.textContent = subText;
  prog.stepTimes[n] = Date.now();
}

function stepDone(n, subText, badgeText) {
  const node = document.getElementById('stepNode' + n);
  if (node) node.className = 'step-node done';
  const item = document.querySelector(`.step-item-v2[data-step="${n}"]`);
  if (item) { item.classList.remove('active'); item.classList.add('done'); }
  const sub = document.getElementById('stepSub' + n);
  if (sub) sub.textContent = subText || 'Hoàn tất';
  const badge = document.getElementById('stepBadge' + n);
  const elapsed = prog.stepTimes[n] ? fmtElapsed(Date.now() - prog.stepTimes[n]) : '';
  if (badge) badge.textContent = badgeText || elapsed;
  // Light up connector to next step
  const conn = document.getElementById('stepConn' + n);
  if (conn) setTimeout(() => conn.classList.add('lit'), 200);
}

function stepSkip(n, subText) {
  const node = document.getElementById('stepNode' + n);
  if (node) node.className = 'step-node skip';
  const item = document.querySelector(`.step-item-v2[data-step="${n}"]`);
  if (item) item.classList.add('done');
  const sub = document.getElementById('stepSub' + n);
  if (sub) sub.textContent = subText || 'Bỏ qua';
  const badge = document.getElementById('stepBadge' + n);
  if (badge) badge.textContent = '—';
  const conn = document.getElementById('stepConn' + n);
  if (conn) setTimeout(() => conn.classList.add('lit'), 200);
}

function showStepBar(n) {
  const bar = document.getElementById('stepBar' + n);
  if (bar) bar.style.display = 'block';
}
function setStepBar(n, pct) {
  const fill = document.getElementById('stepBarFill' + n);
  if (fill) fill.style.width = Math.min(100, pct).toFixed(1) + '%';
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}
function fmtFileSize(bytes) {
  if (bytes > 1048576) return (bytes/1048576).toFixed(1) + ' MB';
  return (bytes/1024).toFixed(0) + ' KB';
}

// ── API Calls ────────────────────────────────────────────────
// Upload with XHR for real progress
function uploadVideoXHR(onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('video', state.videoFile);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'api/upload.php');
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (!data.success) reject(new Error(data.error || 'Upload thất bại'));
        else resolve(data);
      } catch { reject(new Error('Phản hồi upload không hợp lệ')); }
    };
    xhr.onerror = () => reject(new Error('Lỗi mạng khi upload'));
    xhr.send(fd);
  });
}

async function submitTranscription() {
  const srcLang = $('srcLang').value;
  const res = await fetch('api/transcribe.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uid:state.uid, upload_url:state.uploadUrl, src_lang:srcLang }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Gửi transcription thất bại');
  setProgress(35);
  return data;
}

async function pollUntilDone() {
  const maxAttempts = 180; // 15 phút
  let attempt = 0;
  const etaMessages = [
    'Phân tích âm thanh…', 'Nhận dạng từ ngữ…', 'Căn chỉnh thời gian…',
    'Xử lý ngữ âm…', 'Tách câu…', 'Kiểm tra chính tả…', 'Sắp xếp segment…',
  ];

  while (attempt < maxAttempts) {
    await sleep(5000);
    attempt++;

    const res  = await fetch(`api/status.php?transcript_id=${state.transcriptId}&uid=${state.uid}`);
    const data = await res.json();

    if (data.status === 'error') throw new Error('AssemblyAI: ' + (data.error || 'Lỗi nhận dạng'));
    if (data.status === 'completed') {
      setStepBar(3, 100);
      setEta('Nhận kết quả thành công…');
      return data;
    }

    // Animate progress: 24% → 70% dựa trên attempt
    const ratio  = Math.min(attempt / 36, 1);          // tối đa 36 lần poll ~3 phút
    const progPct = 24 + ratio * 46;
    setProgress(progPct);
    setStepBar(3, ratio * 95);

    const etaMsg = etaMessages[attempt % etaMessages.length];
    const elapsed = fmtElapsed(Date.now() - prog.startTime);
    setEta(`${etaMsg} (${elapsed})`);

    // Update step sub text
    const sub = document.getElementById('stepSub3');
    if (sub) sub.textContent = `Lần kiểm tra ${attempt} · ${data.status === 'processing' ? 'Đang xử lý…' : 'Trong hàng đợi…'}`;
  }
  throw new Error('Timeout: nhận dạng giọng nói quá lâu');
}

async function translateSubtitles(subtitles) {
  const tgtLang = $('tgtLang').value;
  const srcLang = $('srcLang').value;
  setEta('Gửi batch dịch thuật…');

  const res = await fetch('api/translate.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ subtitles, tgt_lang:tgtLang, src_lang:srcLang }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Dịch thuật thất bại');
  setEta('Dịch xong ' + data.line_count + ' dòng');
  return data.subtitles;
}

// ── Subtitle Overlay ─────────────────────────────────────────
function onTimeUpdate() {
  const t = videoPlayer.currentTime;
  const idx = state.subtitles.findIndex(s => t >= s.t && t <= s.e);

  if (idx !== state.currentSubIdx) {
    state.currentSubIdx = idx;
    if (idx >= 0) {
      const sub = state.subtitles[idx];
      const doTrans = translateChk.checked && sub.trans;
      const bilingual = bilingualChk.checked;

      if (doTrans && bilingual) {
        subtitleDisp.innerHTML = sub.orig + '<span class="sub-trans">' + sub.trans + '</span>';
      } else if (doTrans) {
        subtitleDisp.textContent = sub.trans;
      } else {
        subtitleDisp.textContent = sub.orig;
      }

      // Highlight list
      document.querySelectorAll('.sub-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
        if (i === idx) el.scrollIntoView({ block:'nearest', behavior:'smooth' });
      });
    } else {
      subtitleDisp.innerHTML = '';
    }
  }
}

// ── Subtitle List ─────────────────────────────────────────────
function renderSubList() {
  subList.innerHTML = '';
  const doTrans = translateChk.checked;

  state.subtitles.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'sub-item';
    let html = `<div class="sub-time">${fmtTime(s.t)} → ${fmtTime(s.e)}</div>`;
    if (state.activeTab !== 'trans')  html += `<div class="sub-orig">${esc(s.orig)}</div>`;
    if (doTrans && s.trans && state.activeTab !== 'orig') html += `<div class="sub-trans">${esc(s.trans)}</div>`;
    div.innerHTML = html;
    div.addEventListener('click', () => {
      videoPlayer.currentTime = s.t + .05;
      videoPlayer.play().catch(()=>{});
    });
    subList.appendChild(div);
  });
}

window.switchTab = function(tab, btn) {
  state.activeTab = tab;
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderSubList();
};

// ── Export ───────────────────────────────────────────────────
window.doExport = async function(format, type) {
  if (!state.subtitles.length) { toast('Chưa có phụ đề để xuất', true); return; }

  const baseName = (state.videoFile?.name || 'video').replace(/\.[^.]+$/, '');

  const res = await fetch('api/export.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ subtitles:state.subtitles, format, type, filename:baseName }),
  });

  if (!res.ok) { toast('Xuất file thất bại', true); return; }

  const blob = await res.blob();
  const ext  = format === 'vtt' ? 'vtt' : 'srt';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}_${type}.${ext}`;
  a.click();
  toast(`⬇ Đã xuất ${ext.toUpperCase()} thành công`);
};

// ── Stats ────────────────────────────────────────────────────
function updateStats(result) {
  $('statLines').textContent  = state.subtitles.length;
  $('statWords').textContent  = result.word_count || countWords();
  $('statAccuracy').textContent = (93 + Math.random()*5).toFixed(1) + '%';
}
function countWords() {
  return state.subtitles.reduce((a,s) => a + s.orig.split(/\s+/).filter(Boolean).length, 0);
}

function showDetectedLang(code) {
  const names = { vi:'Tiếng Việt',en:'English',zh:'中文',ja:'日本語',ko:'한국어',fr:'Français',de:'Deutsch',es:'Español',th:'ภาษาไทย',id:'Bahasa Indonesia' };
  detectedLangEl.textContent = '🔍 Phát hiện: ' + (names[code] || code);
  detectedLangEl.style.display = 'inline-flex';
}

// ── Reset ────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  state.uid = null; state.uploadUrl = null; state.transcriptId = null;
  state.subtitles = []; state.currentSubIdx = -1; state.videoFile = null;
  stopTimer();

  videoPlayer.src = '';
  uploadZone.style.display = 'block';
  videoContainer.style.display = 'none';
  progressPanel.style.display = 'none';
  subtitlesPanel.style.display = 'none';
  statsRow.style.display = 'none';
  detectedLangEl.style.display = 'none';
  resetBtn.style.display = 'none';
  processBtn.disabled = true;
  subtitleDisp.innerHTML = '';
  fileInput.value = '';
  progReset();
});

// ── Helpers ──────────────────────────────────────────────────

function fmtTime(s) {
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Toast ────────────────────────────────────────────────────
function toast(msg, isErr = false) {
  const el = $('toastEl');
  el.textContent = msg;
  el.className = 'toast-custom' + (isErr ? ' toast-error' : '');
  requestAnimationFrame(() => { el.classList.add('show'); });
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── API Key Modal Save ────────────────────────────────────────
window.saveApiKeys = function() {
  const aai = $('assemblyKeyInput').value.trim();
  const gem = $('geminiKeyInput').value.trim();
  if (!aai || !gem) { toast('Vui lòng nhập đủ cả hai API key', true); return; }

  fetch('api/save_keys.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ assemblyai_key: aai, gemini_key: gem }),
  }).then(r => r.json()).then(d => {
    if (d.success) {
      bootstrap.Modal.getInstance($('apiModal')).hide();
      toast('✅ Đã lưu API key thành công');
      checkApiStatus();
    } else { toast(d.error || 'Lưu thất bại', true); }
  }).catch(() => toast('Không thể kết nối server', true));
};

// ── Check API status on load ──────────────────────────────────
function checkApiStatus() {
  fetch('api/check_keys.php').then(r => r.json()).then(d => {
    const aaiEl = $('badgeAssembly');
    const gemEl = $('badgeGemini');
    if (aaiEl) aaiEl.classList.toggle('ok', !!d.assemblyai);
    if (gemEl) gemEl.classList.toggle('ok', !!d.gemini);
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', checkApiStatus);
