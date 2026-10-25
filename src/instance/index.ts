import { getCreatorByHandle, type DbEnv } from '../db';
import { buildActor, buildWebfinger, isValidHandle, parseWebfingerResource } from './activitypub';

export interface Env extends DbEnv {
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
