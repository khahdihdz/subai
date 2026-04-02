<?php
// api/upload.php — Nhận video, stream thẳng lên AssemblyAI CDN, trả uid + upload_url ngay
// Không lưu file trung gian → nhanh gấp đôi, tiết kiệm disk

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) http_response_code(500);
        echo json_encode(['error' => 'PHP fatal: ' . $e['message'] . ' line ' . $e['line']]);
    }
});

require_once __DIR__ . '/../config.php';
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

if (empty($_FILES['video'])) {
    jsonResponse(['error' => 'Không tìm thấy file video'], 400);
}

$file = $_FILES['video'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'File quá lớn (giới hạn server: ' . ini_get('upload_max_filesize') . ')',
        UPLOAD_ERR_FORM_SIZE  => 'File quá lớn (form)',
        UPLOAD_ERR_PARTIAL    => 'Upload không hoàn chỉnh',
        UPLOAD_ERR_NO_FILE    => 'Không có file',
        UPLOAD_ERR_NO_TMP_DIR => 'Thiếu thư mục tmp',
        UPLOAD_ERR_CANT_WRITE => 'Không thể ghi file',
    ];
    jsonResponse(['error' => $errors[$file['error']] ?? 'Lỗi upload #' . $file['error']], 400);
}

if ($file['size'] > MAX_SIZE) {
    jsonResponse(['error' => 'File quá lớn. Giới hạn ' . (MAX_SIZE / 1048576) . 'MB'], 400);
}

$allowed = ['video/mp4','video/mpeg','video/quicktime','video/x-msvideo',
            'video/webm','video/x-matroska','video/x-ms-wmv','audio/mpeg',
            'audio/wav','audio/mp4','audio/x-m4a','audio/ogg','audio/webm'];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed)) {
    jsonResponse(['error' => "Định dạng không hỗ trợ: $mime"], 400);
}

$fileSize = $file['size'];
$tmpPath  = $file['tmp_name']; // PHP tmp file — dùng trực tiếp, không copy

// ── Stream file từ PHP tmp thẳng lên AssemblyAI CDN ──────────
$fp = fopen($tmpPath, 'rb');
if (!$fp) {
    jsonResponse(['error' => 'Không mở được file tmp'], 500);
}

$ch = curl_init(ASSEMBLYAI_BASE . '/upload');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_READFUNCTION   => function($ch, $fp, $length) { return fread($fp, $length); },
    CURLOPT_POSTFIELDSIZE  => $fileSize,
    CURLOPT_HTTPHEADER     => [
        'Authorization: ' . ASSEMBLYAI_API_KEY,
        'Content-Type: application/octet-stream',
        'Content-Length: ' . $fileSize,
        'Transfer-Encoding: chunked',
    ],
    CURLOPT_INFILE         => $fp,
    CURLOPT_UPLOAD         => true,   // dùng PUT-style stream (AssemblyAI chấp nhận cả PUT lẫn POST)
    CURLOPT_CUSTOMREQUEST  => 'POST', // override về POST
    CURLOPT_TIMEOUT        => 600,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_BUFFERSIZE     => 1024 * 1024, // 1MB buffer
]);

$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);
fclose($fp);

if ($err || $code !== 200) {
    $detail = '';
    if ($res) { $parsed = json_decode($res, true); $detail = $parsed['error'] ?? substr($res, 0, 200); }
    jsonResponse(['error' => "AssemblyAI upload lỗi (HTTP $code): " . ($err ?: $detail)], 500);
}

$data = json_decode($res, true);
if (empty($data['upload_url'])) {
    jsonResponse(['error' => 'AssemblyAI không trả về upload_url: ' . substr($res, 0, 200)], 500);
}

// Lưu metadata nhỏ (không lưu file video)
$uid      = uniqid('sub_', true);
$meta = [
    'uid'        => $uid,
    'filename'   => $file['name'],
    'size'       => $fileSize,
    'mime'       => $mime,
    'upload_url' => $data['upload_url'],
    'status'     => 'uploaded',
    'created_at' => date('c'),
];
file_put_contents(TMP_DIR . $uid . '.json', json_encode($meta, JSON_PRETTY_PRINT));

jsonResponse([
    'success'    => true,
    'uid'        => $uid,
    'filename'   => $file['name'],
    'size'       => $fileSize,
    'upload_url' => $data['upload_url'],
]);
