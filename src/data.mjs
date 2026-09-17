// 数据源文件 —— 内容忠实提取自原 index.html（小吴乐意个人主页）
// 分类标签映射：tools=工具, bitcoin=比特币, life=生活
// 注：应用户要求，已移除"比特币无知者名录'画展'"卡片

export const categoryLabel = {
    tools: '工具',
    bitcoin: '比特币',
    life: '生活',
};

export const profile = {
    name: '小吴乐意',
    title: 'H.A.B｜哈勃未来 创始人',
    quote: '"未来的种子，深埋在过去。"',
    bookUrl: 'https://hold.btchao.com',
    coffeeUrl: 'https://mp.weixin.qq.com/s/SlLGT7MBUR7BOKK-6fnEsw',
    bitcoinAddress: '3KLy733p6vQDyaKdEY61iGdQPf9pYt9hPv',
    siteUrl: 'https://www.xiaowuleyi.com/',
    description: '小吴乐意，哈勃未来创始人，比特币爱好者（100%全仓HODLer）。关注 Health、AI、Bitcoin，出品电子书《慢者生存》。',
    bitcoinCreed: '100% 全仓，且唯一只持有比特币',
    motto: '永远年轻，永远热泪盈眶。',};

export const socials = [
    {
        id: 'blog',
        name: '个人博客',
        description: '同步公众号+部分敏感内容',
        url: 'https://blog.xiaowuleyi.com/',
        icon: '/public/wordpress.svg',
    },
    {
        id: 'wechat',
        name: '公众号：小吴乐意',
        description: '比特币，AI，健康，生活闲聊，日更中',
        url: null,
        icon: '/public/wechat.svg',
    },
    {
        id: 'twitter',
        name: 'Twitter(X)',
        description: '自由世界，自由言论',
        url: 'https://x.com/xiaowuleyi',
        icon: '/public/twitter.svg',
    },
    {
        id: 'youtube',
        name: 'YouTube',
        description: '偶尔放飞自我',
        url: 'https://www.youtube.com/@xiaowuleyi',
        icon: '/public/youtube.svg',
    },
    {
        id: 'bitcoin-read',
        name: '比特币必读',
        description: '了解比特币的最佳平台',
        url: 'https://btchao.com',
        icon: '/public/bitcoin.svg',
    },
    {
        id: 'bilibili',
        name: '哔哩哔哩',
        description: '传说中的"B"站',
        url: 'https://space.bilibili.com/68332732',
        icon: '/public/bilibili.svg',
    },
];

export const projects = [
    {
        id: 'litepic',
        name: '轻图 LitePic',
        description: '浏览器本地图片压缩，零上传零存储，体积直降 60%–90%',
        url: 'https://litepic.xiaowuleyi.com',
        tags: ['图片压缩', '隐私', '工具'],
        category: 'tools',
        mark: 'LP',
    },
    {
        id: 'fitlab',
        name: 'FitLab 健身视频库',
        description: '走步机、游泳、力量训练教学视频，手机上练对每个动作',
        url: 'https://fit.xiaowuleyi.com',
        tags: ['健身', '视频', '健康'],
        category: 'life',
        mark: 'FIT',
    },
    {
        id: 'weibo',
        name: '小吴乐意个人微博',
        description: '关于我人生的一些碎碎念，留念亦纪念',
        url: 'https://wb.xiaowuleyi.com',
        tags: ['微博', '社交', '生活'],
        category: 'life',
        mark: '微博',
    },
    {
        id: 'password',
        name: '随机密码在线生成',
        description: '个人安全工具',
        url: 'https://pd.btchao.com',
        tags: ['随机', '密码', '安全'],
        category: 'tools',
        mark: '***',
    },
    {
        id: 'bitcoin-memorial',
        name: '比特币纪念站',
        description: '致敬中本聪，永存创世区块',
        url: 'https://1a1zp1ep5qgefi2dmptftl5slmv7divfna.com',
        tags: ['比特币', '历史'],
        category: 'bitcoin',
        mark: '₿',
    },
    {
        id: 'btc-chart',
        name: '比特币30D-700D价格均线',
        description: '比特币长期均线分析工具',
        url: 'https://btcma.xiaowuleyi.com',
        tags: ['比特币', '均线', '分析'],
        category: 'bitcoin',
        mark: '📈',
    },
    {
        id: 'favorites',
        name: '好物分享',
        description: '我的装备与心爱之物分享',
        url: 'https://list.xiaowuleyi.com',
        tags: ['装备', '好物', '分享'],
        category: 'life',
        mark: '★',
    },
];
