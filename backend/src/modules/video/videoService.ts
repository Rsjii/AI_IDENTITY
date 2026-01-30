import { uploadPublicBuffer } from '../../services/s3Service';

export async function uploadSampleVideo(buffer: Buffer, mimeType: string, filename?: string) {
  const ext = filename?.split('.').pop() || 'mp4';
  return uploadPublicBuffer({
    keyPrefix: 'video-samples',
    contentType: mimeType || 'video/mp4',
    body: buffer,
    ext,
  });
}

export async function createVideoAvatarExternal(sampleUrl: string): Promise<{ avatarId: string }> {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) {
    return { avatarId: '' };
  }

  const res = await fetch('https://api.d-id.com/clerks/avatars', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: sampleUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D-ID create avatar failed: ${res.status} ${text}`);
  }

  const data: any = await res.json();
  return { avatarId: data.id || '' };
}

export async function generateVideoFromText(avatarId: string, text: string): Promise<{ videoUrl: string }> {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) {
    throw new Error('DID_API_KEY not configured');
  }

  const res = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: avatarId,
      script: {
        type: 'text',
        input: text,
      },
    }),
  });

  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`D-ID generate video failed: ${res.status} ${textBody}`);
  }

  const data: any = await res.json();
  return { videoUrl: data?.result_url || '' };
}

