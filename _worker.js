// 陽光富利 獲客系統 Worker
// 功能：Serve 登陸頁 + UTM 追蹤 + API

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API: 追蹤事件
    if (url.pathname === '/api/track') {
      if (request.method === 'POST') {
        try {
          const data = await request.json();
          
          // 記錄到 KV
          const trackKey = `track:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
          await env.SUN_TRACK.put(trackKey, JSON.stringify({
            ...data,
            ip: request.headers.get('CF-Connecting-IP'),
            country: request.headers.get('CF-IPCountry'),
            timestamp: new Date().toISOString()
          }), {
            expirationTtl: 86400 * 30 // 30 天
          });

          // 更新計數器
          const counterKey = `counter:${data.event}:${data.source}:${data.medium}`;
          const currentCount = await env.SUN_TRACK.get(counterKey);
          const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
          await env.SUN_TRACK.put(counterKey, newCount.toString());

          return new Response(JSON.stringify({ success: true, id: trackKey }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
      
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // API: 統計數據
    if (url.pathname === '/api/stats') {
      try {
        // 獲取所有計數器
        const counters = await env.SUN_TRACK.list({ prefix: 'counter:' });
        const stats = {};
        
        for (const key of counters.keys) {
          const parts = key.name.replace('counter:', '').split(':');
          const event = parts[0];
          const source = parts[1];
          const medium = parts[2];
          const count = await env.SUN_TRACK.get(key.name);
          
          stats[`${event}|${source}|${medium}`] = parseInt(count || 0);
        }

        return new Response(JSON.stringify({
          success: true,
          stats: stats,
          total: Object.values(stats).reduce((a, b) => a + b, 0)
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 預設：serve 登陸頁
    try {
      const html = await fetch('https://raw.githubusercontent.com/hm88968/sun-growth-engine/main/landing.html');
      return new Response(html.body, {
        headers: { 
          'Content-Type': 'text/html;charset=UTF-8',
          ...corsHeaders 
        }
      });
    } catch (err) {
      return new Response('Error loading page', { status: 500 });
    }
  }
};
