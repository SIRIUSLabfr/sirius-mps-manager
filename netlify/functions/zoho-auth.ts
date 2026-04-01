export default async (req: Request) => {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  const scope = 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.users.READ,ZohoDirectory.user.READ';

  const authUrl =
    `https://accounts.zoho.eu/oauth/v2/auth?` +
    `scope=${scope}` +
    `&client_id=${clientId}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
    `&prompt=consent`;

  return Response.redirect(authUrl, 302);
};
