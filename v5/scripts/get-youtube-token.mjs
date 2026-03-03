/**
 * YouTube OAuth2 Token Getter (manual code flow)
 *
 * Usage:
 *   node scripts/get-youtube-token.mjs
 *
 * Flow:
 *   1. Prints authorization URL
 *   2. User opens URL in browser and authorizes
 *   3. Browser redirects to http://localhost:8080?code=... (connection refused is OK)
 *   4. User copies the full URL from the browser address bar and pastes it here
 *   5. Script extracts the code and exchanges it for tokens
 */

import readline from 'readline';

// Set these via environment variables before running:
//   export YOUTUBE_CLIENT_ID=<your client id>
//   export YOUTUBE_CLIENT_SECRET=<your client secret>
const CLIENT_ID = process.env['YOUTUBE_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['YOUTUBE_CLIENT_SECRET'] ?? '';
const REDIRECT_URI = 'http://localhost:8080';

const SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
].join(' ');

// Build authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n=== YouTube OAuth2 Token Getter ===\n');
console.log('【Step 1】以下のURLをブラウザで開いてください:\n');
console.log(authUrl.toString());
console.log('\n【Step 2】YouTubeチャンネルのGoogleアカウントでログインして「許可」をクリック');
console.log('\n【Step 3】ブラウザが http://localhost:8080 に転送されて「接続できません」と表示される');
console.log('         → それで正常です。アドレスバーのURLをそのままコピーしてください');
console.log('         → 例: http://localhost:8080/?code=4/0AXxxxx...&scope=...\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('【Step 4】コピーしたURLをここに貼り付けてEnter: ', async (input) => {
  rl.close();

  // Extract code from pasted URL or raw code
  let code;
  try {
    const pasted = input.trim();
    if (pasted.startsWith('http')) {
      const url = new URL(pasted);
      code = url.searchParams.get('code');
    } else {
      code = pasted; // assume raw code was pasted
    }
  } catch {
    console.error('\nエラー: URLの解析に失敗しました。URLをそのまま貼り付けてください。');
    process.exit(1);
  }

  if (!code) {
    console.error('\nエラー: URLにcodeパラメータが見つかりません。');
    process.exit(1);
  }

  console.log('\nコードを取得しました。トークンと交換中...');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`トークン交換失敗 (${tokenResponse.status}): ${body}`);
    }

    const tokens = await tokenResponse.json();

    console.log('\n=== 取得完了 ===\n');
    console.log('refresh_token:', tokens.refresh_token ?? '(なし — もう一度実行してください)');
    console.log('access_token: ', tokens.access_token);
    console.log('expires_in:   ', tokens.expires_in, '秒');

    if (!tokens.refresh_token) {
      console.log('\n⚠️  refresh_tokenが取得できませんでした。');
      console.log('   スクリプトを再度実行するか、以下のURLでアプリのアクセスを一度削除してから再実行:');
      console.log('   https://myaccount.google.com/permissions');
      process.exit(1);
    }

    console.log('\n=== DBへの保存用SQL ===');
    console.log('以下のSQLを実行してアカウントを登録してください。');
    console.log('(account_id と channel_id は実際の値に変更してください)\n');
    console.log(`INSERT INTO accounts (account_id, platform, status, auth_credentials, created_at, updated_at)
VALUES (
  'ACC_YT_001',
  'youtube',
  'active',
  '{
    "oauth": {
      "refresh_token": "${tokens.refresh_token}",
      "access_token":  "${tokens.access_token}",
      "expires_at":    "${new Date(Date.now() + tokens.expires_in * 1000).toISOString()}"
    },
    "channel_id": "YOUR_CHANNEL_ID"
  }'::jsonb,
  NOW(),
  NOW()
);`);

  } catch (err) {
    console.error('\nエラー:', err.message);
    process.exit(1);
  }
});
