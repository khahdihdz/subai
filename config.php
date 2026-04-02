<?php
// ============================================================
//  SubAI — Cấu hình hệ thống
// ============================================================

// Load .env file nếu tồn tại (local dev hoặc khi lưu qua UI)
$_envFile = __DIR__ . '/.env';
if (file_exists($_envFile)) {
    foreach (file($_envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $_line) {
        $_line = trim($_line);
        if ($_line === '' || str_starts_with($_line, '#')) continue;
        [$_k, $_v] = array_map('trim', explode('=', $_line, 2) + [1 => '']);
        if ($_k && !getenv($_k)) putenv("$_k=$_v"); // env var từ Render ưu tiên hơn
    }
}
unset($_envFile, $_line, $_k, $_v);

define('ASSEMBLYAI_API_KEY', getenv('ASSEMBLYAI_API_KEY') ?: '');
define('GEMINI_API_KEY',     getenv('GEMINI_API_KEY')     ?: '');

// Render.com: dùng /tmp vì container filesystem read-only ngoại trừ /tmp
$_baseDir = (is_writable('/tmp') && php_uname('s') !== 'Windows NT')
    ? '/tmp/subai_'
    : __DIR__ . '/';
define('UPLOAD_DIR', $_baseDir . 'uploads/');
define('TMP_DIR',    $_baseDir . 'tmp/');
unset($_baseDir);
define('MAX_SIZE',    500 * 1024 * 1024); // 500MB

define('ASSEMBLYAI_BASE', 'https://api.assemblyai.com/v2');
define('GEMINI_BASE',     'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');

$SUPPORTED_LANGS = [
    'vi' => '🇻🇳 Tiếng Việt',
    'en' => '🇺🇸 Tiếng Anh',
    'zh' => '🇨🇳 Tiếng Trung',
    'ja' => '🇯🇵 Tiếng Nhật',
    'ko' => '🇰🇷 Tiếng Hàn',
    'fr' => '🇫🇷 Tiếng Pháp',
    'de' => '🇩🇪 Tiếng Đức',
    'es' => '🇪🇸 Tiếng Tây Ban Nha',
    'th' => '🇹🇭 Tiếng Thái',
    'id' => '🇮🇩 Tiếng Indonesia',
];

$ASSEMBLYAI_LANG_MAP = [
    'vi' => 'vi', 'en' => 'en_us', 'zh' => 'zh',
    'ja' => 'ja', 'ko' => 'ko', 'fr' => 'fr',
    'de' => 'de', 'es' => 'es', 'th' => 'th', 'id' => 'id',
];

$LANG_NAMES_VI = [
    'vi'=>'tiếng Việt','en'=>'tiếng Anh','zh'=>'tiếng Trung',
    'ja'=>'tiếng Nhật','ko'=>'tiếng Hàn','fr'=>'tiếng Pháp',
    'de'=>'tiếng Đức','es'=>'tiếng Tây Ban Nha',
    'th'=>'tiếng Thái','id'=>'tiếng Indonesia',
];

// Đảm bảo thư mục tồn tại
foreach ([UPLOAD_DIR, TMP_DIR] as $dir) {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
}

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function curlPost(string $url, array $headers, string $body): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['body' => $res, 'code' => $code, 'error' => $err];
}

function curlGet(string $url, array $headers): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['body' => $res, 'code' => $code];
}
