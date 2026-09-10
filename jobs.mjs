// Saved Jobs backend for SHVpro.
// Storage: Netlify Blobs (zero-config, no separate database to provision).
// Exposed at /api/jobs via the `config.path` export below.
//
// Frontend contract (from index.html):
//   GET    /api/jobs            -> [{ id, name, savedAt }, ...]   (list, newest first handled client-side)
//   GET    /api/jobs?id=<id>    -> full job payload (whatever was POSTed, plus id/savedAt)
//   POST   /api/jobs            -> body is the job payload (may include an existing `id` to update); returns { id }
//   DELETE /api/jobs?id=<id>    -> { deleted: true }

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'shvpro-jobs';
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    if (req.method === 'GET') {
      if (id) {
        const job = await store.get(id, { type: 'json' });
        if (!job) return json({ error: 'Job not found' }, 404);
        return json(job);
      }

      // List mode: summarise every stored job for the picker
      const { blobs } = await store.list();
      const jobs = await Promise.all(
        blobs.map(async (b) => {
          const job = await store.get(b.key, { type: 'json' });
          return {
            id: b.key,
            name: (job && job.jobName) || 'Untitled job',
            savedAt: (job && job.savedAt) || null,
          };
        })
      );
      return json(jobs);
    }

    if (req.method === 'POST') {
      let payload;
      try {
        payload = await req.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      const jobId = payload.id || crypto.randomUUID();
      payload.id = jobId;
      payload.savedAt = new Date().toISOString();
      await store.setJSON(jobId, payload);
      return json({ id: jobId });
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'Missing id' }, 400);
      await store.delete(id);
      return json({ deleted: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err && err.message ? err.message : 'Server error' }, 500);
  }
};

export const config = { path: '/api/jobs' };
