<?php
// api/debug.php — Kiểm tra cấu hình server (xóa sau khi debug xong)
header('Content-Type: application/json');
echo json_encode([
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size'       => ini_get('post_max_size'),
    'max_execution_time'  => ini_get('max_execution_time'),
    'memory_limit'        => ini_get('memory_limit'),
    'tmp_dir'             => sys_get_temp_dir(),
    'upload_dir_exists'   => is_dir(__DIR__ . '/../uploads/'),
    'upload_dir_writable' => is_writable(__DIR__ . '/../uploads/'),
    'tmp_dir_exists'      => is_dir(__DIR__ . '/../tmp/'),
    'tmp_dir_writable'    => is_writable(__DIR__ . '/../tmp/'),
    'php_version'         => PHP_VERSION,
    'server_software'     => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
    'request_method'      => $_SERVER['REQUEST_METHOD'],
    'files'               => $_FILES,
    'post_keys'           => array_keys($_POST),
], JSON_PRETTY_PRINT);
