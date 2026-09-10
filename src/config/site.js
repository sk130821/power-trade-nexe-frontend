const DEFAULT_SITE_URL = 'https://front.powertradenexus.com';

export function getSiteOrigin() {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return DEFAULT_SITE_URL;
}

export function referralRegisterUrl(referralCode) {
  if (!referralCode) return '';
  return `${getSiteOrigin()}/register?ref=${encodeURIComponent(referralCode)}`;
}
