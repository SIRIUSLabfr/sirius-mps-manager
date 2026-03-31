export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Kein Authorization Code erhalten', { status: 400 });
  }

  const tokenResponse = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      redirect_uri: process.env.ZOHO_REDIRECT_URI!,
      code,
    }),
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    return new Response(`Zoho Token Fehler: ${tokens.error}`, { status: 400 });
  }

  const tokenData = JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  const encoded = btoa(tokenData);

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': `zoho_tokens=${encoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
    },
  });
};
