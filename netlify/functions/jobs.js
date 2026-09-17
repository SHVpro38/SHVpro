const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'shvpro-jobs';

exports.handler = async (event) => {
  const store = getStore({ name: STORE_NAME, siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  const jobId = event.queryStringParameters && event.queryStringParameters.id;
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers };
    }

    if (event.httpMethod === 'GET' && !jobId) {
      const { blobs } = await store.list();
      const jobs = await Promise.all(
        blobs.map(async (b) => {
          const data = await store.get(b.key, { type: 'json' });
          return { id: b.key, name: (data && data.jobName) || b.key, savedAt: (data && data.savedAt) || null };
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
      await store.set(id, JSON.stringify(body), { metadata: { jobName: body.jobName || id, savedAt: body.savedAt } });
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
