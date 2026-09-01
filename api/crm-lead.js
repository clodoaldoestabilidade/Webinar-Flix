module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CRM_URL = process.env.CRM_API_URL || 'https://crm.acesso.vip/api/leads';
  const CRM_TOKEN = process.env.CRM_API_TOKEN || '';
  const CRM_CUSTOMER_ID = process.env.CRM_CUSTOMER_ID || '';

  try {
    const { name, email, phone, whatsapp, source, pipeline, page_url, captured_at } = req.body;

    if (!email) return res.status(400).json({ error: 'email required' });

    const leadData = {
      name: name || '',
      email: email,
      phone: phone || '',
      whatsapp: whatsapp || '',
      source: source || 'landing-destrave',
      pipeline: pipeline || 'Prospecção LowTicket',
      page_url: page_url || '',
      captured_at: captured_at || new Date().toISOString(),
    };

    const headers = { 'Content-Type': 'application/json' };

    if (CRM_TOKEN) headers['Authorization'] = `Bearer ${CRM_TOKEN}`;
    if (CRM_CUSTOMER_ID) headers['X-Customer-Id'] = CRM_CUSTOMER_ID;

    const response = await fetch(CRM_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(leadData),
    });

    const contentType = response.headers.get('content-type') || '';
    let result;
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = { text: await response.text() };
    }

    if (!response.ok) {
      console.error('CRM error:', response.status, JSON.stringify(result));
      return res.status(502).json({ error: 'CRM error', status: response.status, detail: result });
    }

    return res.status(200).json({ success: true, crm_response: result });
  } catch (err) {
    console.error('CRM handler error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
