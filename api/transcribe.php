<?php
// api/transcribe.php — Gửi job nhận dạng giọng nói lên AssemblyAI
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$uid        = trim($body['uid'] ?? '');
$uploadUrl  = trim($body['upload_url'] ?? '');
$srcLang    = trim($body['src_lang'] ?? 'auto');
$autoDetect = ($srcLang === 'auto');

global $ASSEMBLYAI_LANG_MAP;
require_once __DIR__ . '/../config.php';

if (!$uid || !$uploadUrl) {
    jsonResponse(['error' => 'Thiếu uid hoặc upload_url'], 400);
}

// Build AssemblyAI request
$payload = [
    'audio_url'            => $uploadUrl,
    'punctuate'            => true,
    'format_text'          => true,
    'speaker_labels'       => false,
    'auto_highlights'      => false,
    'word_boost'           => [],
];

if (!$autoDetect && isset($ASSEMBLYAI_LANG_MAP[$srcLang])) {
    $payload['language_code'] = $ASSEMBLYAI_LANG_MAP[$srcLang];
} else {
    $payload['language_detection'] = true;
}

$result = curlPost(
    ASSEMBLYAI_BASE . '/transcript',
    ['Authorization: ' . ASSEMBLYAI_API_KEY, 'Content-Type: application/json'],
    json_encode($payload)
);

if ($result['code'] !== 200) {
    $err = json_decode($result['body'], true);
    jsonResponse(['error' => 'AssemblyAI từ chối: ' . ($err['error'] ?? $result['body'])], 500);
}

$data = json_decode($result['body'], true);
if (empty($data['id'])) {
    jsonResponse(['error' => 'Không nhận được transcript ID'], 500);
}

// Lưu transcript_id vào metadata
$metaPath = TMP_DIR . $uid . '.json';
if (file_exists($metaPath)) {
    $meta = json_decode(file_get_contents($metaPath), true);
    $meta['transcript_id'] = $data['id'];
    $meta['src_lang']      = $srcLang;
    $meta['status']        = 'processing';
    file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT));
}

jsonResponse([
    'success'       => true,
    'transcript_id' => $data['id'],
    'status'        => $data['status'],
]);
