<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        if (!headers_sent()) http_response_code(500);
        echo json_encode(['error' => 'PHP fatal: ' . $e['message']]);
    }
});
// api/push.php — Đẩy file đã lưu local lên AssemblyAI CDN
// Được gọi từ JS sau khi upload.php hoàn tất (XHR progress xong)
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$uid  = trim($body['uid'] ?? '');

if (!$uid) {
    jsonResponse(['error' => 'Thiếu uid'], 400);
}

$metaPath = TMP_DIR . $uid . '.json';
if (!file_exists($metaPath)) {
    jsonResponse(['error' => 'Không tìm thấy file metadata'], 404);
}

$meta = json_decode(file_get_contents($metaPath), true);
$savePath = $meta['local_path'] ?? '';

if (!$savePath || !file_exists($savePath)) {
    jsonResponse(['error' => 'File local không tồn tại'], 404);
}

// Nếu đã có upload_url rồi thì trả về luôn (tránh upload 2 lần)
if (!empty($meta['upload_url'])) {
    jsonResponse([
        'success'    => true,
        'uid'        => $uid,
        'upload_url' => $meta['upload_url'],
    ]);
}

$fileSize = filesize($savePath);

// Upload lên AssemblyAI CDN bằng POST với raw binary
$ch = curl_init(ASSEMBLYAI_BASE . '/upload');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => file_get_contents($savePath),
    CURLOPT_HTTPHEADER     => [
        'Authorization: ' . ASSEMBLYAI_API_KEY,
        'Content-Type: application/octet-stream',
        'Content-Length: ' . $fileSize,
    ],
    CURLOPT_TIMEOUT        => 600,
    CURLOPT_SSL_VERIFYPEER => false,
]);
$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($err || $code !== 200) {
    $detail = '';
    if ($res) {
        $parsed = json_decode($res, true);
        $detail = $parsed['error'] ?? $res;
    }
    jsonResponse(['error' => "AssemblyAI upload lỗi (HTTP $code): " . ($err ?: $detail)], 500);
}

$data = json_decode($res, true);
if (empty($data['upload_url'])) {
    jsonResponse(['error' => 'AssemblyAI không trả về upload_url'], 500);
}

// Cập nhật metadata
$meta['upload_url'] = $data['upload_url'];
$meta['status']     = 'uploaded';
file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT));

jsonResponse([
    'success'    => true,
    'uid'        => $uid,
    'upload_url' => $data['upload_url'],
]);
