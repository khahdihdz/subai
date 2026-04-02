<?php
// index.php — SubAI Frontend
require_once __DIR__ . '/config.php';

// Load .env nếu tồn tại
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2) + [1 => '']);
        if ($k) putenv("$k=$v");
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SubAI — Phụ Đề Thông Minh</title>
<meta name="description" content="Tự động tạo phụ đề và dịch video bằng AI — AssemblyAI + Gemini">

<!-- Bootstrap 5 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<!-- Bootstrap Icons -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
<!-- Custom -->
<link rel="stylesheet" href="assets/css/subai.css">
</head>
<body>

<!-- Blobs -->
<div class="blob blob-1"></div>
<div class="blob blob-2"></div>

<div class="page-wrap">

  <!-- ══ NAVBAR ══════════════════════════════════════════════ -->
  <nav class="navbar navbar-expand-lg sticky-top">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center gap-2" href="#">
        <span class="logo-dot"></span>
        <span class="logo-text text-white">SubAI</span>
      </a>

      <div class="d-flex align-items-center gap-3">
        <!-- API Status -->
        <div class="api-status-row d-none d-md-flex">
          <div class="api-badge" id="badgeAssembly">
            <span class="dot"></span> AssemblyAI
          </div>
          <div class="api-badge" id="badgeGemini">
            <span class="dot"></span> Gemini
          </div>
        </div>

        <!-- Settings -->
        <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#apiModal" style="border-color:var(--border2);color:var(--text2);">
          <i class="bi bi-key me-1"></i> API Keys
        </button>
      </div>
    </div>
  </nav>

  <div class="container">

    <!-- ══ HERO ══════════════════════════════════════════════ -->
    <section class="hero-section">
      <div class="nav-badge mb-3 d-inline-block">✦ AssemblyAI · Gemini AI</div>
      <h1 class="hero-title">
        Phụ Đề <span class="grad">Thông Minh</span><br>
        Dịch Tức Thì
      </h1>
      <p class="hero-subtitle mt-3">
        Nhận dạng giọng nói chính xác cao với AssemblyAI · Dịch sang 10 ngôn ngữ bằng Gemini 1.5 Flash
      </p>
    </section>

    <!-- ══ MAIN LAYOUT ═══════════════════════════════════════ -->
    <div class="row g-4">

      <!-- ── Left Column ── -->
      <div class="col-lg-7">

        <!-- Upload Zone -->
        <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
          <div class="upload-icon-wrap">🎬</div>
          <h4>Kéo thả video vào đây</h4>
          <p>hoặc nhấn để chọn file từ máy tính</p>
          <div class="fmt-pills mt-3">
            <?php foreach (['MP4','MOV','AVI','MKV','WEBM','MP3','WAV'] as $f): ?>
            <span class="fmt-pill"><?= $f ?></span>
            <?php endforeach; ?>
            <span class="fmt-pill" style="color:var(--warn);">≤ 500 MB</span>
          </div>
          <input type="file" id="fileInput" accept="video/*,audio/*">
        </div>

        <!-- Video Player -->
        <div id="videoContainer" class="mt-0">
          <div class="video-wrapper">
            <video id="videoPlayer" controls></video>
            <div class="subtitle-overlay">
              <div class="subtitle-display" id="subtitleDisplay"></div>
            </div>
          </div>
          <div class="video-meta">
            <span class="vname" id="videoNameEl">—</span>
            <span class="vdur"  id="videoDurEl">—</span>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="row g-3 mt-1" id="statsRow">
          <div class="col-4">
            <div class="stat-card">
              <span class="stat-num" id="statLines">0</span>
              <div class="stat-lbl">dòng phụ đề</div>
            </div>
          </div>
          <div class="col-4">
            <div class="stat-card">
              <span class="stat-num" id="statWords">0</span>
              <div class="stat-lbl">từ nhận dạng</div>
            </div>
          </div>
          <div class="col-4">
            <div class="stat-card">
              <span class="stat-num" id="statAccuracy">—</span>
              <div class="stat-lbl">độ chính xác</div>
            </div>
          </div>
        </div>

      </div><!-- /left -->

      <!-- ── Right Sidebar ── -->
      <div class="col-lg-5">

        <!-- Settings Panel -->
        <div class="panel-card" id="settingsPanel">
          <div class="panel-title"><span class="ptdot"></span> Cài Đặt</div>

          <!-- Source language -->
          <div class="mb-3">
            <label class="form-label"><i class="bi bi-mic me-1"></i>Ngôn ngữ nguồn</label>
            <select class="form-select" id="srcLang">
              <option value="auto">🔍 Tự động phát hiện</option>
              <?php foreach ($SUPPORTED_LANGS as $code => $name): ?>
              <option value="<?= $code ?>"><?= $name ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <!-- Translate toggle -->
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="form-check-label" style="font-size:.875rem; color:var(--text2);">
              <i class="bi bi-translate me-1"></i> Bật dịch thuật
            </span>
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="translateToggle" checked>
            </div>
          </div>

          <!-- Target language -->
          <div id="targetLangWrap" class="mb-3">
            <label class="form-label"><i class="bi bi-globe me-1"></i>Dịch sang</label>
            <select class="form-select" id="tgtLang">
              <?php foreach ($SUPPORTED_LANGS as $code => $name): ?>
              <option value="<?= $code ?>" <?= $code==='vi'?'selected':'' ?>><?= $name ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <!-- Bilingual toggle -->
          <div class="d-flex align-items-center justify-content-between mb-4">
            <span class="form-check-label" style="font-size:.875rem; color:var(--text2);">
              Hiển thị cả hai ngôn ngữ trên video
            </span>
            <div class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox" id="bilingualToggle">
            </div>
          </div>

          <!-- Detected lang badge -->
          <div id="detectedLang" class="lang-detected mb-3" style="display:none;"></div>

          <button class="btn-primary-grad" id="processBtn" disabled>
            <i class="bi bi-play-circle me-2"></i>Tạo Phụ Đề
          </button>
          <button class="btn-outline-dim mt-2" id="resetBtn" style="display:none;">
            <i class="bi bi-arrow-counterclockwise me-1"></i> Tải video khác
          </button>
        </div>

        <!-- Progress Panel -->
        <div class="panel-card" id="progressPanel">

          <!-- Header: title + timer -->
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="panel-title mb-0"><span class="ptdot"></span> Đang Xử Lý</div>
            <div class="prog-timer-wrap">
              <span class="prog-timer" id="progTimer">00:00</span>
            </div>
          </div>

          <!-- Main progress bar -->
          <div class="prog-bar-main-wrap mb-1">
            <div class="prog-bar-main" id="progressFill">
              <div class="prog-shimmer"></div>
            </div>
          </div>
          <div class="d-flex justify-content-between mb-3">
            <span class="prog-pct-label" id="progPctLabel">0%</span>
            <span class="prog-eta-label" id="progEtaLabel">Đang chuẩn bị…</span>
          </div>

          <!-- Steps -->
          <div class="step-list-v2" id="stepListV2">

            <div class="step-item-v2" data-step="1">
              <div class="step-left">
                <div class="step-node" id="stepNode1">
                  <span class="step-emoji">🔊</span>
                  <svg class="step-spinner" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke-width="2.5"/></svg>
                  <span class="step-check">✓</span>
                </div>
                <div class="step-connector" id="stepConn1"></div>
              </div>
              <div class="step-body">
                <div class="step-name">Upload video</div>
                <div class="step-sub" id="stepSub1">Chờ bắt đầu…</div>
                <div class="step-mini-bar-wrap" id="stepBar1" style="display:none">
                  <div class="step-mini-bar" id="stepBarFill1"></div>
                </div>
              </div>
              <div class="step-badge" id="stepBadge1"></div>
            </div>

            <div class="step-item-v2" data-step="2">
              <div class="step-left">
                <div class="step-node" id="stepNode2">
                  <span class="step-emoji">🤖</span>
                  <svg class="step-spinner" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke-width="2.5"/></svg>
                  <span class="step-check">✓</span>
                </div>
                <div class="step-connector" id="stepConn2"></div>
              </div>
              <div class="step-body">
                <div class="step-name">Gửi lên AssemblyAI</div>
                <div class="step-sub" id="stepSub2">Chờ bắt đầu…</div>
              </div>
              <div class="step-badge" id="stepBadge2"></div>
            </div>

            <div class="step-item-v2" data-step="3">
              <div class="step-left">
                <div class="step-node" id="stepNode3">
                  <span class="step-emoji">⏱</span>
                  <svg class="step-spinner" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke-width="2.5"/></svg>
                  <span class="step-check">✓</span>
                </div>
                <div class="step-connector" id="stepConn3"></div>
              </div>
              <div class="step-body">
                <div class="step-name">Nhận dạng giọng nói</div>
                <div class="step-sub" id="stepSub3">Chờ bắt đầu…</div>
                <div class="step-mini-bar-wrap" id="stepBar3" style="display:none">
                  <div class="step-mini-bar" id="stepBarFill3"></div>
                </div>
              </div>
              <div class="step-badge" id="stepBadge3"></div>
            </div>

            <div class="step-item-v2" data-step="4">
              <div class="step-left">
                <div class="step-node" id="stepNode4">
                  <span class="step-emoji">🌐</span>
                  <svg class="step-spinner" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke-width="2.5"/></svg>
                  <span class="step-check">✓</span>
                </div>
                <div class="step-connector" id="stepConn4"></div>
              </div>
              <div class="step-body">
                <div class="step-name">Dịch thuật Gemini</div>
                <div class="step-sub" id="stepSub4">Chờ bắt đầu…</div>
              </div>
              <div class="step-badge" id="stepBadge4"></div>
            </div>

            <div class="step-item-v2 last" data-step="5">
              <div class="step-left">
                <div class="step-node" id="stepNode5">
                  <span class="step-emoji">🎉</span>
                  <svg class="step-spinner" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke-width="2.5"/></svg>
                  <span class="step-check">✓</span>
                </div>
              </div>
              <div class="step-body">
                <div class="step-name">Hoàn tất</div>
                <div class="step-sub" id="stepSub5">Chờ bắt đầu…</div>
              </div>
              <div class="step-badge" id="stepBadge5"></div>
            </div>

          </div><!-- /step-list-v2 -->
        </div>

        <!-- Subtitles Panel -->
        <div class="panel-card" id="subtitlesPanel">
          <div class="panel-title"><span class="ptdot"></span> Phụ Đề</div>

          <div class="sub-tabs">
            <button class="sub-tab active" onclick="switchTab('both',this)">Cả hai</button>
            <button class="sub-tab" onclick="switchTab('orig',this)">Gốc</button>
            <button class="sub-tab" onclick="switchTab('trans',this)">Dịch</button>
          </div>

          <div class="sub-list" id="subList"></div>

          <!-- Export -->
          <div class="mt-3">
            <div class="panel-title" style="margin-bottom:10px;"><span class="ptdot"></span> Xuất File</div>
            <div class="d-flex gap-2 mb-2">
              <button class="btn-export" onclick="doExport('srt','orig')">
                <i class="bi bi-download"></i><span> SRT Gốc</span>
              </button>
              <button class="btn-export" onclick="doExport('srt','trans')">
                <i class="bi bi-download"></i><span> SRT Dịch</span>
              </button>
              <button class="btn-export" onclick="doExport('srt','bilingual')">
                <i class="bi bi-download"></i><span> SRT Song ngữ</span>
              </button>
            </div>
            <div class="d-flex gap-2">
              <button class="btn-export" onclick="doExport('vtt','orig')">
                <i class="bi bi-download"></i><span> VTT Gốc</span>
              </button>
              <button class="btn-export" onclick="doExport('vtt','trans')">
                <i class="bi bi-download"></i><span> VTT Dịch</span>
              </button>
              <button class="btn-export" onclick="doExport('vtt','bilingual')">
                <i class="bi bi-download"></i><span> VTT Song ngữ</span>
              </button>
            </div>
          </div>
        </div>

      </div><!-- /sidebar -->
    </div><!-- /row -->

    <!-- ══ FOOTER ════════════════════════════════════════════ -->
    <footer class="text-center py-5 mt-4" style="border-top:1px solid var(--border); color:var(--muted); font-size:.8rem;">
      <p class="mb-1">
        Powered by
        <a href="https://www.assemblyai.com" target="_blank" style="color:var(--accent); text-decoration:none;">AssemblyAI</a>
        &amp;
        <a href="https://ai.google.dev" target="_blank" style="color:var(--teal); text-decoration:none;">Google Gemini</a>
      </p>
      <p class="mb-0 mt-1" style="font-family:var(--font-mono); font-size:.7rem;">
        SubAI <?= date('Y') ?> · Video không được lưu trữ vĩnh viễn
      </p>
    </footer>

  </div><!-- /container -->
</div><!-- /page-wrap -->

<!-- ══ API KEYS MODAL ══════════════════════════════════════════ -->
<div class="modal fade" id="apiModal" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title"><i class="bi bi-key me-2" style="color:var(--accent)"></i>Cấu Hình API Keys</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="alert-dim mb-3">
          <i class="bi bi-info-circle me-1" style="color:var(--teal)"></i>
          Key được lưu tại server, không gửi qua internet. Trang web chỉ dùng cho mục đích cá nhân.
        </div>

        <div class="mb-3">
          <label class="form-label">
            <i class="bi bi-soundwave me-1" style="color:var(--accent)"></i>
            AssemblyAI API Key
          </label>
          <input type="password" class="form-control" id="assemblyKeyInput" placeholder="assemblyai_xxxxxxxxxxxxxxxx">
          <div class="key-hint mt-1">
            Lấy tại <a href="https://www.assemblyai.com/dashboard" target="_blank" style="color:var(--accent)">assemblyai.com/dashboard</a>
            · Miễn phí 5 giờ âm thanh/tháng
          </div>
        </div>

        <div class="mb-2">
          <label class="form-label">
            <i class="bi bi-google me-1" style="color:var(--teal)"></i>
            Google Gemini API Key
          </label>
          <input type="password" class="form-control" id="geminiKeyInput" placeholder="AIzaSy_xxxxxxxxxxxxxxxxxxxxx">
          <div class="key-hint mt-1">
            Lấy tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--teal)">aistudio.google.com</a>
            · Miễn phí 1.5M token/ngày với Gemini Flash
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Hủy</button>
        <button class="btn btn-sm" style="background:var(--accent);color:#fff;" onclick="saveApiKeys()">
          <i class="bi bi-save me-1"></i> Lưu API Keys
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast-custom" id="toastEl"></div>

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<!-- App JS -->
<script src="assets/js/subai.js"></script>
</body>
</html>
