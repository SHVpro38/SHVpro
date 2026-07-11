// netlify/functions/jobs.js
//
// Backend for the SHVpro "Saved Jobs" feature. Uses Netlify Blobs — Netlify's built-in
// storage that requires no API key, no separate account, and no billing setup. It's
// automatically available to any function deployed on Netlify.
//
// Deployment: place this file at netlify/functions/jobs.js in your site's repo (same repo
// the HTML deploys from). No further configuration is needed — Netlify detects functions in
// that folder automatically. The app calls this at /api/jobs (see the redirect below).
//
// Endpoints:
//   GET    /api/jobs          -> list of { id, name, savedAt } for every saved job
//   GET    /api/jobs?id=XYZ   -> full saved payload for one job
//   POST   /api/jobs          -> body is the job payload (with optional "id" to update an
//                                 existing job); creates a new job if no id is given.
//                                 Returns { id }.
//   DELETE /api/jobs?id=XYZ   -> deletes one job

const { connectLambda, getStore } = require('@netlify/blobs');

const STORE_NAME = 'shvpro-jobs';

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore(STORE_NAME);
  const jobId = event.queryStringParameters && event.queryStringParameters.id;

  const headers = { 'Content-Type': 'application/json' };

  try {
    if (event.httpMethod === 'GET' && !jobId) {
      // List all jobs — return lightweight metadata only, not the full payload.
      const { blobs } = await store.list();
      const jobs = await Promise.all(
        blobs.map(async (b) => {
          const data = await store.get(b.key, { type: 'json' });
          return {
            id: b.key,
            name: (data && data.jobName) || b.key,
            savedAt: (data && data.savedAt) || null
          };
        })
      );
      return { statusCode: 200, headers, body: JSON.stringify(jobs) };
    }

    if (event.httpMethod === 'GET' && jobId) {
      const data = await store.get(jobId, { type: 'json' });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = body.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      body.id = id;
      body.savedAt = new Date().toISOString();
      await store.setJSON(id, body);
      return { statusCode: 200, headers, body: JSON.stringify({ id }) };
    }

    if (event.httpMethod === 'DELETE' && jobId) {
      await store.delete(jobId);
      return { statusCode: 204, headers, body: '' };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
