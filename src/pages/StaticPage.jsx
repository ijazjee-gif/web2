import { useEffect } from 'react';

export default function StaticPage({ html, pageKey }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    const t = setTimeout(() => window.VixtreetRefresh?.(), 60);
    if (pageKey === 'live') loadTradingView();
    return () => clearTimeout(t);
  }, [pageKey, html]);

  return <main dangerouslySetInnerHTML={{ __html: html || '' }} />;
}

function loadTradingView() {
  setTimeout(() => {
    const container = document.getElementById('tradingview_chart');
    if (!container || container.dataset.loaded === '1') return;
    container.dataset.loaded = '1';
    const create = () => {
      if (!window.TradingView || !document.getElementById('tradingview_chart')) return;
      new window.TradingView.widget({
        autosize: true,
        symbol: 'OANDA:XAUUSD',
        interval: '60',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0b101a',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        container_id: 'tradingview_chart'
      });
    };
    if (window.TradingView) return create();
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = create;
    document.body.appendChild(script);
  }, 100);
}
