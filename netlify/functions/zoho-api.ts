export default async (req: Request) => {
  const corsHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/zoho_tokens=([^;]+)/);

  if (!tokenMatch) {
    return Response.json({ error: 'not_authenticated' }, { status: 401, headers: corsHeaders });
  }

  let tokens: { access_token: string; refresh_token: string; expires_at: number };
  try {
    tokens = JSON.parse(atob(tokenMatch[1]));
  } catch {
    return Response.json({ error: 'invalid_token' }, { status: 401, headers: corsHeaders });
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
      return Response.json({ error: 'refresh_failed' }, { status: 401, headers: corsHeaders });
    }
  }

  const body = await req.json();
  const { endpoint, method = 'GET', data, api = 'crm' } = body;

  const baseUrls: Record<string, string> = {
    crm: 'https://www.zohoapis.eu/crm/v7',
    directory: 'https://directory.zoho.eu/api/v1/scim',
  };
  const baseUrl = baseUrls[api] || baseUrls.crm;

  const zohoResponse = await fetch(`${baseUrl}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  const result = await zohoResponse.json();

  const updatedEncoded = btoa(JSON.stringify(tokens));

  return new Response(JSON.stringify(result), {
    headers: {
      ...corsHeaders,
      'Set-Cookie': `zoho_tokens=${updatedEncoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
    },
  });
};
