<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json');

// Thử tạo thư mục nếu chưa có
foreach ([UPLOAD_DIR, TMP_DIR] as $dir) {
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
}

// Thử ghi file test
$testUpload = UPLOAD_DIR . 'test_write.txt';
$testTmp    = TMP_DIR    . 'test_write.txt';
@file_put_contents($testUpload, 'ok');
@file_put_contents($testTmp, 'ok');

echo json_encode([
    'php_version'          => PHP_VERSION,
    'server_software'      => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'os'                   => PHP_OS_FAMILY,
    'upload_max_filesize'  => ini_get('upload_max_filesize'),
    'post_max_size'        => ini_get('post_max_size'),
    'max_execution_time'   => ini_get('max_execution_time'),
    'memory_limit'         => ini_get('memory_limit'),
    'upload_tmp_dir'       => ini_get('upload_tmp_dir') ?: sys_get_temp_dir(),
    'sys_tmp'              => sys_get_temp_dir(),
    'tmp_writable'         => is_writable(sys_get_temp_dir()),
    'UPLOAD_DIR'           => UPLOAD_DIR,
    'upload_dir_exists'    => is_dir(UPLOAD_DIR),
    'upload_dir_writable'  => is_writable(UPLOAD_DIR),
    'upload_write_test'    => file_exists($testUpload) ? 'OK' : 'FAIL',
    'TMP_DIR'              => TMP_DIR,
    'tmp_dir_exists'       => is_dir(TMP_DIR),
    'tmp_dir_writable'     => is_writable(TMP_DIR),
    'tmp_write_test'       => file_exists($testTmp) ? 'OK' : 'FAIL',
], JSON_PRETTY_PRINT);

// Dọn file test
@unlink($testUpload);
@unlink($testTmp);
