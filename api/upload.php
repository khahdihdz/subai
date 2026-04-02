<?php
// api/upload.php — Nhận video, upload lên AssemblyAI CDN
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Kiểm tra file
if (empty($_FILES['video'])) {
    jsonResponse(['error' => 'Không tìm thấy file video'], 400);
}

$file = $_FILES['video'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'File quá lớn (php.ini)',
        UPLOAD_ERR_FORM_SIZE  => 'File quá lớn (form)',
        UPLOAD_ERR_PARTIAL    => 'Upload không hoàn chỉnh',
        UPLOAD_ERR_NO_FILE    => 'Không có file',
        UPLOAD_ERR_NO_TMP_DIR => 'Thiếu thư mục tmp',
        UPLOAD_ERR_CANT_WRITE => 'Không thể ghi file',
    ];
    jsonResponse(['error' => $errors[$file['error']] ?? 'Lỗi upload'], 400);
}

if ($file['size'] > MAX_SIZE) {
    jsonResponse(['error' => 'File quá lớn. Giới hạn 500MB'], 400);
}

$allowed = ['video/mp4','video/mpeg','video/quicktime','video/x-msvideo',
            'video/webm','video/x-matroska','video/x-ms-wmv','audio/mpeg',
            'audio/wav','audio/mp4','audio/x-m4a'];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed)) {
    jsonResponse(['error' => "Định dạng không hỗ trợ: $mime"], 400);
}

// Lưu file tạm
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$uid      = uniqid('sub_', true);
$savePath = UPLOAD_DIR . $uid . '.' . $ext;

if (!move_uploaded_file($file['tmp_name'], $savePath)) {
    jsonResponse(['error' => 'Không thể lưu file'], 500);
}

// Upload lên AssemblyAI CDN (stream file, không load vào RAM)
$fp       = fopen($savePath, 'rb');
$fileSize = filesize($savePath);

$ch = curl_init(ASSEMBLYAI_BASE . '/upload');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_PUT            => true,
    CURLOPT_INFILE         => $fp,
    CURLOPT_INFILESIZE     => $fileSize,
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
fclose($fp);

if ($err || $code !== 200) {
    @unlink($savePath);
    $detail = '';
    if ($res) {
        $parsed = json_decode($res, true);
        $detail = $parsed['error'] ?? $res;
    }
    jsonResponse(['error' => "AssemblyAI upload lỗi (HTTP $code): " . ($err ?: $detail)], 500);
}

$data = json_decode($res, true);
if (empty($data['upload_url'])) {
    @unlink($savePath);
    jsonResponse(['error' => 'AssemblyAI không trả về upload_url'], 500);
}

// Ghi metadata
$meta = [
    'uid'        => $uid,
    'filename'   => $file['name'],
    'size'       => $file['size'],
    'mime'       => $mime,
    'local_path' => $savePath,
    'upload_url' => $data['upload_url'],
    'created_at' => date('c'),
];
file_put_contents(TMP_DIR . $uid . '.json', json_encode($meta, JSON_PRETTY_PRINT));

jsonResponse([
    'success'    => true,
    'uid'        => $uid,
    'filename'   => $file['name'],
    'size'       => $file['size'],
    'upload_url' => $data['upload_url'],
]);
