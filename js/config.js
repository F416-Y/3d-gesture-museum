/* ============================================================
 * config.js —— 全局配置 + 展品数据（美术鉴赏文案）
 * 归属：组员4（展品系统工程师）维护；全体模块共用
 * ------------------------------------------------------------
 * 全局命名空间：window.MuseumConfig
 * 分工约定：
 *   - 展品数据（鉴赏文案）在此集中维护，新增/修改展品只改本文件
 *   - 场景坐标由 scene.js 决定，本文件只描述展品属性
 * ============================================================ */

window.MuseumConfig = {
  /* ---------- 项目信息 ---------- */
  project: {
    name: "云墨美术馆",
    nameEn: "CloudInk Art Museum",
    version: "v0.1.0 团队骨架版",
    subject: "美术鉴赏 × 软件工程 跨专业课程设计",
  },

  /* ---------- 展厅信息（scene.js 读取，切换展厅时展示） ---------- */
    halls: [
    { id: "plaza",     name: "前庭" },
    { id: "hall0",     name: "序厅" },
    { id: "courtyard", name: "庭院" },
    { id: "hall1",     name: "山水" },
    { id: "hall2",     name: "花鸟" },
    { id: "hall3",     name: "人物" },
    { id: "hall4",     name: "书斋" },
    { id: "hall5",     name: "文创" },
  ],

  /* ---------- 漫游参数（player.js 读取） ---------- */
  player: {
    eyeHeight: 1.7,        // 视点高度（米）
    radius: 0.5,           // 碰撞体半径
    speed: 2.4,            // 前进速度（米/秒）
    turnSpeed: 1.9,        // 转向速度（弧度/秒）
        startPos: [0, 0, 38],  // 出生点（前庭中轴，位于 hall0 序厅之外，避免出生即判「序厅」）
  },

  /* ---------- 手势参数（gesture.js 读取，组员3 可按需调优） ---------- */
  gesture: {
    forwardOpen: 0.62,     // 判定「张开」：5 指归一化距离均大于该值
    fistClose: 0.30,       // 判定「握拳」：5 指归一化距离均小于该值
    pinchDist: 0.055,      // 捏合：拇指尖与食指尖归一化距离小于该值
    turnDead: 0.18,        // 转向死区：食指横向偏移小于该值视为不转
    turnMax: 0.42,         // 转向满速偏移
    smooth: 0.12,          // 手势状态平滑系数（0-1，越小越平滑）
    camWidth: 320,         // 摄像头识别宽度（小尺寸提帧率）
    camHeight: 240,
  },

  /* ---------- 展品数据 ----------
   * type: painting 绘画（Canvas 程序化贴图，组员6 可替换为真实名画图）
   *       sculpture 雕塑 / artifact 器物（几何体或 glb 模型，组员6 可替换）
   * hall: 展馆 id，对应上方 halls
   * ============================================================ */
  exhibits: [
    {
      id: "qianlijiangshan", type: "painting", hall: "hall1",
      title: "千里江山图",
      artist: "王希孟", dynasty: "北宋", era: "约 1113 年",
      medium: "绢本设色 · 纵 51.5cm × 横 1191.5cm",
      collection: "故宫博物院",
      intro: "北宋天才画家王希孟的传世孤本，据说他创作此卷时年仅十八岁，由宋徽宗亲授画艺。全卷以青绿设色描绘绵延千里的锦绣江山，峰峦起伏、江湖浩渺，是青绿山水画史上的里程碑。",
      appreciation: "此画最动人之处在于「十八岁的野心」：千里江山被压缩进一卷之内，却毫无局促之感。青绿重彩在石青、石绿的层层罩染下既浓烈又清透。",
    },
    {
      id: "fuchunshanjv", type: "painting", hall: "hall1",
      title: "富春山居图",
      artist: "黄公望", dynasty: "元代", era: "1350 年",
      medium: "纸本水墨 · 纵 33cm × 横 636.9cm（无用师卷）",
      collection: "浙江省博物馆（剩山图）· 台北故宫博物院（无用师卷）",
      intro: "元代文人画宗师黄公望晚年为无用师所绘，以水墨写富春江两岸秋景，历时数年。画成后辗转流传，险些被焚毁殉葬，如今一分为二、隔海相望。",
      appreciation: "此卷是「文人画」精神的完美化身：不重形似而重笔意，山石以长披麻皴写出，墨色枯润相间，疏密有致。",
    },
    {
      id: "xishanxinglvtu", type: "painting", hall: "hall1",
      title: "溪山行旅图",
      artist: "范宽", dynasty: "北宋", era: "约 11 世纪初",
      medium: "绢本水墨 · 纵 206.3cm × 横 103.3cm",
      collection: "台北故宫博物院",
      intro: "北宋山水画家范宽代表作，以巨碑式构图表现关陕一带雄伟山势。主峰巍然居中，飞瀑一线，山脚商旅驮队点出「行旅」之意。",
      appreciation: "范宽以「雨点皴」堆积出岩石的浑厚体量，山顶密林如冠，山脚雾气蒸腾。画面以高远法把观者的视线引向主峰，是北宋全景山水的典范。",
    },
    {
      id: "xieshengzhenqintu", type: "painting", hall: "hall2",
      title: "写生珍禽图",
      artist: "黄筌", dynasty: "五代", era: "约 10 世纪",
      medium: "绢本设色 · 纵 41.5cm × 横 70.8cm",
      collection: "故宫博物院",
      intro: "五代西蜀画家黄筌的工笔写生典范，描绘二十余种雀鸟、龟虫并列于绢上，勾线精细、设色雅丽，本为课徒画稿。",
      appreciation: "「黄家富贵」的技术底子在此卷中一览无余：每一根羽毛都交代清楚，每一种虫豸都精确可辨。",
    },
    {
      id: "wuniutu", type: "painting", hall: "hall2",
      title: "五牛图",
      artist: "韩滉", dynasty: "唐", era: "约 8 世纪",
      medium: "纸本设色 · 纵 20.8cm × 横 139.8cm",
      collection: "故宫博物院",
      intro: "唐代韩滉所作，现存最早的纸本中国画之一。五牛姿态各异——俯首、回眸、前行，线描厚重如篆，牛鼻麻绳与缰络细节见写生功夫。",
      appreciation: "五头牛没有背景，却依靠姿态与眼神构成一部静默的戏剧。韩滉以近乎雕塑的线条表现牛的体量与皮毛。",
    },
    {
      id: "molantu", type: "painting", hall: "hall2",
      title: "墨兰图",
      artist: "郑思肖", dynasty: "宋末元初", era: "约 13 世纪",
      medium: "纸本水墨 · 纵 25.7cm × 横 42.4cm",
      collection: "大阪市立美术馆",
      intro: "宋末元初遗民画家郑思肖所作，以露根兰（根不着土）寄寓亡国之痛。花叶萧疏、墨色清逸。",
      appreciation: "兰根悬空，暗示故土已失；兰叶劲挺，又透露不屈。文人画至此成为以图像言志的诗歌。",
    },
    {
      id: "hanxizai", type: "painting", hall: "hall3",
      title: "韩熙载夜宴图",
      artist: "顾闳中", dynasty: "五代 · 南唐", era: "约 10 世纪",
      medium: "绢本设色 · 纵 28.7cm × 横 335.5cm",
      collection: "故宫博物院",
      intro: "南唐画家顾闳中奉后主李煜之命，潜入大臣韩熙载家中，目识心记其夜宴情景。全卷分听乐、观舞、歇息、清吹、散宴五段。",
      appreciation: "这幅画最耐人寻味的不是宴会的热闹，而是主人韩熙载的表情——他始终清醒而落寞。",
    },
    {
      id: "luoshenfu", type: "painting", hall: "hall3",
      title: "洛神赋图",
      artist: "顾恺之", dynasty: "东晋（宋摹本）", era: "原作约 4 世纪",
      medium: "绢本设色 · 纵 27.1cm × 横 572.8cm",
      collection: "故宫博物院",
      intro: "东晋画家顾恺之据曹植《洛神赋》所作，现存为宋代摹本。以连续叙事描绘曹植与洛神相遇、相恋、离别、怅望的完整情节。",
      appreciation: "顾恺之提出「迁想妙得」「以形写神」，此卷正是其理论的实践。洛神衣带飘举、若往若还。",
    },
    {
      id: "buniantu", type: "painting", hall: "hall3",
      title: "步辇图",
      artist: "阎立本", dynasty: "唐", era: "约 7 世纪",
      medium: "绢本设色 · 纵 38.5cm × 横 129.6cm",
      collection: "故宫博物院",
      intro: "唐代阎立本所作，描绘唐太宗接见吐蕃使者禄东赞的历史画。人物比例随身份递减、设色典雅。",
      appreciation: "画面以唐太宗的步辇为中心，人物一字排开，身份越高体量越大。",
    },
    {
      id: "jiangjunyong", type: "sculpture", hall: "hall3",
      title: "将军俑",
      artist: "佚名", dynasty: "秦", era: "公元前 3 世纪",
      medium: "陶塑 · 通高约 196cm",
      collection: "秦始皇帝陵博物院",
      intro: "秦始皇陵兵马俑坑出土的高级军吏俑，头戴鹖冠、身披铠甲，是秦代写实雕塑的代表。",
      appreciation: "将军俑的震撼力来自一种「沉默的威严」：他身形高大，双唇紧抿，目光望向前方。",
    },
    {
      id: "houmuwuding", type: "artifact", hall: "hall0",
      title: "后母戊鼎",
      artist: "佚名", dynasty: "商代后期", era: "约公元前 14—前 11 世纪",
      medium: "青铜礼器 · 通高 133cm · 重 832.84kg",
      collection: "中国国家博物馆",
      intro: "中国已发现的最重青铜器，商王为祭祀其母所铸。鼎身以雷纹为地，饰饕餮纹、夔龙纹。",
      appreciation: "后母戊鼎的价值，一半在工艺，一半在气质。铸造近 833 公斤的巨鼎需要数百人协作。",
    },
    {
      id: "matayafeiyan", type: "sculpture", hall: "courtyard",
      title: "马踏飞燕（铜奔马）",
      artist: "佚名", dynasty: "东汉", era: "约 2 世纪",
      medium: "青铜雕塑 · 高 34.5cm × 长 45cm",
      collection: "甘肃省博物馆",
      intro: "1969 年出土于甘肃武威雷台汉墓，一匹昂首嘶鸣的骏马三足腾空、一足踏于飞燕之背。",
      appreciation: "这件作品的艺术价值在于「以动写静」：马的重量全部落于一足，却通过奔跃的姿态化解了失衡。",
    },
  ],
};
