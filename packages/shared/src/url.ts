export function joinApiUrl(baseUrl: string, path: string) {
  if (/^https?:\/\/[^/]+\/?$/.test(baseUrl) && path.startsWith("?")) return `${baseUrl.replace(/\/$/, "")}${path}`;
  if (baseUrl.includes("?")) return baseUrl;

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
