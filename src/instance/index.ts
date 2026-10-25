import { getCreatorByHandle } from '../db';
import { handleMediaRequest, type MediaDeliveryEnv } from '../media';
import { buildOutbox, listPublicPosts } from '../posts';
import { buildActor, buildWebfinger, isValidHandle, parseWebfingerResource } from './activitypub';

/** DB, MEDIA und die Schlüsselnamen (MEDIA_WRAP_KEY, SUBSCRIPTION_TOKEN_KEY) kommen aus den Bindings bzw. Secrets; Werte stehen nie in wrangler.toml. */
export interface Env extends MediaDeliveryEnv {
  INSTANCE_DOMAIN: string;
}

const AP_JSON = 'application/activity+json';

function json(body: unknown, contentType = 'application/json', status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': `${contentType}; charset=utf-8` },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const domain = env.INSTANCE_DOMAIN;

    if (url.pathname === '/health') return json({ ok: true });

    if (url.pathname === '/.well-known/webfinger') {
      const handle = parseWebfingerResource(url.searchParams.get('resource'), domain);
      if (!handle || !(await getCreatorByHandle(env.DB, handle))) {
        return json({ error: 'NOT_FOUND' }, 'application/json', 404);
      }
      return json(buildWebfinger(domain, handle), 'application/jrd+json');
    }

    const outbox = /^\/users\/([^/]+)\/outbox$/.exec(url.pathname);
    if (outbox?.[1] && isValidHandle(outbox[1])) {
      const creator = await getCreatorByHandle(env.DB, outbox[1]);
      if (!creator) return json({ error: 'NOT_FOUND' }, 'application/json', 404);
      return json(buildOutbox(domain, creator.handle, await listPublicPosts(env.DB, creator.id)), AP_JSON);
    }

    if (url.pathname.startsWith('/media/')) return handleMediaRequest(request, env);

    const actor = /^\/users\/([^/]+)$/.exec(url.pathname);
    if (actor?.[1] && isValidHandle(actor[1])) {
      const creator = await getCreatorByHandle(env.DB, actor[1]);
      if (!creator) return json({ error: 'NOT_FOUND' }, 'application/json', 404);
      return json(
        buildActor(domain, { handle: creator.handle, displayName: creator.anzeigename, summary: creator.beschreibung }),
        AP_JSON,
      );
    }

    return json({ error: 'NOT_FOUND' }, 'application/json', 404);
  },
} satisfies ExportedHandler<Env>;
