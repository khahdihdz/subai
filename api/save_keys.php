<?php
// api/save_keys.php — Lưu API key vào .env file
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error'=>'Method not allowed'], 405);
}

$body   = json_decode(file_get_contents('php://input'), true);
$aaiKey = trim($body['assemblyai_key'] ?? '');
$gemKey = trim($body['gemini_key'] ?? '');

if (!$aaiKey || !$gemKey) {
    jsonResponse(['error'=>'Thiếu API key'], 400);
}

// Validate format (basic)
if (!preg_match('/^[a-zA-Z0-9_\-]{20,}$/', $aaiKey)) {
    jsonResponse(['error'=>'AssemblyAI key không hợp lệ'], 400);
}
if (!preg_match('/^[a-zA-Z0-9_\-]{20,}$/', $gemKey)) {
    jsonResponse(['error'=>'Gemini key không hợp lệ'], 400);
}

$envPath = __DIR__ . '/../.env';
$content = "ASSEMBLYAI_API_KEY={$aaiKey}\nGEMINI_API_KEY={$gemKey}\n";
file_put_contents($envPath, $content);

// Reload env
putenv("ASSEMBLYAI_API_KEY={$aaiKey}");
putenv("GEMINI_API_KEY={$gemKey}");

jsonResponse(['success'=>true]);
