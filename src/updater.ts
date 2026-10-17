export const APP_VERSION = '2.3.1';

const LATEST_RELEASE_URL = 'https://api.github.com/repos/minova-chromium/MauGainz/releases/latest';

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  content_type?: string;
};

type GitHubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubReleaseAsset[];
};

export type AppUpdate = {
  version: string;
  title: string;
  notes: string;
  downloadUrl: string;
  releaseUrl: string;
  publishedAt?: string;
};

const versionParts = (version: string) => version
  .trim()
  .replace(/^v/i, '')
  .split(/[.+-]/)
  .slice(0, 3)
  .map((part) => Number.parseInt(part, 10) || 0);

export const isNewerVersion = (candidate: string, installed = APP_VERSION) => {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  for (let index = 0; index < 3; index += 1) {
    if ((next[index] ?? 0) > (current[index] ?? 0)) return true;
    if ((next[index] ?? 0) < (current[index] ?? 0)) return false;
  }
  return false;
};

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal: controller.signal
    });
    if (!response.ok) return null;

    const release = await response.json() as GitHubRelease;
    if (release.draft || release.prerelease || !release.tag_name || !release.html_url || !isNewerVersion(release.tag_name)) return null;

    const apkAssets = (release.assets ?? []).filter((asset) => asset.name?.toLowerCase().endsWith('.apk') && asset.browser_download_url);
    const preferredAsset = apkAssets.find((asset) => asset.name?.toLowerCase().includes('universal')) ?? apkAssets[0];

    return {
      version: release.tag_name.replace(/^v/i, ''),
      title: release.name?.trim() || `MauGainZ ${release.tag_name}`,
      notes: release.body?.trim() || '',
      downloadUrl: preferredAsset?.browser_download_url ?? release.html_url,
      releaseUrl: release.html_url,
      publishedAt: release.published_at
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
