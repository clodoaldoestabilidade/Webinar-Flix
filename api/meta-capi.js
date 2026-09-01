const crypto = require('crypto');

const PIXEL_ID = '1313505902379038';
const GRAPH_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Token not configured' });

  try {
    const { event_name, event_id, email, phone, name, value, currency, source_url, fbp, fbc } = req.body;

    if (!event_name) return res.status(400).json({ error: 'event_name required' });

    const userData = {};
    if (email) userData.em = [sha256(email)];
    if (phone) userData.ph = [sha256(phone.replace(/\D/g, ''))];
    if (name) {
      const parts = name.trim().split(/\s+/);
      userData.fn = [sha256(parts[0])];
      if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
    }
    userData.country = [sha256('br')];
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress;
    if (clientIp) userData.client_ip_address = clientIp.split(',')[0].trim();
    if (req.headers['user-agent']) userData.client_user_agent = req.headers['user-agent'];

    const eventData = {
      event_name: event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: source_url || undefined,
      event_id: event_id || undefined,
      user_data: userData,
    };

    if (value && currency) {
      eventData.custom_data = { value: parseFloat(value), currency: currency };
    }

    const response = await fetch(`${GRAPH_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [eventData] }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI error:', JSON.stringify(result));
      return res.status(502).json({ error: 'Meta API error', detail: result });
    }

    return res.status(200).json({ success: true, events_received: result.events_received });
  } catch (err) {
    console.error('CAPI handler error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
