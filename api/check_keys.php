<?php
// api/check_keys.php — Kiểm tra API key đã được cấu hình chưa
require_once __DIR__ . '/../config.php';

// Load .env nếu có
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2) + [1=>'']);
        if ($k) putenv("$k=$v");
    }
}

$aai = getenv('ASSEMBLYAI_API_KEY') ?: '';
$gem = getenv('GEMINI_API_KEY') ?: '';

jsonResponse([
    'assemblyai' => !empty($aai) && $aai !== 'YOUR_ASSEMBLYAI_KEY',
    'gemini'     => !empty($gem) && $gem !== 'YOUR_GEMINI_KEY',
]);
