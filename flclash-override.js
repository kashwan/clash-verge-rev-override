// FlClash 覆写脚本：防 DNS 泄露 + 国内外分流
// 对应 clash-verge-rev-override.yaml 的等价 JavaScript 版本
// 用法：工具 → 进阶配置 → 脚本 → 新建并粘贴；长按订阅 → 扩展 → 选中本脚本
// 注意：请清空「工具 → 进阶配置 → DNS」里已填的覆写字段（尤其 proxy-server-nameserver），
//       0.9.4 起这些字段会对每份配置生效，会覆盖脚本里的 DNS。

const PROXY = '🛰 自选节点';
const DIRECT_DNS = ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'];
const RULESET_BASE = 'https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo';

// [名称, behavior, 规则集路径]
const PROVIDERS = [
  ['private_domain', 'domain', 'geosite/private'],
  ['cn_domain', 'domain', 'geosite/cn'],
  ['ads_domain', 'domain', 'geosite/category-ads-all'],
  ['ai_domain', 'domain', 'geosite/category-ai-!cn'],
  ['youtube_domain', 'domain', 'geosite/youtube'],
  ['netflix_domain', 'domain', 'geosite/netflix'],
  ['tiktok_domain', 'domain', 'geosite/tiktok'],
  ['telegram_domain', 'domain', 'geosite/telegram'],
  ['private_ip', 'ipcidr', 'geoip/private'],
  ['cn_ip', 'ipcidr', 'geoip/cn'],
  ['telegram_ip', 'ipcidr', 'geoip/telegram'],
  ['netflix_ip', 'ipcidr', 'geoip/netflix'],
];

const main = (config) => {
  config.ipv6 = false;

  config.dns = {
    enable: true,
    'prefer-h3': false,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.0/16',
    'fake-ip-filter-mode': 'blacklist',
    'fake-ip-filter': [
      '+.lan',
      '+.local',
      '+.localhost',
      '+.home.arpa',
      'localhost.ptlogin2.qq.com',
      'time.*.com',
      'time.*.gov',
      'ntp.*.com',
      'pool.ntp.org',
      '+.push.apple.com',
      'mesu.apple.com',
      'swscan.apple.com',
      'captive.apple.com',
      'connectivitycheck.gstatic.com',
      'connectivitycheck.android.com',
      'www.msftconnecttest.com',
      'www.msftncsi.com',
      'rule-set:private_domain',
      'rule-set:cn_domain',
    ],
    'default-nameserver': ['223.5.5.5', '119.29.29.29'],
    'proxy-server-nameserver': [...DIRECT_DNS],
    'direct-nameserver': [...DIRECT_DNS],
    'nameserver-policy': {
      'rule-set:cn_domain,private_domain': [...DIRECT_DNS],
    },
    nameserver: [
      `https://8.8.8.8/dns-query#${PROXY}`,
      `https://1.1.1.1/dns-query#${PROXY}`,
    ],
  };

  config.sniffer = {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    sniff: {
      HTTP: { ports: [80, '8080-8880'] },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] },
    },
    'skip-domain': ['+.push.apple.com'],
  };

  const ruleProviders = {};
  for (const [name, behavior, path] of PROVIDERS) {
    ruleProviders[name] = {
      type: 'http',
      behavior,
      format: 'mrs',
      interval: 86400,
      proxy: PROXY,
      url: `${RULESET_BASE}/${path}.mrs`,
    };
  }
  config['rule-providers'] = ruleProviders;

  config['proxy-groups'] = [
    {
      name: '⚡ 自动选择',
      type: 'url-test',
      'include-all': true,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      timeout: 5000,
      tolerance: 50,
      lazy: true,
      'max-failed-times': 3,
      'expected-status': 204,
    },
    { name: PROXY, type: 'select', 'include-all': true, proxies: ['⚡ 自动选择', 'DIRECT'] },
    { name: '🤖 AI 分流', type: 'select', 'include-all': true, proxies: [PROXY] },
    { name: '🎬 流媒体', type: 'select', 'include-all': true, proxies: [PROXY] },
    { name: '📲 电报', type: 'select', 'include-all': true, proxies: [PROXY] },
    { name: '🛑 广告', type: 'select', proxies: ['REJECT', 'DIRECT'] },
  ];

  config.rules = [
    'RULE-SET,private_domain,DIRECT',
    'RULE-SET,private_ip,DIRECT,no-resolve',
    'RULE-SET,ads_domain,🛑 广告',
    'RULE-SET,ai_domain,🤖 AI 分流',
    'RULE-SET,youtube_domain,🎬 流媒体',
    'RULE-SET,netflix_domain,🎬 流媒体',
    'RULE-SET,tiktok_domain,🎬 流媒体',
    'RULE-SET,telegram_domain,📲 电报',
    'RULE-SET,telegram_ip,📲 电报,no-resolve',
    'RULE-SET,netflix_ip,🎬 流媒体,no-resolve',
    'RULE-SET,cn_domain,DIRECT',
    'RULE-SET,cn_ip,DIRECT,no-resolve',
    `MATCH,${PROXY}`,
  ];

  // 自检：脚本被改坏时直接报错，避免生成不完整的配置
  if (config.rules[config.rules.length - 1] !== `MATCH,${PROXY}`) {
    throw new Error('rules must end with MATCH');
  }
  if (!config['proxy-groups'].some((group) => group.name === PROXY)) {
    throw new Error(`missing proxy group: ${PROXY}`);
  }
  if (Object.keys(config['rule-providers']).length !== PROVIDERS.length) {
    throw new Error('rule providers incomplete');
  }

  return config;
};
