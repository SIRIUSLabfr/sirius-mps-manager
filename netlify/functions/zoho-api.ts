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

  const updatedEncoded = btoa(JSON.stringify(tokens));
  const cookieHeaderOut = `zoho_tokens=${updatedEncoded}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;

  const baseUrls: Record<string, string> = {
    crm: 'https://www.zohoapis.eu/crm/v7',
    directory: 'https://directory.zoho.eu/api/v1/scim',
  };

  // Detect content type to support multipart uploads (attachments) and PDF downloads
  const contentType = req.headers.get('content-type') || '';

  // === MULTIPART UPLOAD (attachments) ===
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const endpoint = formData.get('endpoint') as string;
    const api = (formData.get('api') as string) || 'crm';
    const baseUrl = baseUrls[api] || baseUrls.crm;

    // Build a new FormData containing only the file(s)
    const uploadForm = new FormData();
    for (const [key, value] of formData.entries()) {
      if (key === 'endpoint' || key === 'api' || key === 'method') continue;
      uploadForm.append(key, value as any);
    }

    const zohoResponse = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
      },
      body: uploadForm,
    });
    const result = await zohoResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Set-Cookie': cookieHeaderOut },
    });
  }

  // === JSON / PDF DOWNLOAD ===
  const body = await req.json();
  const { endpoint, method = 'GET', data, api = 'crm', responseType } = body;
  const baseUrl = baseUrls[api] || baseUrls.crm;

  const zohoResponse = await fetch(`${baseUrl}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  // Binary response (PDF)
  if (responseType === 'binary') {
    const buf = await zohoResponse.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return new Response(JSON.stringify({
      __binary: true,
      base64: b64,
      contentType: zohoResponse.headers.get('content-type') || 'application/pdf',
      status: zohoResponse.status,
    }), {
      headers: { ...corsHeaders, 'Set-Cookie': cookieHeaderOut },
    });
  }

  const result = await zohoResponse.json();
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Set-Cookie': cookieHeaderOut },
  });
};
