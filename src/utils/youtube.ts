const VIDEO_ID = /^[\w-]{11}$/;

/** Extracts the video id from a YouTube link (watch, youtu.be, shorts, embed, live); "" when it is not one. */
export function youtubeId(link: string): string {
  try {
    const url = new URL(link.trim());
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? "";
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const fromPath = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
      id = fromPath?.[1] ?? url.searchParams.get("v") ?? "";
    }
    return VIDEO_ID.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function youtubeLink(id: string, short = false): string {
  return short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}
