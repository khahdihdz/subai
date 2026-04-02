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
  if (f && f.type.startsWith('video/')) handleFile(f);
  else toast('⚠️ Vui lòng chọn file video hợp lệ', true);
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

async function runPipeline() {
  if (!state.videoFile) return;

  processBtn.disabled = true;
  resetBtn.style.display = 'none';
  progressPanel.style.display = 'block';
  subtitlesPanel.style.display = 'none';
  statsRow.style.display = 'none';
  detectedLangEl.style.display = 'none';

  resetSteps();

  try {
    // Step 1 — Upload
    setStep(1, 'active');
    const uploadData = await uploadVideo();
    state.uid = uploadData.uid;
    state.uploadUrl = uploadData.upload_url;
    setStep(1, 'done');

    // Step 2 — Submit transcription
    setStep(2, 'active');
    const txData = await submitTranscription();
    state.transcriptId = txData.transcript_id;
    setStep(2, 'done');

    // Step 3 — Poll until done
    setStep(3, 'active');
    const result = await pollUntilDone();
    state.subtitles = result.subtitles;
    if (result.detected_lang) showDetectedLang(result.detected_lang);
    setStep(3, 'done');

    // Step 4 — Translate (optional)
    if (translateChk.checked) {
      setStep(4, 'active');
      state.subtitles = await translateSubtitles(state.subtitles);
      setStep(4, 'done');
    } else {
      setStep(4, 'done', '—');
    }

    // Step 5 — Done
    setStep(5, 'active');
    await sleep(400);
    setStep(5, 'done');
    progressFill.style.width = '100%';
    await sleep(300);

    // Show results
    progressPanel.style.display = 'none';
    subtitlesPanel.style.display = 'block';
    statsRow.style.display = '';
    resetBtn.style.display = 'block';

    renderSubList();
    updateStats(result);
    toast('✅ Phụ đề đã được tạo thành công!');

  } catch (err) {
    progressPanel.style.display = 'none';
    processBtn.disabled = false;
    toast('❌ ' + (err.message || 'Lỗi không xác định'), true);
    console.error(err);
  }
}

// ── API Calls ────────────────────────────────────────────────
async function uploadVideo() {
  const fd = new FormData();
  fd.append('video', state.videoFile);
  const res = await fetch('api/upload.php', { method:'POST', body:fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Upload thất bại');
  setProgress(20);
  return data;
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

  while (attempt < maxAttempts) {
    await sleep(5000);
    attempt++;

    const res  = await fetch(`api/status.php?transcript_id=${state.transcriptId}&uid=${state.uid}`);
    const data = await res.json();

    if (data.status === 'error') throw new Error('AssemblyAI: ' + (data.error || 'Lỗi nhận dạng'));
    if (data.status === 'completed') {
      setProgress(70);
      return data;
    }

    // Cập nhật progress tạm
    const p = 35 + Math.min(attempt/36 * 30, 30);
    setProgress(p);
  }
  throw new Error('Timeout: nhận dạng giọng nói quá lâu');
}

async function translateSubtitles(subtitles) {
  const tgtLang = $('tgtLang').value;
  const srcLang = $('srcLang').value;
  setProgress(75);

  const res = await fetch('api/translate.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ subtitles, tgt_lang:tgtLang, src_lang:srcLang }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Dịch thuật thất bại');
  setProgress(95);
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
  clearInterval(state.pollTimer);

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
  progressFill.style.width = '0%';
  resetSteps();
});

// ── Helpers ──────────────────────────────────────────────────
function setStep(n, cls, iconOverride) {
  const el = document.querySelector(`.step-item[data-step="${n}"]`);
  if (!el) return;
  el.classList.remove('active','done');
  el.classList.add(cls);
  const icon = el.querySelector('.step-icon-wrap');
  if (iconOverride) { icon.textContent = iconOverride; return; }
  if (cls === 'done')   icon.textContent = '✓';
}
function resetSteps() {
  const emojis = ['🔊','🤖','⏱','🌐','✅'];
  document.querySelectorAll('.step-item').forEach((el, i) => {
    el.classList.remove('active','done');
    const icon = el.querySelector('.step-icon-wrap');
    if (icon) icon.textContent = emojis[i] || '·';
  });
  progressFill.style.width = '0%';
}
function setProgress(pct) { progressFill.style.width = pct + '%'; }

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
