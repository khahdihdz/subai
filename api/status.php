<?php
// api/status.php — Kiểm tra trạng thái transcription AssemblyAI
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');

$transcriptId = trim($_GET['transcript_id'] ?? '');
$uid          = trim($_GET['uid'] ?? '');

if (!$transcriptId) {
    jsonResponse(['error' => 'Thiếu transcript_id'], 400);
}

$result = curlGet(
    ASSEMBLYAI_BASE . '/transcript/' . $transcriptId,
    ['Authorization: ' . ASSEMBLYAI_API_KEY]
);

if ($result['code'] !== 200) {
    jsonResponse(['error' => 'Không lấy được trạng thái từ AssemblyAI'], 500);
}

$data = json_decode($result['body'], true);
$status = $data['status'] ?? 'unknown';

if ($status === 'error') {
    jsonResponse(['status' => 'error', 'error' => $data['error'] ?? 'Lỗi không xác định']);
}

if ($status !== 'completed') {
    jsonResponse([
        'status'  => $status,
        'percent' => match($status) {
            'queued'     => 10,
            'processing' => 45,
            default      => 30,
        }
    ]);
}

// Completed — chuyển words thành subtitle segments
$words       = $data['words'] ?? [];
$fullText    = $data['text'] ?? '';
$detectedLang = $data['language_code'] ?? 'unknown';

$subtitles = buildSubtitles($words, $fullText);

// Cập nhật metadata
if ($uid) {
    $metaPath = TMP_DIR . $uid . '.json';
    if (file_exists($metaPath)) {
        $meta = json_decode(file_get_contents($metaPath), true);
        $meta['status']        = 'transcribed';
        $meta['detected_lang'] = $detectedLang;
        $meta['subtitle_count']= count($subtitles);
        file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT));
    }
}

jsonResponse([
    'status'        => 'completed',
    'percent'       => 100,
    'subtitles'     => $subtitles,
    'full_text'     => $fullText,
    'detected_lang' => $detectedLang,
    'word_count'    => count($words),
]);

// ──────────────────────────────────────────────────────────
// Tách words thành các cụm subtitle (tối đa 8 giây / ~12 từ)
// ──────────────────────────────────────────────────────────
function buildSubtitles(array $words, string $fullText): array {
    if (empty($words)) {
        // Không có word-level timing — tạo fake segments
        $sentences = preg_split('/(?<=[.!?।。])\s+/', $fullText, -1, PREG_SPLIT_NO_EMPTY);
        if (empty($sentences)) return [];
        $dur = 3.5;
        $subs = [];
        foreach ($sentences as $i => $s) {
            $subs[] = ['t' => round($i * $dur, 2), 'e' => round(($i+1)*$dur, 2), 'orig' => trim($s), 'trans' => ''];
        }
        return $subs;
    }

    $subs    = [];
    $chunk   = [];
    $startMs = null;

    foreach ($words as $w) {
        if ($startMs === null) $startMs = $w['start'];
        $chunk[] = $w['text'];
        $endMs   = $w['end'];
        $durMs   = $endMs - $startMs;

        $shouldSplit = count($chunk) >= 12 || $durMs >= 8000
            || (count($chunk) >= 6 && str_ends_with($w['text'], '.'))
            || (count($chunk) >= 4 && str_ends_with($w['text'], ','));

        if ($shouldSplit) {
            $subs[] = [
                't'    => round($startMs / 1000, 3),
                'e'    => round($endMs   / 1000, 3),
                'orig' => implode(' ', $chunk),
                'trans'=> '',
            ];
            $chunk   = [];
            $startMs = null;
        }
    }

    // Phần còn lại
    if ($chunk && $startMs !== null) {
        $subs[] = [
            't'    => round($startMs / 1000, 3),
            'e'    => round($endMs   / 1000, 3),
            'orig' => implode(' ', $chunk),
            'trans'=> '',
        ];
    }

    return $subs;
}
