<?php
// api/export.php — Xuất file SRT / WebVTT
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body      = json_decode(file_get_contents('php://input'), true);
$subtitles = $body['subtitles'] ?? [];
$format    = strtolower(trim($body['format'] ?? 'srt'));  // srt | vtt
$type      = strtolower(trim($body['type']   ?? 'orig')); // orig | trans | bilingual
$filename  = preg_replace('/[^a-z0-9_\-]/i', '_', $body['filename'] ?? 'subtitles');

if (empty($subtitles)) {
    jsonResponse(['error' => 'Không có phụ đề'], 400);
}

// Chọn nội dung
function getLine(array $sub, string $type): string {
    return match($type) {
        'trans'     => $sub['trans'] ?: $sub['orig'],
        'bilingual' => $sub['orig'] . "\n" . ($sub['trans'] ?: ''),
        default     => $sub['orig'],
    };
}

if ($format === 'vtt') {
    header('Content-Type: text/vtt; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}_{$type}.vtt\"");

    echo "WEBVTT\n\n";
    foreach ($subtitles as $i => $sub) {
        $t1 = vttTime($sub['t']);
        $t2 = vttTime($sub['e']);
        echo ($i + 1) . "\n";
        echo "$t1 --> $t2\n";
        echo getLine($sub, $type) . "\n\n";
    }
} else {
    header('Content-Type: text/srt; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}_{$type}.srt\"");

    foreach ($subtitles as $i => $sub) {
        $t1 = srtTime($sub['t']);
        $t2 = srtTime($sub['e']);
        echo ($i + 1) . "\r\n";
        echo "$t1 --> $t2\r\n";
        echo getLine($sub, $type) . "\r\n\r\n";
    }
}
exit;

function srtTime(float $s): string {
    $h   = (int)($s / 3600);
    $m   = (int)(($s % 3600) / 60);
    $sec = (int)($s % 60);
    $ms  = round(($s - floor($s)) * 1000);
    return sprintf('%02d:%02d:%02d,%03d', $h, $m, $sec, $ms);
}

function vttTime(float $s): string {
    return str_replace(',', '.', srtTime($s));
}
