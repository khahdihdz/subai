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
// api/translate.php — Dịch phụ đề bằng Gemini 1.5 Flash
require_once __DIR__ . '/../config.php';

header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$body      = json_decode(file_get_contents('php://input'), true);
$subtitles = $body['subtitles'] ?? [];
$tgtLang   = trim($body['tgt_lang'] ?? 'vi');
$srcLang   = trim($body['src_lang'] ?? 'auto');

global $LANG_NAMES_VI;

if (empty($subtitles)) {
    jsonResponse(['error' => 'Không có phụ đề để dịch'], 400);
}

$langName = $LANG_NAMES_VI[$tgtLang] ?? 'tiếng Việt';
$srcName  = $srcLang !== 'auto' ? ($LANG_NAMES_VI[$srcLang] ?? 'ngôn ngữ nguồn') : 'ngôn ngữ gốc';

// Dịch theo batch (tối đa 30 dòng mỗi lần)
$batches = array_chunk($subtitles, 30, true);
$translated = [];

foreach ($batches as $batchIdx => $batch) {
    $lines = [];
    $keys  = [];

    foreach ($batch as $i => $sub) {
        $keys[]   = $i;
        $lines[]  = ($batchIdx * 30 + count($keys)) . '. ' . $sub['orig'];
    }

    $numbered = implode("\n", $lines);

    $prompt = <<<PROMPT
Bạn là chuyên gia dịch thuật chuyên nghiệp về phụ đề video.

Nhiệm vụ: Dịch các dòng phụ đề sau từ {$srcName} sang {$langName}.

Yêu cầu bắt buộc:
- Giữ nguyên số thứ tự (1., 2., ...) ở đầu mỗi dòng
- Dịch tự nhiên, phù hợp khẩu ngữ nói, ngắn gọn
- Không thêm giải thích, chú thích
- Chỉ trả về danh sách đã dịch, không có gì khác
- Mỗi bản dịch trên một dòng riêng

Danh sách phụ đề:
{$numbered}
PROMPT;

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature'     => 0.3,
            'maxOutputTokens' => 2048,
            'topP'            => 0.8,
        ],
    ];

    $url    = GEMINI_BASE . '?key=' . GEMINI_API_KEY;
    $result = curlPost(
        $url,
        ['Content-Type: application/json'],
        json_encode($payload)
    );

    if ($result['code'] !== 200) {
        $err = json_decode($result['body'], true);
        $msg = $err['error']['message'] ?? $result['body'];
        jsonResponse(['error' => "Gemini lỗi: $msg"], 500);
    }

    $geminiData = json_decode($result['body'], true);
    $rawText    = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? '';

    // Parse numbered lines
    $parsedLines = parseNumberedLines($rawText, count($batch));

    foreach ($keys as $pos => $origIdx) {
        $translated[$origIdx] = $parsedLines[$pos] ?? $subtitles[$origIdx]['orig'];
    }
}

// Gán bản dịch
$result = $subtitles;
foreach ($translated as $i => $trans) {
    $result[$i]['trans'] = $trans;
}

jsonResponse([
    'success'    => true,
    'subtitles'  => array_values($result),
    'tgt_lang'   => $tgtLang,
    'line_count' => count($result),
]);

// ──────────────────────────────────────────────────────────
function parseNumberedLines(string $text, int $expected): array {
    $lines  = explode("\n", trim($text));
    $parsed = [];

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        // Bỏ số thứ tự đầu dòng: "1. xxx", "1) xxx", "1: xxx"
        $clean = preg_replace('/^\d+[.\):\-]\s*/', '', $line);
        if ($clean !== '') $parsed[] = $clean;
    }

    // Padding nếu thiếu
    while (count($parsed) < $expected) {
        $parsed[] = '';
    }

    return array_slice($parsed, 0, $expected);
}
