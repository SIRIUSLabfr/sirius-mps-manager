export default async (req: Request) => {
  const corsHeaders: Record<string, string> = {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400',
  };

  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/zoho_tokens=([^;]+)/);

  if (!tokenMatch) {
    return new Response(null, { status: 401 });
  }

  let tokens: { access_token: string; refresh_token: string; expires_at: number };
  try {
    tokens = JSON.parse(atob(tokenMatch[1]));
  } catch {
    return new Response(null, { status: 401 });
  }

  // Refresh if expired
  if (Date.now() >= tokens.expires_at) {
    const refreshResponse = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        refresh_token: tokens.refresh_token,
      }),
    });
    const newTokens = await refreshResponse.json();
    if (newTokens.access_token) {
      tokens.access_token = newTokens.access_token;
      tokens.expires_at = Date.now() + newTokens.expires_in * 1000;
    } else {
      return new Response(null, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return new Response(null, { status: 400 });
  }

  const zohoResponse = await fetch(`https://www.zohoapis.eu/crm/v7/users/${userId}/photo`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
    },
  });

  if (!zohoResponse.ok) {
    return new Response(null, { status: zohoResponse.status });
  }

  const imageBuffer = await zohoResponse.arrayBuffer();
  const contentType = zohoResponse.headers.get('content-type') || 'image/jpeg';

  return new Response(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
