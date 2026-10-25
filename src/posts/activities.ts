/**
 * Reine Builder für Create/Note-Activity und Outbox. Nur Beiträge mit
 * sichtbarkeit='public' werden je serialisiert; paid wird verworfen bzw. wirft.
 * Medien und R2-Schlüssel kommen hier nicht vor.
 */
import { actorUrl } from '../instance/activitypub';
import type { Post } from './posts';

const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
const CONTEXT = 'https://www.w3.org/ns/activitystreams';

export function noteUrl(domain: string, handle: string, postId: string): string {
  return `${actorUrl(domain, handle)}/posts/${postId}`;
}

function assertPublic(post: Post): void {
  if (post.sichtbarkeit !== 'public') {
    throw new Error('Nur öffentliche Beiträge dürfen föderiert werden');
  }
}

export function buildNote(domain: string, handle: string, post: Post) {
  assertPublic(post);
  return {
    id: noteUrl(domain, handle, post.id),
    type: 'Note',
    attributedTo: actorUrl(domain, handle),
    ...(post.titel ? { name: post.titel } : {}),
    content: post.inhalt,
    published: post.veroeffentlicht_am,
    to: [PUBLIC],
  };
}

function buildActivityBody(domain: string, handle: string, post: Post) {
  const note = buildNote(domain, handle, post);
  return {
    id: `${note.id}/activity`,
    type: 'Create',
    actor: actorUrl(domain, handle),
    published: note.published,
    to: note.to,
    object: note,
  };
}

export function buildCreateActivity(domain: string, handle: string, post: Post) {
  return { '@context': CONTEXT, ...buildActivityBody(domain, handle, post) };
}

export function buildOutbox(domain: string, handle: string, posts: Post[]) {
  const items = posts.filter((p) => p.sichtbarkeit === 'public');
  return {
    '@context': CONTEXT,
    id: `${actorUrl(domain, handle)}/outbox`,
    type: 'OrderedCollection',
    totalItems: items.length,
    orderedItems: items.map((p) => buildActivityBody(domain, handle, p)),
  };
}
